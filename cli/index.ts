#!/usr/bin/env node

import path from 'path'
import fs from 'fs'
import { analyzeLocalRepo } from '../electron/analyzers/index'
import { scanVulnerabilities } from '../electron/analyzers/vulnScanner'
import { saveScanSnapshot, loadPreviousScan, computeStackDiff } from '../electron/analyzers/stackDiff'
import { loadScoreHistory, appendScoreEntry } from '../electron/analyzers/scoreHistory'
import { generateCycloneDX, generateSPDX } from '../electron/analyzers/sbom'
import { calculateHealthScore } from '../src/utils/healthScore'
import {
  getScoreBadgeUrl,
  getVulnBadgeUrl,
  getDepsBadgeUrl,
  getScannedBadgeUrl,
} from '../src/utils/badge'
import { generateHtmlReport } from '../electron/exporters/htmlExporter'
import type { AnalysisResult, UserConfig, Service, StackDiffResult, AlternativeSuggestion } from '../shared/types'

const args = process.argv.slice(2)

// Check for subcommand
const subcommand = args[0] && !args[0].startsWith('-') ? args[0] : null
const isInitCommand = subcommand === 'init'
const isBadgeCommand = subcommand === 'badge'
const isDoctorCommand = subcommand === 'doctor'

// Parse --sbom value (next arg after --sbom)
const sbomIndex = args.indexOf('--sbom')
const sbomFormat = sbomIndex >= 0 ? args[sbomIndex + 1] as 'cyclonedx' | 'spdx' | undefined : undefined

// Parse flags
const flags = {
  json: args.includes('--json'),
  markdown: args.includes('--md') || args.includes('--markdown'),
  html: args.includes('--html'),
  help: args.includes('--help') || args.includes('-h'),
  version: args.includes('--version') || args.includes('-v'),
  failOnVulns: args.includes('--fail-on-vulns'),
  failOnUnreviewed: args.includes('--fail-on-unreviewed'),
  diff: args.includes('--diff'),
  sbom: sbomFormat,
}

// Get target path (first non-flag argument, skip subcommand)
const targetPath = (isInitCommand || isBadgeCommand || isDoctorCommand)
  ? args.slice(1).find(a => !a.startsWith('-')) || '.'
  : args.find(a => !a.startsWith('-')) || '.'

if (flags.version) {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf-8'))
  console.log(`stackwatch v${pkg.version}`)
  process.exit(0)
}

if (flags.help) {
  console.log(`
  StackWatch CLI — scan your codebase and map every service

  Usage:
    npx stackwatch [path] [options]
    npx stackwatch init [path]
    npx stackwatch badge [path]
    npx stackwatch doctor [path]

  Commands:
    init [path]       Scan and generate a stackwatch.config.json file
    badge [path]      Scan and output README-ready Markdown badges
    doctor [path]     Run health checks and report actionable problems

  Arguments:
    path              Path to repository (default: current directory)

  Options:
    --json            Output as JSON
    --md, --markdown  Output as Markdown table
    --html            Output as self-contained HTML report
    --diff            Compare with previous scan and show changes
    --sbom cyclonedx  Output CycloneDX 1.5 SBOM (JSON)
    --sbom spdx       Output SPDX 2.3 SBOM (JSON)
    --fail-on-vulns   Exit code 1 if critical/high vulnerabilities found
    --fail-on-unreviewed  Exit code 2 if any services need review
    -h, --help        Show this help
    -v, --version     Show version

  Examples:
    npx stackwatch                   # Scan current directory
    npx stackwatch ./my-project      # Scan specific path
    npx stackwatch --json            # JSON output for piping
    npx stackwatch --md > SERVICES.md  # Generate Markdown report
    npx stackwatch --html > report.html  # Generate HTML dashboard report
    npx stackwatch --sbom cyclonedx > sbom.json  # Generate CycloneDX SBOM
    npx stackwatch --sbom spdx > sbom.spdx.json  # Generate SPDX SBOM
    npx stackwatch --fail-on-vulns   # Fail CI if vulns detected
    npx stackwatch init              # Generate config for current dir
    npx stackwatch init ./my-project # Generate config for specific path
    npx stackwatch badge             # Generate README badges for cwd
    npx stackwatch badge ./my-project  # Generate badges for specific path
    npx stackwatch doctor            # Run health checks for cwd
    npx stackwatch doctor ./my-project # Run health checks for specific path
  `.trim())
  process.exit(0)
}

