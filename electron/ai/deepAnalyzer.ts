import fs from 'fs/promises'
import path from 'path'
import type {
  Service,
  Evidence,
  AIProvider,
  ServiceContext,
  DeepAnalysisResult,
  FlowEdge,
  ServiceCategory,
} from '../types'

const MAX_FILES_PER_SERVICE = 5
const MAX_FILES_HIDDEN_DETECTION = 10
const MAX_LINES_PER_FILE = 500

// ── AI call helper ──

async function callAI(provider: AIProvider, prompt: string, maxTokens: number): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (provider.apiKey) {
    headers['Authorization'] = `Bearer ${provider.apiKey}`
  }

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: provider.model,
      max_tokens: maxTokens,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(60000),
  })

  if (!response.ok) throw new Error(`AI HTTP ${response.status}`)

  const data = await response.json()
  const text: string = data.choices?.[0]?.message?.content ?? ''
  return text.replace(/```json|```/g, '').trim()
}

function safeParseJSON<T>(text: string, fallback: T): T {
  try {
    const parsed = JSON.parse(text)
    return parsed as T
  } catch {
    return fallback
  }
}

// ── File reading ──

async function readFileContent(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath, 'utf-8')
  const lines = content.split('\n')
  if (lines.length > MAX_LINES_PER_FILE) {
    return lines.slice(0, MAX_LINES_PER_FILE).join('\n') + '\n[... truncated]'
  }
  return content
}

function getRelevantFiles(
  service: Service,
  evidences: Evidence[],
): string[] {
  const normalizedName = service.name.toLowerCase().replace(/\s/g, '')
  const normalizedId = service.id.toLowerCase()

  return evidences
    .filter((e) => {
      const val = e.value.toLowerCase()
      return val.includes(normalizedName) || val.includes(normalizedId)
    })
    .map((e) => e.file)
    .filter((f, i, arr) => arr.indexOf(f) === i)
    .slice(0, MAX_FILES_PER_SERVICE)
}

function selectFilesForHiddenDetection(
  allFiles: string[],
): string[] {
  const priorityDirs = [
    'lib/', 'libs/', 'services/', 'api/', 'utils/', 'helpers/',
    'src/lib/', 'src/services/', 'src/api/', 'src/utils/',
    'middleware', 'config', 'client',
  ]

  const scored = allFiles
    .filter((f) => {
      const ext = path.extname(f)
      return ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs'].includes(ext)
    })
    .map((f) => {
      const priority = priorityDirs.some((d) => f.includes(d)) ? 1 : 0
      return { file: f, priority }
    })
    .sort((a, b) => b.priority - a.priority)

  return scored.slice(0, MAX_FILES_HIDDEN_DETECTION).map((s) => s.file)
}

// ── Step A: Service context analysis ──

async function analyzeServiceContext(
  service: Service,
  relevantFiles: { path: string; content: string }[],
  provider: AIProvider,
): Promise<ServiceContext> {
  const prompt = `You are analyzing a software project.

Service detected: ${service.name} (category: ${service.category})
Inferred from: ${service.inferredFrom ?? 'code analysis'}

Relevant code files where this service appears:
${relevantFiles.map((f) => `--- ${f.path} ---\n${f.content}`).join('\n\n')}

Analyze how this service is used and respond with ONLY valid JSON (no explanation):
{
  "usage": "one sentence describing exactly how this service is used in this project",
  "criticalityLevel": "critical" or "important" or "optional",
  "usageLocations": ["file.ts:lineNumber", ...],
  "warnings": ["description of any issue found"] or []
}

Rules:
- "critical" = used in every request or core functionality breaks without it
- "important" = significant feature depends on it but app still works without it
- "optional" = nice-to-have, background tasks, or rarely used
- Only include warnings for real issues: hardcoded secrets, missing error handling, deprecated APIs
- usageLocations should reference actual file paths and approximate line numbers from the code above`

  const text = await callAI(provider, prompt, 500)
  const parsed = safeParseJSON(text, {
    usage: 'Unable to determine usage',
    criticalityLevel: 'optional' as const,
    usageLocations: [] as string[],
    warnings: [] as string[],
  })

  return {
    serviceId: service.id,
    usage: parsed.usage ?? 'Unable to determine usage',
    criticalityLevel: parsed.criticalityLevel ?? 'optional',
    usageLocations: Array.isArray(parsed.usageLocations) ? parsed.usageLocations : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.filter(Boolean) : [],
  }
}

