import path from 'path'
import type { Service, AnalysisResult, Evidence, Dependency, AISettings, DeepAnalysisResult } from '../types'
import { extractEvidences, extractEvidencesFromGitHub } from './extractor'
import { classifyEvidences } from './heuristic'
import { deduplicateServices, confidenceRank } from './deduplicator'
import { inferFlowGraph } from './flowInference'
import { runDeepAnalysis, refineServicesWithAI, filterFalsePositivesWithAI } from '../ai/deepAnalyzer'
import { detectMonorepo } from './monorepo'
import { detectZombieServices, enrichServicesWithZombieData } from './zombieDetector'

export async function analyzeLocalRepo(
  folderPath: string,
  aiSettings?: AISettings,
  excludedServices?: string[],
): Promise<AnalysisResult> {
  // Check for monorepo structure
  const mono = await detectMonorepo(folderPath)

  if (mono.type && mono.packages.length > 1) {
    // Monorepo: scan root + each package, merge results
    return analyzeMonorepo(folderPath, mono.packages, mono.type, aiSettings, excludedServices)
  }

  // Single repo
  const { evidences, dependencies, projectName } = await extractEvidences(folderPath)
  return runPipeline(evidences, dependencies, aiSettings, projectName, excludedServices, folderPath)
}

async function analyzeMonorepo(
  rootPath: string,
  packagePaths: string[],
  monoType: string,
  aiSettings?: AISettings,
  excludedServices?: string[],
): Promise<AnalysisResult> {
  const rootName = path.basename(rootPath)

  // Scan root first (for shared config, CI, docker-compose, etc.)
  const rootResult = await extractEvidences(rootPath)

  // Scan each package
  const allEvidences: Evidence[] = [...rootResult.evidences]
  const allDeps: Dependency[] = [...rootResult.dependencies]

  for (const pkgPath of packagePaths) {
    try {
      const pkgResult = await extractEvidences(pkgPath)
      // Tag evidences with package name
      const pkgName = path.basename(pkgPath)
      for (const ev of pkgResult.evidences) {
        ev.file = `${pkgName}/${ev.file}`
      }
      allEvidences.push(...pkgResult.evidences)
      allDeps.push(...pkgResult.dependencies)
    } catch {
      // Skip packages that fail to scan
    }
  }

  // Deduplicate dependencies (same name+ecosystem across packages)
  const uniqueDeps = deduplicateDeps(allDeps)

  const result = await runPipeline(allEvidences, uniqueDeps, aiSettings, rootName, excludedServices, rootPath)
  result.monorepo = {
    type: monoType,
    packages: packagePaths.map(p => path.basename(p)),
  }
  return result
}

function deduplicateDeps(deps: Dependency[]): Dependency[] {
  const seen = new Map<string, Dependency>()
  for (const d of deps) {
    const key = `${d.ecosystem}:${d.name}`
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, d)
    } else if (d.type === 'production' && existing.type !== 'production') {
      // Prefer production over dev
      seen.set(key, d)
    }
  }
  return Array.from(seen.values())
}

export async function analyzeGitHubRepo(
  fetchFile: (path: string) => Promise<string | null>,
  listDir: (path: string) => Promise<string[]>,
  aiSettings?: AISettings,
): Promise<AnalysisResult> {
  const { evidences, dependencies, projectName } = await extractEvidencesFromGitHub(fetchFile, listDir)
  return runPipeline(evidences, dependencies, aiSettings, projectName)
}