function resolveAndValidatePath(targetDir: string): string {
  const resolvedPath = path.resolve(targetDir)

  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: path "${resolvedPath}" does not exist`)
    process.exit(1)
  }

  if (!fs.statSync(resolvedPath).isDirectory()) {
    console.error(`Error: "${resolvedPath}" is not a directory`)
    process.exit(1)
  }

  return resolvedPath
}

async function main() {
  if (isInitCommand) {
    await runInit()
  } else if (isBadgeCommand) {
    await runBadge()
  } else if (isDoctorCommand) {
    await runDoctor()
  } else {
    await runScan()
  }
}

async function runScan() {
  const resolvedPath = resolveAndValidatePath(targetPath)
  const projectName = path.basename(resolvedPath)

  // Validate --sbom format if provided
  if (flags.sbom && flags.sbom !== 'cyclonedx' && flags.sbom !== 'spdx') {
    console.error(`Error: invalid SBOM format "${flags.sbom}". Use "cyclonedx" or "spdx".`)
    process.exit(1)
  }

  if (!flags.json && !flags.markdown && !flags.html && !flags.sbom) {
    console.log(`\n  STACKWATCH — scanning ${projectName}\n`)
  }

  try {
    // Load previous scan before running new one (needed for --diff)
    const previousScan = flags.diff ? await loadPreviousScan(resolvedPath) : null

    const result = await analyzeLocalRepo(resolvedPath)

    // SBOM output — exclusive mode, output only SBOM JSON and exit
    if (flags.sbom) {
      const sbom = flags.sbom === 'cyclonedx'
        ? generateCycloneDX(result.dependencies, projectName)
        : generateSPDX(result.dependencies, projectName)
      console.log(JSON.stringify(sbom, null, 2))
      return
    }

    // HTML output — exclusive mode, output self-contained HTML report and exit
    if (flags.html) {
      const healthResult = calculateHealthScore(result.services, result.flowNodes, result.flowEdges)
      const html = generateHtmlReport({
        projectName,
        services: result.services,
        dependencies: result.dependencies,
        flowNodes: result.flowNodes,
        flowEdges: result.flowEdges,
        score: healthResult.score,
        scoreBreakdown: {
          servicesWithCost: healthResult.servicesWithCost,
          servicesWithOwner: healthResult.servicesWithOwner,
          servicesReviewed: healthResult.servicesReviewed,
          graphCompleteness: healthResult.graphCompleteness,
        },
        generatedAt: new Date().toISOString(),
      })
      console.log(html)
      return
    }

    // Compute diff if requested and previous scan exists
    let diff: StackDiffResult | null = null
    if (flags.diff && previousScan) {
      diff = computeStackDiff(previousScan, {
        timestamp: new Date().toISOString(),
        services: result.services,
        dependencies: result.dependencies,
      })
    }

    // Calculate health score and load history for trend display
    const healthResult = calculateHealthScore(result.services, result.flowNodes, result.flowEdges)
    const scoreHistory = await loadScoreHistory(resolvedPath)

    if (flags.json) {
      const output = diff ? { ...result, diff } : result
      console.log(JSON.stringify(output, null, 2))
    } else if (flags.markdown) {
      printMarkdown(result, projectName)
      if (diff) printDiffMarkdown(diff)
    } else {
      printSummary(result, projectName)

      // Stack Score with trend info
      console.log(`  Stack Score: ${healthResult.score}/100`)
      if (scoreHistory.length > 0) {
        const lastEntry = scoreHistory[scoreHistory.length - 1]
        const delta = healthResult.score - lastEntry.score
        if (delta > 0) {
          console.log(`    \u2191 +${delta} from last scan (${lastEntry.score} \u2192 ${healthResult.score})`)
        } else if (delta < 0) {
          console.log(`    \u2193 ${delta} from last scan (${lastEntry.score} \u2192 ${healthResult.score})`)
        } else {
          console.log(`    = no change from last scan`)
        }
        console.log(`    History: ${scoreHistory.length} scan${scoreHistory.length === 1 ? '' : 's'} recorded`)
      }
      console.log()

      if (flags.diff && !previousScan) {
        console.log('  No previous scan found. This scan will be saved for future comparisons.')
        console.log('  Tip: add .stackwatch/ to your .gitignore')
        console.log()
      }
      if (diff) printDiffSummary(diff)
    }

    // Save snapshot for future comparisons (always, after output)
    await saveScanSnapshot(resolvedPath, result)

    // Append score history entry
    try {
      await appendScoreEntry(resolvedPath, {
        timestamp: new Date().toISOString(),
        score: healthResult.score,
        breakdown: {
          servicesWithCost: healthResult.servicesWithCost,
          servicesWithOwner: healthResult.servicesWithOwner,
          servicesReviewed: healthResult.servicesReviewed,
          graphCompleteness: healthResult.graphCompleteness,
        },
        serviceCount: result.services.length,
        depCount: result.dependencies.length,
      })
    } catch {
      // Non-critical: don't fail the scan if score history save fails
    }

    // Semantic exit codes (checked after output is printed)
    if (flags.failOnVulns) {
      const vulnResults = await scanVulnerabilities(result.dependencies)
      const hasCriticalOrHigh = vulnResults.some(r =>
        r.vulnerabilities.some(v => v.severity === 'critical' || v.severity === 'high')
      )
      if (hasCriticalOrHigh) {
        if (!flags.json && !flags.markdown) {
          console.error('\n  FAIL: critical or high severity vulnerabilities detected')
        }
        process.exit(1)
      }
    }

    if (flags.failOnUnreviewed) {
      const hasUnreviewed = result.services.some(s => s.needsReview === true)
      if (hasUnreviewed) {
        if (!flags.json && !flags.markdown) {
          console.error('\n  FAIL: services needing review detected')
        }
        process.exit(2)
      }
    }
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
}

async function runInit() {
  const resolvedPath = resolveAndValidatePath(targetPath)
  const projectName = path.basename(resolvedPath)
  const configPath = path.join(resolvedPath, 'stackwatch.config.json')

  // Check if config already exists
  if (fs.existsSync(configPath)) {
    console.error(`Warning: ${configPath} already exists, skipping.`)
    console.error('Delete the existing file and run again to regenerate.')
    process.exit(0)
  }

  console.log(`\n  STACKWATCH INIT — scanning ${projectName}\n`)

  try {
    const result = await analyzeLocalRepo(resolvedPath)

    // Build config from scan results
    const config: UserConfig = {
      version: '1',
      project: {
        name: projectName,
        description: '',
      },
      services: result.services.map((s): Service => ({
        id: s.id,
        name: s.name,
        category: s.category,
        plan: s.plan,
        source: s.source,
        confidence: s.confidence,
        needsReview: s.needsReview,
        inferredFrom: s.inferredFrom,
        // Empty fields for user to fill in
        cost: undefined,
        owner: undefined,
        renewalDate: undefined,
        accountEmail: undefined,
        notes: undefined,
      })),
      accounts: [],
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')

    console.log(`  Services detected: ${result.services.length}`)
    console.log(`  Dependencies:      ${result.dependencies.length}`)
    console.log()
    console.log(`  Config written to: ${configPath}`)
    console.log()
    console.log('  Edit the file to add cost, owner, and renewal info for each service.')
    console.log()
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
}

async function runBadge() {
  const resolvedPath = resolveAndValidatePath(targetPath)
  const projectName = path.basename(resolvedPath)

  console.error(`\n  STACKWATCH BADGE — scanning ${projectName}\n`)

  try {
    const result = await analyzeLocalRepo(resolvedPath)

    // Calculate health score
    const { score } = calculateHealthScore(
      result.services,
      result.flowNodes,
      result.flowEdges,
    )

    // Scan for vulnerabilities
    const vulnResults = await scanVulnerabilities(result.dependencies)
    const vulnCount = vulnResults.reduce((sum, r) => sum + r.vulnerabilities.length, 0)

    const serviceCount = result.services.length
    const depCount = result.dependencies.length
    const date = new Date().toISOString().split('T')[0]

    const scoreUrl = getScoreBadgeUrl(score)
    const serviceColor = 'e2b04a'
    const serviceUrl = `https://img.shields.io/badge/Services-${serviceCount}_detected-${serviceColor}`
    const vulnUrl = getVulnBadgeUrl(vulnCount)
    const depsUrl = getDepsBadgeUrl(depCount)
    const scannedUrl = getScannedBadgeUrl(date)

    const repoUrl = `https://github.com/alciller88/StackWatch`

    const lines = [
      `<!-- StackWatch Badges -->`,
      `[![Stack Score](${scoreUrl})](${repoUrl})`,
      `[![Services](${serviceUrl})](${repoUrl})`,
      `[![Vulnerabilities](${vulnUrl})](${repoUrl})`,
      `[![Dependencies](${depsUrl})](${repoUrl})`,
      `[![Scanned](${scannedUrl})](${repoUrl})`,
    ]

    console.log(lines.join('\n'))
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
}

