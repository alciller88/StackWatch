import type { Evidence, Service, AIProvider, ServiceCategory } from '../types'

export const PRESET_PROVIDERS: AIProvider[] = [
  {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.1-8b-instant',
    recommended: true,
    localOnly: false,
    setupUrl: 'https://console.groq.com/keys',
    description: 'Free, no credit card required. Create your API key at groq.com.',
  },
  {
    name: 'Ollama',
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.2',
    recommended: true,
    localOnly: true,
    setupUrl: 'https://ollama.com',
    description: 'Free and local. Install Ollama and run: ollama pull llama3.2',
  },
  {
    name: 'LM Studio',
    baseUrl: 'http://localhost:1234/v1',
    model: 'local-model',
    recommended: false,
    localOnly: true,
    setupUrl: 'https://lmstudio.ai',
    description: 'Local. Download LM Studio and load any GGUF model.',
  },
  {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    recommended: false,
    localOnly: false,
    setupUrl: 'https://platform.openai.com/api-keys',
    description: 'Pay per use.',
  },
  {
    name: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    model: 'mistral-small-latest',
    recommended: false,
    localOnly: false,
    setupUrl: 'https://console.mistral.ai',
    description: 'Pay per use.',
  },
  {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-haiku-4-5-20251001',
    recommended: false,
    localOnly: false,
    setupUrl: 'https://console.anthropic.com',
    description: 'Pay per use.',
  },
  {
    name: 'Custom',
    baseUrl: '',
    model: '',
    recommended: false,
    localOnly: false,
    description: 'Any endpoint compatible with the OpenAI API.',
  },
]

interface AIServiceResult {
  name: string
  category: ServiceCategory
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

export async function enhanceWithAI(
  ambiguousEvidences: Evidence[],
  provider: AIProvider,
): Promise<Partial<Service>[]> {
  if (ambiguousEvidences.length === 0) return []

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (provider.apiKey) {
      headers['Authorization'] = `Bearer ${provider.apiKey}`
    }

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: provider.model,
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Identify external services from these code evidences. Return ONLY a valid JSON array, no explanation.
Each item: { "name": string, "category": string, "confidence": "high"|"medium"|"low", "reason": string }
Categories: hosting, database, payments, email, analytics, monitoring, cdn, storage, auth, cicd, ai, messaging, domain, infra, other

Evidences:
${JSON.stringify(ambiguousEvidences, null, 2)}`,
        }],
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      return []
    }

    const data = await response.json()
    const text: string = data.choices?.[0]?.message?.content ?? ''
    const clean = text.replace(/```json|```/g, '').trim()

    const parsed: AIServiceResult[] = JSON.parse(clean)
    if (!Array.isArray(parsed)) return []

    return parsed.map(item => ({
      id: item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: item.name,
      category: item.category as ServiceCategory,
      confidence: item.confidence,
      source: 'inferred' as const,
      confidenceReasons: [item.reason],
      inferredFrom: item.reason,
    }))
  } catch {
    // Silent fallback — return empty, heuristic results will be used
    return []
  }
}

export async function testConnection(provider: AIProvider): Promise<{ ok: boolean; error?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (provider.apiKey) {
      headers['Authorization'] = `Bearer ${provider.apiKey}`
    }

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: provider.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Reply with "ok"' }],
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      const body = await response.text()
      return { ok: false, error: `HTTP ${response.status}: ${body.slice(0, 200)}` }
    }

    const data = await response.json()
    if (data.choices?.[0]?.message?.content) {
      return { ok: true }
    }

    return { ok: false, error: 'Unexpected response format' }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