async function runPipeline(
  evidences: Evidence[],
  dependencies: Dependency[],
  aiSettings: AISettings | undefined,
  projectName: string,
  excludedServices?: string[],
  repoPath?: string,
): Promise<AnalysisResult> {
  const useAI = aiSettings?.enabled && aiSettings.provider && aiSettings.scanMode === 'hybrid'

  // Step 1: Heuristic classification (always runs)
  const heuristicResults = classifyEvidences(evidences, projectName)
  let services = deduplicateServices(heuristicResults)

  // Note: excludedServices only affects the graph (filtered in graphStore.initFromAnalysis),
  // NOT the services list — users should see all detected services in the Services panel.

  // Step 2.5: AI false-positive filter (hybrid mode, before full refinement)
  let aiFilteredCount: number | undefined
  if (useAI) {
    const preFilterCount = services.length
    try {
      services = await filterFalsePositivesWithAI(services, aiSettings!.provider)
      const removed = preFilterCount - services.length
      if (removed > 0) aiFilteredCount = removed
    } catch {
      // Silent fallback — filter is optional
    }
  }

  // Step 3: AI enhancement (hybrid mode)
  let deepAnalysis: DeepAnalysisResult | undefined
  let aiError: string | undefined
  if (useAI) {
    const originalServices = [...services]
    try {
      // Step 3a: AI validates/refines heuristic results (remove false positives, fix categories, merge dupes)
      services = await refineServicesWithAI(services, aiSettings!.provider)

      // Step 3b: Deep analysis (service context, hidden services, edge types)
      deepAnalysis = await runDeepAnalysis(
        services,
        evidences,
        repoPath ?? null,
        aiSettings!.provider,
      )

      // Merge hidden services discovered by AI
      if (deepAnalysis.hiddenServices.length > 0) {
        const excluded = new Set(excludedServices ?? [])
        const newHidden = deepAnalysis.hiddenServices.filter((s) => !excluded.has(s.id))
        services = mergeAIResults(services, newHidden)
      }
    } catch (err) {
      aiError = err instanceof Error ? err.message : String(err)
      // Silent fallback: restore pre-AI services to avoid partially-modified data
      services = originalServices
    }
  }

  // Final sanity filter: remove obviously wrong results that slipped through
  services = services.filter(s => {
    const name = s.name.toLowerCase()
    // Filter single-character or too-short names
    if (name.length < 3) return false
    // Filter Node.js builtins that somehow made it through
    const builtins = new Set(['child process', 'child_process', 'file system', 'event emitter', 'buffer', 'stream', 'crypto'])
    if (builtins.has(name)) return false
    // Filter names starting with $ (template vars)
    if (s.name.startsWith('$')) return false
    return true
  })

  // Step 3.5: Zombie detection (local repos only)
  if (repoPath && !repoPath.startsWith('github:')) {
    try {
      const zombieResults = await detectZombieServices(services, evidences, repoPath)
      services = enrichServicesWithZombieData(services, zombieResults)
    } catch {
      // Silently skip if git is unavailable or repo is not a git repo
    }
  }

  // Step 4: Infer flow graph
  const flow = inferFlowGraph(services, dependencies, projectName)

  // Step 4.5: Apply AI-inferred edge types
  if (deepAnalysis?.inferredEdgeTypes && deepAnalysis.inferredEdgeTypes.length > 0) {
    for (const ie of deepAnalysis.inferredEdgeTypes) {
      const nodeId = `svc-${ie.serviceId}`
      const edge = flow.edges.find((e) => e.target === nodeId || e.source === nodeId)
      if (edge) {
        edge.flowType = ie.flowType
      }
    }
  }

  return {
    services,
    dependencies,
    flowNodes: flow.nodes,
    flowEdges: flow.edges,
    deepAnalysis,
    aiError,
    aiFilteredCount,
  }
}

function mergeAIResults(services: Service[], aiResults: Partial<Service>[]): Service[] {
  const serviceMap = new Map(services.map(s => [s.id, s]))

  for (const aiSvc of aiResults) {
    if (!aiSvc.id || !aiSvc.name) continue

    const existing = serviceMap.get(aiSvc.id)
    if (existing) {
      // AI upgrades confidence if higher
      if (aiSvc.confidence && confidenceRank(aiSvc.confidence) > confidenceRank(existing.confidence ?? 'low')) {
        existing.confidence = aiSvc.confidence
        existing.needsReview = aiSvc.confidence === 'low'
      }
      if (existing.category === 'other' && aiSvc.category && aiSvc.category !== 'other') {
        existing.category = aiSvc.category
      }
      if (aiSvc.confidenceReasons) {
        existing.confidenceReasons = [
          ...(existing.confidenceReasons ?? []),
          ...aiSvc.confidenceReasons,
        ]
      }
    } else {
      // New service from AI
      serviceMap.set(aiSvc.id, {
        id: aiSvc.id,
        name: aiSvc.name,
        category: aiSvc.category ?? 'other',
        plan: 'unknown',
        source: 'inferred',
        confidence: aiSvc.confidence ?? 'medium',
        needsReview: (aiSvc.confidence ?? 'medium') === 'low',
        confidenceReasons: aiSvc.confidenceReasons,
        inferredFrom: aiSvc.inferredFrom ?? 'AI analysis',
      })
    }
  }

  return Array.from(serviceMap.values())
}