async function runDoctor() {
  const resolvedPath = resolveAndValidatePath(targetPath)
  const projectName = path.basename(resolvedPath)
  const configPath = path.join(resolvedPath, 'stackwatch.config.json')

  console.log()
  console.log('stackwatch doctor \u2014 Health Check')
  console.log('\u2550'.repeat(35))
  console.log()

  let errors = 0
  let warnings = 0
  let passed = 0

  const pass = (msg: string) => { passed++; console.log(`  \u2713 ${msg}`) }
  const fail = (msg: string) => { errors++; console.log(`  \u2717 ${msg}`) }
  const warn = (msg: string) => { warnings++; console.log(`  \u26A0 ${msg}`) }

  try {
    // --- Configuration ---
    console.log('Configuration')

    let config: UserConfig | null = null
    if (fs.existsSync(configPath)) {
      pass('stackwatch.config.json found')
      try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as UserConfig
      } catch {
        fail('stackwatch.config.json is not valid JSON')
      }
    } else {
      fail('stackwatch.config.json not found')
    }

    if (config?.project?.name) {
      pass(`Project name: ${config.project.name}`)
    } else {
      fail('No project name defined')
    }

    console.log()

    // --- Run analysis ---
    const result = await analyzeLocalRepo(resolvedPath)
    const services = result.services

    // Merge config overrides into services if config exists
    if (config?.services) {
      for (const cs of config.services) {
        const svc = services.find(s => s.id === cs.id || s.name === cs.name)
        if (svc) {
          if (cs.owner) svc.owner = cs.owner
          if (cs.renewalDate) svc.renewalDate = cs.renewalDate
          if (cs.cost) svc.cost = cs.cost
          if (cs.plan) svc.plan = cs.plan
        }
      }
    }

    // --- Services ---
    console.log(`Services (${services.length} detected)`)

    if (services.length === 0) {
      warn('No services detected')
      console.log()
    } else {
      const noOwner = services.filter(s => !s.owner || !s.owner.trim())
      if (noOwner.length > 0) {
        warn(`${noOwner.length} service${noOwner.length === 1 ? '' : 's'} without owner: ${noOwner.map(s => s.name).join(', ')}`)
      } else {
        pass('All services have owners')
      }

      const paidNoRenewal = services.filter(s => s.plan === 'paid' && !s.renewalDate)
      if (paidNoRenewal.length > 0) {
        fail(`${paidNoRenewal.length} paid service${paidNoRenewal.length === 1 ? '' : 's'} without renewal date: ${paidNoRenewal.map(s => s.name).join(', ')}`)
      } else if (services.some(s => s.plan === 'paid')) {
        pass('All paid services have renewal dates')
      }

      const needReview = services.filter(s => s.needsReview)
      if (needReview.length > 0) {
        warn(`${needReview.length} service${needReview.length === 1 ? '' : 's'} need review: ${needReview.map(s => s.name).join(', ')}`)
      } else {
        pass('No services need review')
      }

      const lowConfidence = services.filter(s => s.confidence === 'low')
      if (lowConfidence.length > 0) {
        warn(`${lowConfidence.length} service${lowConfidence.length === 1 ? '' : 's'} with low confidence: ${lowConfidence.map(s => s.name).join(', ')}`)
      } else {
        pass('No low-confidence detections')
      }

      const allHaveCategory = services.every(s => s.category)
      if (allHaveCategory) {
        pass('All services have categories')
      } else {
        warn('Some services missing categories')
      }

      console.log()
    }

    // --- Costs ---
    console.log('Costs')

    const paidServices = services.filter(s => s.plan === 'paid')
    if (paidServices.length === 0) {
      pass('No paid services detected')
    } else {
      const paidNoCost = paidServices.filter(s => !s.cost || !s.cost.amount)
      if (paidNoCost.length > 0) {
        fail(`${paidNoCost.length} paid service${paidNoCost.length === 1 ? '' : 's'} without documented cost: ${paidNoCost.map(s => s.name).join(', ')}`)
      } else {
        pass('All paid services have documented costs')
      }

      const totalMonthly = paidServices.reduce((sum, s) => {
        if (!s.cost || !s.cost.amount) return sum
        const monthly = s.cost.period === 'yearly' ? s.cost.amount / 12 : s.cost.amount
        return sum + monthly
      }, 0)

      if (totalMonthly > 0) {
        pass(`Total monthly cost documented: $${totalMonthly.toFixed(2)}`)
      }
    }

    console.log()

    // --- Security ---
    console.log('Security')

    const vulnResults = await scanVulnerabilities(result.dependencies)
    const allVulns = vulnResults.flatMap(r => r.vulnerabilities)
    const criticalCount = allVulns.filter(v => v.severity === 'critical').length
    const highCount = allVulns.filter(v => v.severity === 'high').length

    if (allVulns.length > 0) {
      const parts: string[] = []
      if (criticalCount > 0) parts.push(`${criticalCount} critical`)
      if (highCount > 0) parts.push(`${highCount} high`)
      const medCount = allVulns.filter(v => v.severity === 'medium').length
      if (medCount > 0) parts.push(`${medCount} medium`)
      const lowCount = allVulns.filter(v => v.severity === 'low').length
      if (lowCount > 0) parts.push(`${lowCount} low`)
      const unknownCount = allVulns.filter(v => v.severity === 'unknown').length
      if (unknownCount > 0) parts.push(`${unknownCount} unknown`)

      if (criticalCount > 0 || highCount > 0) {
        fail(`${allVulns.length} vulnerabilit${allVulns.length === 1 ? 'y' : 'ies'} found (${parts.join(', ')})`)
      } else {
        warn(`${allVulns.length} vulnerabilit${allVulns.length === 1 ? 'y' : 'ies'} found (${parts.join(', ')})`)
      }
    } else {
      pass('No vulnerabilities found')
    }

    console.log()

    // --- Stack Score ---
    const health = calculateHealthScore(
      services,
      result.flowNodes,
      result.flowEdges,
    )

    const totalServices = services.length
    const costCount = services.filter(s => s.cost && s.cost.amount >= 0).length
    const ownerCount = services.filter(s => s.owner && s.owner.trim()).length
    const reviewedCount = services.filter(s => !s.needsReview).length

    const nonUserNodes = result.flowNodes.filter(n => n.type !== 'user')
    const connectedNodeIds = new Set([
      ...result.flowEdges.map(e => e.source),
      ...result.flowEdges.map(e => e.target),
    ])
    const connectedCount = nonUserNodes.filter(n => connectedNodeIds.has(n.id)).length
    const totalNodes = nonUserNodes.length

    console.log(`Stack Score: ${health.score}/100`)
    console.log(`  Cost documented:     ${health.servicesWithCost}% (${costCount}/${totalServices} services)`)
    console.log(`  Owner assigned:      ${health.servicesWithOwner}% (${ownerCount}/${totalServices} services)`)
    console.log(`  Services reviewed:   ${health.servicesReviewed}% (${reviewedCount}/${totalServices} services)`)
    console.log(`  Graph completeness:  ${health.graphCompleteness}% (${connectedCount}/${totalNodes} nodes connected)`)

    console.log()
    console.log('\u2550'.repeat(35))
    console.log(`Summary: ${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}, ${passed} passed`)
    console.log()

    if (errors > 0) {
      process.exit(1)
    }
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
}