// ── Step B: Hidden service detection ──

async function detectHiddenServices(
  existingServices: Service[],
  codeFiles: { path: string; content: string }[],
  provider: AIProvider,
): Promise<Service[]> {
  const knownNames = existingServices.map((s) => s.name.toLowerCase())

  const prompt = `You are analyzing a software project to find external service dependencies that were NOT detected by static analysis.

Already detected services: ${knownNames.join(', ') || '(none)'}

Source code files:
${codeFiles.map((f) => `--- ${f.path} ---\n${f.content}`).join('\n\n')}

Find any external services, APIs, or platforms used in this code that are NOT in the already detected list. Look for:
- Custom API clients or wrappers calling external URLs
- SDK initializations for third-party services
- Environment variables suggesting external services (e.g., SOME_SERVICE_KEY)
- Indirect service consumption through imported libraries

Return ONLY a valid JSON array. Empty array [] if nothing new found.
Each item: {
  "name": "Service Name",
  "category": one of: "domain","hosting","cicd","database","auth","payments","email","analytics","monitoring","cdn","storage","infra","ai","mobile","gaming","data","messaging","support","other",
  "confidence": "high" or "medium" or "low",
  "reason": "what evidence you found and where",
  "inferredFrom": "AI deep analysis: file.ts"
}`

  const text = await callAI(provider, prompt, 1000)
  const parsed = safeParseJSON<any[]>(text, [])
  if (!Array.isArray(parsed)) return []

  return parsed
    .filter((s) => s.name && s.category)
    .map((s) => ({
      id: String(s.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      name: String(s.name),
      category: s.category as ServiceCategory,
      plan: 'unknown' as const,
      source: 'inferred' as const,
      confidence: (s.confidence ?? 'medium') as 'high' | 'medium' | 'low',
      needsReview: s.confidence === 'low',
      confidenceReasons: [s.reason ?? 'Detected by AI deep analysis'],
      inferredFrom: s.inferredFrom ?? 'AI deep analysis',
    }))
}

// ── Step C: Graph edge type inference ──

async function inferEdgeTypes(
  services: Service[],
  contexts: ServiceContext[],
  provider: AIProvider,
): Promise<{ serviceId: string; flowType: FlowEdge['flowType']; reason: string }[]> {
  const serviceDescriptions = contexts.map((ctx) => {
    const svc = services.find((s) => s.id === ctx.serviceId)
    return `- ${svc?.name ?? ctx.serviceId} (${svc?.category ?? 'other'}): ${ctx.usage}`
  })

  const prompt = `Given these services and how they are used in a software project, determine the correct connection type between the app and each service.

Services and their usage:
${serviceDescriptions.join('\n')}

Connection types:
- "data": general data flow — read/write operations, API calls for content, CRUD, caching, queues
- "auth": authentication or authorization flow — login, session management, OAuth, JWT verification
- "payment": payment processing — charges, subscriptions, invoices, checkout
- "webhook": the external service calls back into your app — webhooks, event callbacks, push notifications

Return ONLY a valid JSON array:
[{ "serviceId": "service-id", "flowType": "data" or "auth" or "payment" or "webhook", "reason": "brief explanation" }]`

  const text = await callAI(provider, prompt, 500)
  const parsed = safeParseJSON<any[]>(text, [])
  if (!Array.isArray(parsed)) return []

  return parsed
    .filter((e) => e.serviceId && e.flowType)
    .map((e) => ({
      serviceId: String(e.serviceId),
      flowType: e.flowType as FlowEdge['flowType'],
      reason: String(e.reason ?? ''),
    }))
}

// ── Orchestrator ──

export async function runDeepAnalysis(
  services: Service[],
  evidences: Evidence[],
  repoPath: string | null,
  provider: AIProvider,
): Promise<DeepAnalysisResult> {
  // Collect files to read
  const filesToRead = new Map<string, string>()

  // Read relevant files for each service
  const servicesToAnalyze = services.filter(
    (s) => s.confidence === 'high' || s.confidence === 'medium',
  )

  for (const svc of servicesToAnalyze) {
    const files = getRelevantFiles(svc, evidences)
    for (const f of files) {
      if (!filesToRead.has(f) && repoPath) {
        try {
          const fullPath = path.join(repoPath, f)
          filesToRead.set(f, await readFileContent(fullPath))
        } catch { /* skip unreadable files */ }
      }
    }
  }

  // Also find files for hidden detection
  const allEvidenceFiles = [...new Set(evidences.map((e) => e.file))]
  const hiddenDetectionFiles = selectFilesForHiddenDetection(allEvidenceFiles)
  for (const f of hiddenDetectionFiles) {
    if (!filesToRead.has(f) && repoPath) {
      try {
        const fullPath = path.join(repoPath, f)
        filesToRead.set(f, await readFileContent(fullPath))
      } catch { /* skip */ }
    }
  }

  // Run all three steps in parallel
  const [contexts, hiddenServices, edgeTypes] = await Promise.all([
    // Step A: Analyze context for each service (run in parallel, max 5 concurrently)
    analyzeAllServiceContexts(servicesToAnalyze, evidences, filesToRead, provider),

    // Step B: Detect hidden services
    (async () => {
      const codeFiles = hiddenDetectionFiles
        .filter((f) => filesToRead.has(f))
        .map((f) => ({ path: f, content: filesToRead.get(f)! }))
      if (codeFiles.length === 0) return []
      try {
        return await detectHiddenServices(services, codeFiles, provider)
      } catch {
        return []
      }
    })(),

    // Step C will run after A completes — we need contexts for it
    Promise.resolve([]),
  ])

  // Step C: Now infer edge types with the contexts we have
  let inferredEdges: { serviceId: string; flowType: FlowEdge['flowType']; reason: string }[] = []
  if (contexts.length > 0) {
    try {
      inferredEdges = await inferEdgeTypes(
        [...services, ...hiddenServices],
        contexts,
        provider,
      )
    } catch { /* fallback to heuristic edge types */ }
  }

  return {
    serviceContexts: contexts,
    hiddenServices,
    inferredEdgeTypes: inferredEdges,
  }
}

async function analyzeAllServiceContexts(
  services: Service[],
  evidences: Evidence[],
  filesToRead: Map<string, string>,
  provider: AIProvider,
): Promise<ServiceContext[]> {
  const results: ServiceContext[] = []

  // Process in batches of 3 to avoid rate limiting
  const batchSize = 3
  for (let i = 0; i < services.length; i += batchSize) {
    const batch = services.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(async (svc) => {
        const relevantFilePaths = getRelevantFiles(svc, evidences)
        const relevantFiles = relevantFilePaths
          .filter((f) => filesToRead.has(f))
          .map((f) => ({ path: f, content: filesToRead.get(f)! }))

        if (relevantFiles.length === 0) {
          return {
            serviceId: svc.id,
            usage: `${svc.name} detected from ${svc.inferredFrom ?? 'code analysis'}`,
            criticalityLevel: 'optional' as const,
            usageLocations: [],
          }
        }

        try {
          return await analyzeServiceContext(svc, relevantFiles, provider)
        } catch {
          return {
            serviceId: svc.id,
            usage: `${svc.name} detected from ${svc.inferredFrom ?? 'code analysis'}`,
            criticalityLevel: 'optional' as const,
            usageLocations: [],
          }
        }
      }),
    )
    results.push(...batchResults)
  }

  return results
}
