import type { Service, AnalysisResult, Evidence, AISettings } from '../types'
import { extractEvidences, extractEvidencesFromGitHub } from './extractor'
import { classifyEvidences } from './heuristic'
import { deduplicateServices } from './deduplicator'
import { inferFlowGraph } from './flowInference'
import { enhanceWithAI } from '../ai/provider'

export async function analyzeLocalRepo(
  folderPath: string,
  aiSettings?: AISettings,
): Promise<AnalysisResult> {
  // Step 1: Extract evidences
  const { evidences, dependencies } = await extractEvidences(folderPath)

  // Step 2: Classify with heuristics
  const heuristicResults = classifyEvidences(evidences)

  // Step 3: Deduplicate
  let services = deduplicateServices(heuristicResults)

  // Step 4: Optional AI enhancement for ambiguous cases
  if (aiSettings?.enabled && aiSettings.provider) {
    const ambiguous = evidences.filter(ev => {
      const classified = classifyEvidences([ev])
      return classified.length === 0 || classified.some(c => c.confidence === 'low')
    })
    if (ambiguous.length > 0) {
      const aiResults = await enhanceWithAI(ambiguous, aiSettings.provider)
      if (aiResults.length > 0) {
        services = mergeAIResults(services, aiResults)
      }
    }
  }

  // Step 5: Infer flow graph
  const flow = inferFlowGraph(services, dependencies)

  return {
    services,
    dependencies,
    flowNodes: flow.nodes,
    flowEdges: flow.edges,
  }
}

export async function analyzeGitHubRepo(
  fetchFile: (path: string) => Promise<string | null>,
  listDir: (path: string) => Promise<string[]>,
  aiSettings?: AISettings,
): Promise<AnalysisResult> {
  const { inferFlowGraph } = await import('./flowInference')

  // Step 1: Extract evidences
  const { evidences, dependencies } = await extractEvidencesFromGitHub(fetchFile, listDir)

  // Step 2: Classify with heuristics
  const heuristicResults = classifyEvidences(evidences)

  // Step 3: Deduplicate
  let services = deduplicateServices(heuristicResults)

  // Step 4: Optional AI enhancement
  if (aiSettings?.enabled && aiSettings.provider) {
    const ambiguous = evidences.filter(ev => {
      const classified = classifyEvidences([ev])
      return classified.length === 0 || classified.some(c => c.confidence === 'low')
    })
    if (ambiguous.length > 0) {
      const aiResults = await enhanceWithAI(ambiguous, aiSettings.provider)
      if (aiResults.length > 0) {
        services = mergeAIResults(services, aiResults)
      }
    }
  }

  // Step 5: Infer flow graph
  const flow = inferFlowGraph(services, dependencies)

  return {
    services,
    dependencies,
    flowNodes: flow.nodes,
    flowEdges: flow.edges,
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