function printSummary(result: AnalysisResult, projectName: string) {
  const { services, dependencies } = result

  console.log(`  Project:      ${projectName}`)
  console.log(`  Services:     ${services.length}`)
  console.log(`  Dependencies: ${dependencies.length}`)
  console.log()

  if (services.length > 0) {
    // Group by category
    const byCategory = new Map<string, typeof services>()
    for (const s of services) {
      const list = byCategory.get(s.category) ?? []
      list.push(s)
      byCategory.set(s.category, list)
    }

    console.log('  SERVICES')
    console.log('  ' + '-'.repeat(60))
    for (const [category, svcs] of byCategory) {
      console.log(`  ${category.toUpperCase()} (${svcs.length})`)
      for (const s of svcs) {
        const conf = s.confidence === 'high' ? '●' : s.confidence === 'medium' ? '◐' : '○'
        console.log(`    ${conf} ${s.name}  [${s.plan}]`)
      }
    }
    console.log()
  }

  if (dependencies.length > 0) {
    const byEco = new Map<string, number>()
    for (const d of dependencies) {
      byEco.set(d.ecosystem, (byEco.get(d.ecosystem) ?? 0) + 1)
    }
    console.log('  DEPENDENCIES')
    console.log('  ' + '-'.repeat(60))
    for (const [eco, count] of byEco) {
      console.log(`    ${eco}: ${count}`)
    }
    console.log()
  }

  // Zombie / stale services
  const zombies = services.filter(s => s.zombieStatus === 'zombie')
  const stale = services.filter(s => s.zombieStatus === 'stale')
  if (zombies.length > 0 || stale.length > 0) {
    console.log('  POTENTIALLY ABANDONED SERVICES')
    console.log('  ' + '-'.repeat(60))
    if (zombies.length > 0) {
      console.log('    Zombie (6+ months inactive):')
      for (const s of zombies) {
        const dateStr = s.lastActivityDate ? s.lastActivityDate.split('T')[0] : 'unknown'
        const daysStr = s.daysSinceActivity != null ? `${s.daysSinceActivity} days ago` : ''
        console.log(`      - ${s.name} (last activity: ${dateStr}, ${daysStr})`)
      }
    }
    if (stale.length > 0) {
      console.log('    Stale (3-6 months inactive):')
      for (const s of stale) {
        const dateStr = s.lastActivityDate ? s.lastActivityDate.split('T')[0] : 'unknown'
        const daysStr = s.daysSinceActivity != null ? `${s.daysSinceActivity} days ago` : ''
        console.log(`      - ${s.name} (last activity: ${dateStr}, ${daysStr})`)
      }
    }
    console.log()
  }

  // Confidence breakdown
  const high = services.filter(s => s.confidence === 'high').length
  const med = services.filter(s => s.confidence === 'medium').length
  const low = services.filter(s => s.confidence === 'low').length
  if (services.length > 0) {
    console.log(`  Confidence: ${high} high, ${med} medium, ${low} low`)
  }
  console.log()

  // Stack Alternatives (AI-suggested)
  const suggestions = result.deepAnalysis?.alternativeSuggestions
  if (suggestions && suggestions.length > 0) {
    console.log('  STACK ALTERNATIVES (AI-suggested)')
    console.log('  ' + '-'.repeat(60))
    for (const s of suggestions) {
      const alts = s.alternatives
        .map(a => {
          const savings = a.estimatedSavings ? `, ${a.estimatedSavings}` : ''
          return `${a.name} (${a.type}${savings})`
        })
        .join(', ')
      console.log(`    ${s.serviceName} \u2192 ${alts}`)
    }
    console.log()
  }
}

