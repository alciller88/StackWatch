#!/usr/bin/env node

import path from 'path'
import fs from 'fs'
import { analyzeLocalRepo } from '../electron/analyzers/index'
import { scanVulnerabilities } from '../electron/analyzers/vulnScanner'
import { saveScanSnapshot, loadPreviousScan, computeStackDiff } from '../electron/analyzers/stackDiff'
import { generateCycloneDX, generateSPDX } from '../electron/analyzers/sbom'
import { calculateHealthScore } from '../src/utils/healthScore'
import {
  getScoreBadgeUrl,
  getVulnBadgeUrl,
  getDepsBadgeUrl,
  getScannedBadgeUrl,
} from '../src/utils/badge'
import type { AnalysisResult, UserConfig, Service, StackDiffResult } from '../shared/types'

const args = process.argv.slice(2)

// Check for subcommand
const subcommand = args[0] && !args[0].startsWith('-') ? args[0] : null
const isInitCommand = subcommand === 'init'
const isBadgeCommand = subcommand === 'badge'

// Parse --sbom value (next arg after --sbom)
const sbomIndex = args.indexOf('--sbom')
const sbomFormat = sbomIndex >= 0 ? args[sbomIndex + 1] as 'cyclonedx' | 'spdx' | undefined : undefined

// Parse flags
const flags = {
  json: args.includes('--json'),
  markdown: args.includes('--md') || args.includes('--markdown'),
  help: args.includes('--help') || args.includes('-h'),
  version: args.includes('--version') || args.includes('-v'),
  failOnVulns: args.includes('--fail-on-vulns'),
  failOnUnreviewed: args.includes('--fail-on-unreviewed'),
  diff: args.includes('--diff'),
  sbom: sbomFormat,
}

// Get target path (first non-flag argument, skip subcommand)
const targetPath = (isInitCommand || isBadgeCommand)
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

  Commands:
    init [path]       Scan and generate a stackwatch.config.json file
    badge [path]      Scan and output README-ready Markdown badges

  Arguments:
    path              Path to repository (default: current directory)

  Options:
    --json            Output as JSON
    --md, --markdown  Output as Markdown table
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
    npx stackwatch --sbom cyclonedx > sbom.json  # Generate CycloneDX SBOM
    npx stackwatch --sbom spdx > sbom.spdx.json  # Generate SPDX SBOM
    npx stackwatch --fail-on-vulns   # Fail CI if vulns detected
    npx stackwatch init              # Generate config for current dir
    npx stackwatch init ./my-project # Generate config for specific path
    npx stackwatch badge             # Generate README badges for cwd
    npx stackwatch badge ./my-project  # Generate badges for specific path
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

  if (!flags.json && !flags.markdown && !flags.sbom) {
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

    // Compute diff if requested and previous scan exists
    let diff: StackDiffResult | null = null
    if (flags.diff && previousScan) {
      diff = computeStackDiff(previousScan, {
        timestamp: new Date().toISOString(),
        services: result.services,
        dependencies: result.dependencies,
      })
    }

    if (flags.json) {
      const output = diff ? { ...result, diff } : result
      console.log(JSON.stringify(output, null, 2))
    } else if (flags.markdown) {
      printMarkdown(result, projectName)
      if (diff) printDiffMarkdown(diff)
    } else {
      printSummary(result, projectName)
      if (flags.diff && !previousScan) {
        console.log('  No previous scan found. This scan will be saved for future comparisons.')
        console.log('  Tip: add .stackwatch/ to your .gitignore')
        console.log()
      }
      if (diff) printDiffSummary(diff)
    }

    // Save snapshot for future comparisons (always, after output)
    await saveScanSnapshot(resolvedPath, result)

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

  // Confidence breakdown
  const high = services.filter(s => s.confidence === 'high').length
  const med = services.filter(s => s.confidence === 'medium').length
  const low = services.filter(s => s.confidence === 'low').length
  if (services.length > 0) {
    console.log(`  Confidence: ${high} high, ${med} medium, ${low} low`)
  }
  console.log()
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
