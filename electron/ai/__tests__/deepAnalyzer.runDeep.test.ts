import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Service, Evidence, AIProvider } from '../../types'

// Mock fs/promises at module level (vi.mock is hoisted)
const mockReadFile = vi.hoisted(() => vi.fn().mockResolvedValue('const stripe = require("stripe");\nstripe.charges.create({});'))

vi.mock('fs/promises', () => ({
  __esModule: true,
  default: { readFile: mockReadFile },
  readFile: mockReadFile,
}))

import { callAI, runDeepAnalysis } from '../deepAnalyzer'

// ── Helpers ──

function mockService(id: string, name: string, category: string, confidence: string): Service {
  return {
    id,
    name,
    category: category as any,
    plan: 'unknown',
    source: 'inferred',
    confidence: confidence as any,
    inferredFrom: 'package.json',
  }
}

const testProvider: AIProvider = {
  name: 'test',
  baseUrl: 'http://localhost:1234/v1',
  model: 'test-model',
  apiKey: 'test-key',
}

function mockFetchResponse(content: string) {
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content } }],
    }),
  }
}

// ── callAI ──

describe('callAI', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.clearAllMocks()
  })

  it('sends correct request and returns parsed content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse('{"result": true}')))

    const result = await callAI(testProvider, 'test prompt', 500)

    expect(result).toBe('{"result": true}')
    const fetchCall = (globalThis.fetch as any).mock.calls[0]
    expect(fetchCall[0]).toBe('http://localhost:1234/v1/chat/completions')
    const body = JSON.parse(fetchCall[1].body)
    expect(body.model).toBe('test-model')
    expect(body.max_tokens).toBe(500)
    expect(body.messages[0].content).toBe('test prompt')
  })

  it('strips markdown code fences from response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse('```json\n{"a":1}\n```')))

    const result = await callAI(testProvider, 'prompt', 500)

    expect(result).toBe('{"a":1}')
  })

  it('includes Authorization header when apiKey is set', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse('"ok"')))

    await callAI(testProvider, 'prompt', 100)

    const headers = (globalThis.fetch as any).mock.calls[0][1].headers
    expect(headers['Authorization']).toBe('Bearer test-key')
  })

  it('omits Authorization header when apiKey is undefined', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse('"ok"')))
    const providerNoKey: AIProvider = { ...testProvider, apiKey: undefined }

    await callAI(providerNoKey, 'prompt', 100)

    const headers = (globalThis.fetch as any).mock.calls[0][1].headers
    expect(headers['Authorization']).toBeUndefined()
  })

  it('throws on non-ok HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))

    await expect(callAI(testProvider, 'prompt', 100)).rejects.toThrow('AI HTTP 500')
  })

  it('throws on empty choices array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [] }),
    }))

    await expect(callAI(testProvider, 'prompt', 100)).rejects.toThrow('AI returned empty response')
  })

  it('truncates prompts exceeding MAX_PROMPT_CHARS', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse('"ok"')))
    const longPrompt = 'x'.repeat(7000)

    await callAI(testProvider, longPrompt, 100)

    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body)
    expect(body.messages[0].content.length).toBeLessThan(longPrompt.length)
    expect(body.messages[0].content).toContain('[... truncated for size]')
  })
})

// ── runDeepAnalysis ──