function printMarkdown(result: AnalysisResult, projectName: string) {
  const { services, dependencies } = result
  const date = new Date().toISOString().split('T')[0]

  console.log(`# Services — ${projectName}\n`)
  console.log(`Generated by StackWatch CLI on ${date}\n`)

  if (services.length > 0) {
    // Group by category
    const byCategory = new Map<string, typeof services>()
    for (const s of services) {
      const list = byCategory.get(s.category) ?? []
      list.push(s)
      byCategory.set(s.category, list)
    }

    for (const [category, svcs] of byCategory) {
      console.log(`## ${category.charAt(0).toUpperCase() + category.slice(1)}\n`)
      console.log('| Service | Plan | Confidence |')
      console.log('|---|---|---|')
      for (const s of svcs) {
        console.log(`| ${s.name} | ${s.plan} | ${s.confidence ?? 'medium'} |`)
      }
      console.log()
    }
  }

  if (dependencies.length > 0) {
    console.log(`## Dependencies (${dependencies.length})\n`)
    console.log('| Name | Version | Type | Ecosystem |')
    console.log('|---|---|---|---|')
    for (const d of dependencies) {
      console.log(`| ${d.name} | ${d.version} | ${d.type} | ${d.ecosystem} |`)
    }
    console.log()
  }

  // Zombie services section
  const zombies = services.filter(s => s.zombieStatus === 'zombie')
  const stale = services.filter(s => s.zombieStatus === 'stale')
  if (zombies.length > 0 || stale.length > 0) {
    console.log(`## Zombie Services\n`)
    if (zombies.length > 0) {
      console.log('### Zombie (6+ months inactive)\n')
      for (const s of zombies) {
        const dateStr = s.lastActivityDate ? s.lastActivityDate.split('T')[0] : 'unknown'
        const daysStr = s.daysSinceActivity != null ? `, ${s.daysSinceActivity} days ago` : ''
        console.log(`- **${s.name}** (last activity: ${dateStr}${daysStr})`)
      }
      console.log()
    }
    if (stale.length > 0) {
      console.log('### Stale (3-6 months inactive)\n')
      for (const s of stale) {
        const dateStr = s.lastActivityDate ? s.lastActivityDate.split('T')[0] : 'unknown'
        const daysStr = s.daysSinceActivity != null ? `, ${s.daysSinceActivity} days ago` : ''
        console.log(`- **${s.name}** (last activity: ${dateStr}${daysStr})`)
      }
      console.log()
    }
  }

  // Stack Alternatives (AI-suggested)
  const mdSuggestions = result.deepAnalysis?.alternativeSuggestions
  if (mdSuggestions && mdSuggestions.length > 0) {
    console.log(`## Stack Alternatives\n`)
    console.log('| Service | Alternative | Type | Savings | Reason |')
    console.log('|---|---|---|---|---|')
    for (const s of mdSuggestions) {
      for (const a of s.alternatives) {
        console.log(`| ${s.serviceName} | ${a.name} | ${a.type} | ${a.estimatedSavings ?? '-'} | ${a.reason} |`)
      }
    }
    console.log()
  }

  console.log(`---\n*Generated by [StackWatch](https://github.com/alciller88/StackWatch)*`)
}

