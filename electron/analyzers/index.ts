import type { Service, AnalysisResult, Evidence, Dependency, AISettings, DeepAnalysisResult, ScanMode } from '../types'
import { extractEvidences, extractEvidencesFromGitHub } from './extractor'
import { classifyEvidences } from './heuristic'
import { deduplicateServices } from './deduplicator'
import { inferFlowGraph } from './flowInference'
import { enhanceWithAI } from '../ai/provider'
import { runDeepAnalysis, classifyEvidencesWithAI } from '../ai/deepAnalyzer'

export async function analyzeLocalRepo(
  folderPath: string,
  aiSettings?: AISettings,
  excludedServices?: string[],
): Promise<AnalysisResult> {
  const { evidences, dependencies, projectName } = await extractEvidences(folderPath)
  return runPipeline(evidences, dependencies, aiSettings, projectName, excludedServices, folderPath)
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
  const scanMode: ScanMode = aiSettings?.scanMode ?? 'heuristic'
  const aiEnabled = aiSettings?.enabled && aiSettings.provider
  const useHeuristics = scanMode !== 'ai-only' || !aiEnabled
  const useAI = aiEnabled && scanMode !== 'heuristic'

  // Step 1: Classify with heuristics (unless ai-only with working AI)
  let services: Service[] = []
  if (useHeuristics) {
    const heuristicResults = classifyEvidences(evidences, projectName)
    services = deduplicateServices(heuristicResults)
  }

  // Step 2: Filter excluded services (from graph deletions)
  if (excludedServices && excludedServices.length > 0) {
    const excluded = new Set(excludedServices)
    services = services.filter((s) => !excluded.has(s.id))
  }

  // Step 3: AI analysis
  let deepAnalysis: DeepAnalysisResult | undefined
  let aiError: string | undefined
  if (useAI) {
    try {
      // In ai-only mode, let AI classify the raw evidences first
      if (scanMode === 'ai-only') {
        const aiServices = await classifyEvidencesWithAI(
          evidences,
          repoPath ?? null,
          aiSettings!.provider,
        )
        services = aiServices
        if (excludedServices && excludedServices.length > 0) {
          const excluded = new Set(excludedServices)
          services = services.filter((s) => !excluded.has(s.id))
        }
      }

      // Deep analysis: context, hidden services, edge types
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
      // ai-only mode with failed AI: fall back to heuristics so user gets results
      if (scanMode === 'ai-only' && services.length === 0) {
        const heuristicResults = classifyEvidences(evidences, projectName)
        services = deduplicateServices(heuristicResults)
        if (excludedServices && excludedServices.length > 0) {
          const excluded = new Set(excludedServices)
          services = services.filter((s) => !excluded.has(s.id))
        }
        aiError += ' — showing heuristic results as fallback'
      }
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

function confidenceRank(c: string | undefined): number {
  if (c === 'high') return 3
  if (c === 'medium') return 2
  return 1
}
