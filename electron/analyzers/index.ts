import path from 'path'
import type { Service, AnalysisResult, Evidence, Dependency, AISettings, DeepAnalysisResult, DiscardedItem, ProgressCallback } from '../types'
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
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  // Emit initial progress immediately so the UI shows activity
  onProgress?.({ phase: 'Detecting project structure...', percent: 1, counts: { evidences: 0, services: 0, vulns: 0 } })
  if (signal?.aborted) throw new DOMException('Scan cancelled', 'AbortError')

  // Check for monorepo structure
  const mono = await detectMonorepo(folderPath)

  if (mono.type && mono.packages.length > 1) {
    // Monorepo: scan root + each package, merge results
    onProgress?.({ phase: `Scanning monorepo (${mono.packages.length} packages)...`, percent: 3, counts: { evidences: 0, services: 0, vulns: 0 } })
    return analyzeMonorepo(folderPath, mono.packages, mono.type, aiSettings, excludedServices, onProgress, signal)
  }

  // Single repo
  onProgress?.({ phase: 'Extracting evidences...', percent: 5, counts: { evidences: 0, services: 0, vulns: 0 } })
  if (signal?.aborted) throw new DOMException('Scan cancelled', 'AbortError')
  const { evidences, dependencies, projectName } = await extractEvidences(folderPath, onProgress, signal)
  onProgress?.({ phase: 'Extracting evidences...', percent: 20, counts: { evidences: evidences.length, services: 0, vulns: 0 } })
  return runPipeline(evidences, dependencies, aiSettings, projectName, excludedServices, folderPath, onProgress, signal)
}

async function analyzeMonorepo(
  rootPath: string,
  packagePaths: string[],
  monoType: string,
  aiSettings?: AISettings,
  excludedServices?: string[],
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  const rootName = path.basename(rootPath)

  // Scan root first (for shared config, CI, docker-compose, etc.)
  onProgress?.({ phase: 'Scanning root package...', percent: 5, counts: { evidences: 0, services: 0, vulns: 0 } })
  if (signal?.aborted) throw new DOMException('Scan cancelled', 'AbortError')
  const rootResult = await extractEvidences(rootPath, onProgress, signal)

  // Scan each package
  const allEvidences: Evidence[] = [...rootResult.evidences]
  const allDeps: Dependency[] = [...rootResult.dependencies]

  for (let i = 0; i < packagePaths.length; i++) {
    const pkgPath = packagePaths[i]
    if (signal?.aborted) throw new DOMException('Scan cancelled', 'AbortError')
    const pkgPercent = 5 + Math.round((i / packagePaths.length) * 12)
    onProgress?.({ phase: `Scanning package ${i + 1}/${packagePaths.length}...`, percent: pkgPercent, counts: { evidences: allEvidences.length, services: 0, vulns: 0 } })
    try {
      const pkgResult = await extractEvidences(pkgPath, onProgress, signal)
      // Tag evidences with package name
      const pkgName = path.basename(pkgPath)
      for (const ev of pkgResult.evidences) {
        ev.file = `${pkgName}/${ev.file}`
      }
      allEvidences.push(...pkgResult.evidences)
      allDeps.push(...pkgResult.dependencies)
    } catch (err: any) {
      // Re-throw cancellation, skip other failures
      if (err?.name === 'AbortError') throw err
    }
  }

  // Deduplicate dependencies (same name+ecosystem across packages)
  const uniqueDeps = deduplicateDeps(allDeps)

  onProgress?.({ phase: 'Extracting evidences...', percent: 20, counts: { evidences: allEvidences.length, services: 0, vulns: 0 } })
  const result = await runPipeline(allEvidences, uniqueDeps, aiSettings, rootName, excludedServices, rootPath, onProgress, signal)
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
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  onProgress?.({ phase: 'Extracting evidences...', percent: 5, counts: { evidences: 0, services: 0, vulns: 0 } })
  if (signal?.aborted) throw new DOMException('Scan cancelled', 'AbortError')
  const { evidences, dependencies, projectName } = await extractEvidencesFromGitHub(fetchFile, listDir)
  onProgress?.({ phase: 'Extracting evidences...', percent: 20, counts: { evidences: evidences.length, services: 0, vulns: 0 } })
  return runPipeline(evidences, dependencies, aiSettings, projectName, undefined, undefined, onProgress, signal)
}