function printDiffSummary(diff: StackDiffResult) {
  const hasChanges = diff.added.length > 0 || diff.removed.length > 0 ||
    diff.changed.length > 0 || diff.addedDeps.length > 0 || diff.removedDeps.length > 0

  console.log('  STACK DIFF')
  console.log('  ' + '-'.repeat(60))

  if (!hasChanges) {
    console.log('    No changes since last scan.')
    console.log()
    return
  }

  if (diff.added.length > 0) {
    const names = diff.added.map(s => s.name).join(', ')
    console.log(`    + ${diff.added.length} new service${diff.added.length === 1 ? '' : 's'}: ${names}`)
  }
  if (diff.removed.length > 0) {
    const names = diff.removed.map(s => s.name).join(', ')
    console.log(`    - ${diff.removed.length} removed service${diff.removed.length === 1 ? '' : 's'}: ${names}`)
  }
  if (diff.changed.length > 0) {
    const details = diff.changed.map(c => {
      const parts: string[] = []
      if (c.previousCategory !== c.service.category) {
        parts.push(`category: ${c.previousCategory}\u2192${c.service.category}`)
      }
      if (c.previousConfidence !== (c.service.confidence ?? 'medium')) {
        parts.push(`confidence: ${c.previousConfidence}\u2192${c.service.confidence ?? 'medium'}`)
      }
      return `${c.service.name} (${parts.join(', ')})`
    }).join(', ')
    console.log(`    ~ ${diff.changed.length} changed: ${details}`)
  }
  if (diff.addedDeps.length > 0) {
    console.log(`    + ${diff.addedDeps.length} new dependenc${diff.addedDeps.length === 1 ? 'y' : 'ies'}`)
  }
  if (diff.removedDeps.length > 0) {
    console.log(`    - ${diff.removedDeps.length} removed dependenc${diff.removedDeps.length === 1 ? 'y' : 'ies'}`)
  }
  console.log()
}

