import type { Service, AnalysisResult, Evidence, Dependency, AISettings } from '../types'
import { extractEvidences, extractEvidencesFromGitHub } from './extractor'
import { classifyEvidences } from './heuristic'
import { deduplicateServices } from './deduplicator'
import { inferFlowGraph } from './flowInference'
import { enhanceWithAI } from '../ai/provider'

export async function analyzeLocalRepo(
  folderPath: string,
  aiSettings?: AISettings,
  excludedServices?: string[],
): Promise<AnalysisResult> {
  const { evidences, dependencies, projectName } = await extractEvidences(folderPath)
  return runPipeline(evidences, dependencies, aiSettings, projectName, excludedServices)
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
): Promise<AnalysisResult> {
  // Step 1: Classify with heuristics (pass projectName to filter own project)
  const heuristicResults = classifyEvidences(evidences, projectName)

  // Step 2: Deduplicate
  let services = deduplicateServices(heuristicResults)

  // Step 2.5: Filter excluded services (from graph deletions)
  if (excludedServices && excludedServices.length > 0) {
    const excluded = new Set(excludedServices)
    services = services.filter((s) => !excluded.has(s.id))
  }

  // Step 3: Optional AI enhancement for ambiguous cases
  if (aiSettings?.enabled && aiSettings.provider) {
    const ambiguous = findAmbiguousEvidences(evidences)
    if (ambiguous.length > 0) {
      const aiResults = await enhanceWithAI(ambiguous, aiSettings.provider)
      if (aiResults.length > 0) {
        services = mergeAIResults(services, aiResults)
      }
    }
  }

  // Step 4: Infer flow graph
  const flow = inferFlowGraph(services, dependencies, projectName)

  return {
    services,
    dependencies,
    flowNodes: flow.nodes,
    flowEdges: flow.edges,
  }
}

function findAmbiguousEvidences(evidences: Evidence[]): Evidence[] {
  return evidences.filter(ev => {
    const results = classifyEvidences([ev])
    return results.length === 0 || results.some(r => r.confidence === 'low')
  })
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