async function runPipeline(
  evidences: Evidence[],
  dependencies: Dependency[],
  aiSettings: AISettings | undefined,
  projectName: string,
  excludedServices?: string[],
  repoPath?: string,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  const useAI = aiSettings?.enabled && aiSettings.provider && aiSettings.scanMode === 'hybrid'

  function checkAbort() {
    if (signal?.aborted) throw new DOMException('Scan cancelled', 'AbortError')
  }

  // Step 1: Heuristic classification (always runs)
  onProgress?.({ phase: 'Classifying services...', percent: 40, counts: { evidences: evidences.length, services: 0, vulns: 0 } })
  checkAbort()
  const heuristicResults = classifyEvidences(evidences, projectName)
  const dedupResult = deduplicateServices(heuristicResults)
  let services = dedupResult.services
  const discardedItems: DiscardedItem[] = [...dedupResult.discarded]
  onProgress?.({ phase: 'Deduplicating...', percent: 55, counts: { evidences: evidences.length, services: services.length, vulns: 0 } })
  checkAbort()

  // Note: excludedServices only affects the graph (filtered in graphStore.initFromAnalysis),
  // NOT the services list — users should see all detected services in the Services panel.

  // Helper: race a promise against a timeout
  function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
      ),
    ])
  }

  // Step 2.5: AI false-positive filter (hybrid mode, before full refinement)
  let aiFilteredCount: number | undefined
  if (useAI) {
    onProgress?.({ phase: 'Running AI filter...', percent: 70, counts: { evidences: evidences.length, services: services.length, vulns: 0 } })
    checkAbort()
    const preFilterServices = [...services]
    try {
      services = await withTimeout(
        filterFalsePositivesWithAI(services, aiSettings!.provider),
        30000, 'AI filter'
      )
      const kept = new Set(services.map(s => s.id))
      for (const s of preFilterServices) {
        if (!kept.has(s.id)) {
          discardedItems.push({
            name: s.name,
            reason: 'ai_filter',
            score: 0,
            evidences: s.confidenceReasons?.map(r => ({ type: 'reason', value: r, file: '' })) ?? [],
            category: s.category,
          })
        }
      }
      const removed = preFilterServices.length - services.length
      if (removed > 0) aiFilteredCount = removed
    } catch {
      // Silent fallback — filter is optional
    }
  }

  // Step 3: AI enhancement (hybrid mode)
  let deepAnalysis: DeepAnalysisResult | undefined
  let aiError: string | undefined
  if (useAI) {
    onProgress?.({ phase: 'Analyzing services...', percent: 80, counts: { evidences: evidences.length, services: services.length, vulns: 0 } })
    checkAbort()
    const originalServices = [...services]
    try {
      // Step 3a: AI validates/refines heuristic results
      services = await withTimeout(
        refineServicesWithAI(services, aiSettings!.provider),
        30000, 'AI refine'
      )

      // Step 3b: Deep analysis (service context, hidden services, edge types)
      deepAnalysis = await withTimeout(
        runDeepAnalysis(services, evidences, repoPath ?? null, aiSettings!.provider),
        30000, 'AI deep analysis'
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
    if (name.length < 3) return false
    const builtins = new Set(['child process', 'child_process', 'file system', 'event emitter', 'buffer', 'stream', 'crypto'])
    if (builtins.has(name)) return false
    if (s.name.startsWith('$')) return false
    return true
  })

  // If no AI, jump progress to 80%
  if (!useAI) {
    onProgress?.({ phase: 'Analyzing services...', percent: 80, counts: { evidences: evidences.length, services: services.length, vulns: 0 } })
  }

  checkAbort()

  // Step 3.5: Zombie detection (local repos only)
  if (repoPath && !repoPath.startsWith('github:')) {
    try {
      const zombieResults = await withTimeout(
        detectZombieServices(services, evidences, repoPath),
        30000, 'Zombie detection'
      )
      services = enrichServicesWithZombieData(services, zombieResults)
    } catch {
      // Silently skip if git is unavailable, repo is not git, or timeout
    }
  }

  // Step 4: Infer flow graph
  onProgress?.({ phase: 'Building graph...', percent: 90, counts: { evidences: evidences.length, services: services.length, vulns: 0 } })
  checkAbort()
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

  onProgress?.({ phase: 'Done', percent: 100, counts: { evidences: evidences.length, services: services.length, vulns: 0 } })

  return {
    services,
    dependencies,
    flowNodes: flow.nodes,
    flowEdges: flow.edges,
    deepAnalysis,
    aiError,
    aiFilteredCount,
    discardedItems,
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