function printDiffMarkdown(diff: StackDiffResult) {
  const hasChanges = diff.added.length > 0 || diff.removed.length > 0 ||
    diff.changed.length > 0 || diff.addedDeps.length > 0 || diff.removedDeps.length > 0

  console.log(`\n## Stack Diff\n`)

  if (!hasChanges) {
    console.log('No changes since last scan.\n')
    return
  }

  if (diff.added.length > 0) {
    console.log(`- **+${diff.added.length} new service${diff.added.length === 1 ? '' : 's'}**: ${diff.added.map(s => s.name).join(', ')}`)
  }
  if (diff.removed.length > 0) {
    console.log(`- **-${diff.removed.length} removed service${diff.removed.length === 1 ? '' : 's'}**: ${diff.removed.map(s => s.name).join(', ')}`)
  }
  if (diff.changed.length > 0) {
    for (const c of diff.changed) {
      const parts: string[] = []
      if (c.previousCategory !== c.service.category) {
        parts.push(`category: ${c.previousCategory} → ${c.service.category}`)
      }
      if (c.previousConfidence !== (c.service.confidence ?? 'medium')) {
        parts.push(`confidence: ${c.previousConfidence} → ${c.service.confidence ?? 'medium'}`)
      }
      console.log(`- **~${c.service.name}**: ${parts.join(', ')}`)
    }
  }
  if (diff.addedDeps.length > 0) {
    console.log(`- **+${diff.addedDeps.length} new dependenc${diff.addedDeps.length === 1 ? 'y' : 'ies'}**`)
  }
  if (diff.removedDeps.length > 0) {
    console.log(`- **-${diff.removedDeps.length} removed dependenc${diff.removedDeps.length === 1 ? 'y' : 'ies'}**`)
  }
  console.log()
}

main()
