import type { Service, AIProvider, AlternativeSuggestion, Alternative } from '../types'
import { callAI, safeParseJSON } from './deepAnalyzer'
import { sanitizeForPrompt } from './sanitize'

export async function suggestAlternatives(
  services: Service[],
  provider: AIProvider,
): Promise<AlternativeSuggestion[]> {
  // Only suggest alternatives for paid/trial services or high-confidence commercial services
  const targetServices = services.filter(s =>
    s.plan === 'paid' || s.plan === 'trial' || s.confidence === 'high'
  )

  if (targetServices.length === 0) return []

  const serviceList = targetServices
    .map((s, i) => `${i + 1}. ${sanitizeForPrompt(s.name)} (${sanitizeForPrompt(s.category)}, ${s.plan})`)
    .join('\n')

  const prompt = `You are a software infrastructure advisor. Given these services used by a project, suggest 1-2 cheaper or open-source alternatives for each.

Services:
${serviceList}

For each service, respond with ONLY a valid JSON array:
[
  {
    "id": 1,
    "alternatives": [
      {
        "name": "Alternative Name",
        "reason": "Brief reason under 80 chars",
        "type": "cheaper" or "open-source" or "self-hosted",
        "estimatedSavings": "optional savings estimate",
        "url": "https://example.com"
      }
    ]
  }
]

Rules:
- Only suggest real, actively maintained alternatives
- "open-source" means fully self-hostable
- "self-hosted" means can run on own infrastructure
- "cheaper" means lower cost for similar functionality
- If no good alternative exists, return empty alternatives array
- Maximum 2 alternatives per service
- Keep reasons under 80 characters`

  try {
    const text = await callAI(provider, prompt, 2000)
    const parsed = safeParseJSON<any[]>(text, [])
    if (!Array.isArray(parsed)) return []

    const results: AlternativeSuggestion[] = []

    for (const item of parsed) {
      const idx = Number(item.id) - 1
      if (idx < 0 || idx >= targetServices.length) continue
      if (!Array.isArray(item.alternatives)) continue

      const service = targetServices[idx]
      const alternatives: Alternative[] = item.alternatives
        .slice(0, 2)
        .filter((a: Record<string, unknown>) => a.name && a.reason && a.type)
        .map((a: Record<string, unknown>) => {
          const validTypes: readonly string[] = ['cheaper', 'open-source', 'self-hosted']
          const type = validTypes.includes(String(a.type)) ? String(a.type) : 'cheaper'
          return {
            name: String(a.name),
            reason: String(a.reason).slice(0, 80),
            type: type as Alternative['type'],
            ...(a.estimatedSavings ? { estimatedSavings: String(a.estimatedSavings) } : {}),
            ...(a.url ? { url: String(a.url) } : {}),
          }
        })

      if (alternatives.length > 0) {
        results.push({
          serviceId: service.id,
          serviceName: service.name,
          alternatives,
        })
      }
    }

    return results
  } catch {
    return []
  }
}
