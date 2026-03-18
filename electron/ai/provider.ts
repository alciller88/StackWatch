import type { AIProvider } from '../types'

export const PRESET_PROVIDERS: AIProvider[] = [
  {
    name: 'Local',
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.2',
    recommended: true,
    localOnly: true,
    setupUrl: 'https://ollama.com',
    description: 'Free and private. Runs on your machine via Ollama or LM Studio.',
  },
  {
    name: 'Cloud (Groq)',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.1-8b-instant',
    recommended: true,
    localOnly: false,
    setupUrl: 'https://console.groq.com/keys',
    description: 'Free cloud AI, no credit card required.',
  },
  {
    name: 'Custom',
    baseUrl: '',
    model: '',
    recommended: false,
    localOnly: false,
    description: 'Any OpenAI-compatible endpoint (OpenAI, Mistral, Anthropic, etc.).',
  },
]

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

    const responseText = await response.text()
    if (responseText.length > 10 * 1024 * 1024) {
      return { ok: false, error: 'AI response too large' }
    }
    let data
    try {
      data = JSON.parse(responseText)
    } catch {
      return { ok: false, error: 'Invalid JSON response from AI provider' }
    }
    if (data.choices?.[0]?.message?.content) {
      return { ok: true }
    }

    return { ok: false, error: 'Unexpected response format' }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