describe('runDeepAnalysis', () => {
  let originalFetch: typeof globalThis.fetch
  let fetchCallCount: number

  beforeEach(() => {
    originalFetch = globalThis.fetch
    fetchCallCount = 0
    // Re-setup fs mock after vi.clearAllMocks from callAI tests
    mockReadFile.mockResolvedValue('const stripe = require("stripe");\nstripe.charges.create({});')
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.clearAllMocks()
  })

  it('returns serviceContexts, hiddenServices, and inferredEdgeTypes', async () => {
    const responses = [
      // Step A: service context for stripe
      JSON.stringify({
        usage: 'Stripe is used for payment processing',
        criticalityLevel: 'critical',
        usageLocations: ['src/payments.ts:10'],
        warnings: [],
      }),
      // Step B: hidden services detection
      JSON.stringify([
        {
          name: 'SendGrid',
          category: 'email',
          confidence: 'medium',
          reason: 'Found SENDGRID_API_KEY in .env',
          inferredFrom: 'AI deep analysis: .env',
        },
      ]),
      // Step C: infer edge types
      JSON.stringify([
        { serviceId: 'stripe', flowType: 'payment', reason: 'Payment processing' },
      ]),
    ]

    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      const content = responses[fetchCallCount] ?? '[]'
      fetchCallCount++
      return Promise.resolve(mockFetchResponse(content))
    }))

    const services = [
      mockService('stripe', 'Stripe', 'payments', 'high'),
    ]
    // Use a .ts file as evidence so selectFilesForHiddenDetection picks it up
    const evidences: Evidence[] = [
      { type: 'npm_package', value: 'stripe', file: 'src/payments.ts' },
    ]

    const result = await runDeepAnalysis(services, evidences, '/fake/repo', testProvider)

    expect(result.serviceContexts).toHaveLength(1)
    expect(result.serviceContexts[0].serviceId).toBe('stripe')
    expect(result.serviceContexts[0].usage).toBe('Stripe is used for payment processing')
    expect(result.serviceContexts[0].criticalityLevel).toBe('critical')

    expect(result.hiddenServices).toHaveLength(1)
    expect(result.hiddenServices[0].name).toBe('SendGrid')
    expect(result.hiddenServices[0].category).toBe('email')

    expect(result.inferredEdgeTypes).toHaveLength(1)
    expect(result.inferredEdgeTypes[0].serviceId).toBe('stripe')
    expect(result.inferredEdgeTypes[0].flowType).toBe('payment')
  })

  it('returns empty hiddenServices when AI returns empty array', async () => {
    const responses = [
      // Step A: context
      JSON.stringify({
        usage: 'Redis is used for caching',
        criticalityLevel: 'important',
        usageLocations: [],
        warnings: [],
      }),
      // Step B: no hidden services
      '[]',
      // Step C: edge types
      JSON.stringify([
        { serviceId: 'redis', flowType: 'data', reason: 'Cache reads/writes' },
      ]),
    ]

    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      const content = responses[fetchCallCount] ?? '[]'
      fetchCallCount++
      return Promise.resolve(mockFetchResponse(content))
    }))

    const services = [mockService('redis', 'Redis', 'database', 'high')]
    const evidences: Evidence[] = [
      { type: 'npm_package', value: 'redis', file: 'src/cache.ts' },
    ]

    const result = await runDeepAnalysis(services, evidences, '/fake/repo', testProvider)

    expect(result.hiddenServices).toEqual([])
    expect(result.serviceContexts).toHaveLength(1)
  })

  it('handles AI failure in hidden detection gracefully', async () => {
    let callIdx = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callIdx++
      if (callIdx === 2) {
        // Step B fails
        return Promise.resolve({ ok: false, status: 500 })
      }
      return Promise.resolve(mockFetchResponse(JSON.stringify(
        callIdx === 1
          ? { usage: 'Test', criticalityLevel: 'optional', usageLocations: [], warnings: [] }
          : [{ serviceId: 'svc1', flowType: 'data', reason: 'test' }]
      )))
    }))

    const services = [mockService('svc1', 'Svc1', 'other', 'high')]
    const evidences: Evidence[] = [
      { type: 'npm_package', value: 'svc1', file: 'src/svc1.ts' },
    ]

    const result = await runDeepAnalysis(services, evidences, '/fake/repo', testProvider)

    // Hidden detection fails silently, so hiddenServices should be empty
    expect(result.hiddenServices).toEqual([])
    expect(result.serviceContexts).toHaveLength(1)
  })

  it('skips low-confidence services in context analysis', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      fetchCallCount++
      return Promise.resolve(mockFetchResponse('[]'))
    }))

    const services = [
      mockService('maybe-svc', 'MaybeSvc', 'other', 'low'),
    ]
    const evidences: Evidence[] = [
      { type: 'npm_package', value: 'maybe-svc', file: 'src/maybe.ts' },
    ]

    const result = await runDeepAnalysis(services, evidences, '/fake/repo', testProvider)

    // Low confidence services are filtered out from context analysis
    expect(result.serviceContexts).toHaveLength(0)
  })

  it('returns fallback context when no relevant files match service', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      fetchCallCount++
      return Promise.resolve(mockFetchResponse('[]'))
    }))

    const services = [mockService('orphan', 'Orphan', 'other', 'high')]
    // Evidence value doesn't contain service name or id
    const evidences: Evidence[] = [
      { type: 'npm_package', value: 'unrelated-pkg', file: 'src/unrelated.ts' },
    ]

    const result = await runDeepAnalysis(services, evidences, '/fake/repo', testProvider)

    expect(result.serviceContexts).toHaveLength(1)
    expect(result.serviceContexts[0].serviceId).toBe('orphan')
    expect(result.serviceContexts[0].usage).toContain('Orphan')
    expect(result.serviceContexts[0].criticalityLevel).toBe('optional')
  })

  it('hidden services get valid IDs and normalized confidence', async () => {
    const responses = [
      // Step B: hidden with various confidence formats
      JSON.stringify([
        { name: 'Twilio API', category: 'messaging', confidence: 'HIGH', reason: 'Found env var' },
        { name: 'Redis Cloud', category: 'database', confidence: 'invalid', reason: 'SDK import' },
      ]),
      // Step C: edge types (no contexts so this won't be called)
    ]

    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      const content = responses[fetchCallCount] ?? '[]'
      fetchCallCount++
      return Promise.resolve(mockFetchResponse(content))
    }))

    // No services, so Step A is skipped entirely
    const services: Service[] = []
    // Evidence files must have valid code extensions for selectFilesForHiddenDetection
    const evidences: Evidence[] = [
      { type: 'import', value: 'twilio', file: 'src/lib/sms.ts' },
      { type: 'env_var', value: 'REDIS_URL', file: 'src/config.ts' },
    ]

    const result = await runDeepAnalysis(services, evidences, '/fake/repo', testProvider)

    expect(result.hiddenServices).toHaveLength(2)
    expect(result.hiddenServices[0].id).toBe('twilio-api')
    expect(result.hiddenServices[0].confidence).toBe('high')
    expect(result.hiddenServices[1].id).toBe('redis-cloud')
    expect(result.hiddenServices[1].confidence).toBe('medium')
  })
})
