import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Service, AIProvider } from '../../types'
import { safeParseJSON, refineServicesWithAI, filterFalsePositivesWithAI } from '../deepAnalyzer'

// ── Helpers ──

function mockService(id: string, name: string, category: string, confidence: string): Service {
  return {
    id,
    name,
    category: category as any,
    plan: 'unknown',
    source: 'inferred',
    confidence: confidence as any,
  }
}

const testProvider: AIProvider = {
  name: 'test',
  baseUrl: 'http://localhost:1234/v1',
  model: 'test-model',
  apiKey: 'test-key',
}

function mockFetchResponse(content: string) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [{ message: { content } }],
    }),
  })
}

// ── safeParseJSON ──

describe('safeParseJSON', () => {
  it('returns parsed value for valid JSON', () => {
    const result = safeParseJSON('{"a":1,"b":"hello"}', {})
    expect(result).toEqual({ a: 1, b: 'hello' })
  })

  it('returns fallback for invalid JSON', () => {
    const fallback = { default: true }
    const result = safeParseJSON('not valid json {{{', fallback)
    expect(result).toBe(fallback)
  })

  it('returns fallback for empty string', () => {
    const fallback = [1, 2, 3]
    const result = safeParseJSON('', fallback)
    expect(result).toBe(fallback)
  })

  it('parses arrays correctly', () => {
    const result = safeParseJSON('[1,2,3]', [])
    expect(result).toEqual([1, 2, 3])
  })

  it('parses null and primitive values', () => {
    expect(safeParseJSON('null', 'fallback')).toBeNull()
    expect(safeParseJSON('42', 0)).toBe(42)
    expect(safeParseJSON('"text"', '')).toBe('text')
  })
})

// ── refineServicesWithAI ──

describe('refineServicesWithAI', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('skips refinement when all services are high confidence (no fetch called)', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const services = [
      mockService('redis', 'Redis', 'database', 'high'),
      mockService('stripe', 'Stripe', 'payments', 'high'),
    ]
    const result = await refineServicesWithAI(services, testProvider)

    expect(result).toEqual(services)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns services unchanged when AI returns empty {}', async () => {
    vi.stubGlobal('fetch', mockFetchResponse('{}'))

    const services = [
      mockService('redis', 'Redis', 'database', 'medium'),
      mockService('stripe', 'Stripe', 'payments', 'medium'),
    ]

    const result = await refineServicesWithAI(services, testProvider)

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('redis')
    expect(result[1].id).toBe('stripe')
    expect(result[0].category).toBe('database')
    expect(result[1].category).toBe('payments')
  })

  it('removes false positives based on AI response (medium/low only)', async () => {
    // toRefine = [lodash(low), stripe(medium)], so AI index 1 = lodash
    vi.stubGlobal('fetch', mockFetchResponse('{"remove":[1]}'))

    const services = [
      mockService('redis', 'Redis', 'database', 'high'),
      mockService('lodash', 'Lodash', 'other', 'low'),
      mockService('stripe', 'Stripe', 'payments', 'medium'),
    ]

    const result = await refineServicesWithAI(services, testProvider)

    // redis(high) kept untouched, lodash removed, stripe kept
    expect(result).toHaveLength(2)
    expect(result.map(s => s.id)).toEqual(['redis', 'stripe'])
    expect(result.find(s => s.id === 'lodash')).toBeUndefined()
  })

  it('fixes categories based on AI response (medium/low services only)', async () => {
    // Only supabase(medium) is sent to AI as index 1
    vi.stubGlobal('fetch', mockFetchResponse('{"category":{"1":"database"}}'))

    const services = [
      mockService('supabase', 'Supabase', 'other', 'medium'),
      mockService('stripe', 'Stripe', 'payments', 'high'),
    ]

    const result = await refineServicesWithAI(services, testProvider)

    expect(result).toHaveLength(2)
    // stripe(high) is first in result (high come first), supabase after
    const supabase = result.find(s => s.id === 'supabase')
    expect(supabase?.category).toBe('database')
    // stripe unchanged
    const stripe = result.find(s => s.id === 'stripe')
    expect(stripe?.category).toBe('payments')
  })

  it('adjusts confidence based on AI response', async () => {
    vi.stubGlobal('fetch', mockFetchResponse('{"confidence":{"1":"high"}}'))

    const services = [
      mockService('redis', 'Redis', 'database', 'low'),
      mockService('stripe', 'Stripe', 'payments', 'medium'),
    ]

    const result = await refineServicesWithAI(services, testProvider)

    const redis = result.find(s => s.id === 'redis')
    expect(redis?.confidence).toBe('high')
    expect(redis?.needsReview).toBe(false)
    // Other service unchanged
    const stripe = result.find(s => s.id === 'stripe')
    expect(stripe?.confidence).toBe('medium')
  })

  it('sets needsReview true when confidence adjusted to low', async () => {
    // toRefine = [redis(medium), stripe(medium)], AI adjusts index 1 = redis to low
    vi.stubGlobal('fetch', mockFetchResponse('{"confidence":{"1":"low"}}'))

    const services = [
      mockService('redis', 'Redis', 'database', 'medium'),
      mockService('stripe', 'Stripe', 'payments', 'medium'),
    ]

    const result = await refineServicesWithAI(services, testProvider)

    const redis = result.find(s => s.id === 'redis')
    expect(redis?.confidence).toBe('low')
    expect(redis?.needsReview).toBe(true)
  })

  it('merges duplicates, keeping first and absorbing confidenceReasons', async () => {
    // toRefine = [postgres(medium), pg(medium)], AI merges them
    vi.stubGlobal('fetch', mockFetchResponse('{"merge":[[1,2]]}'))

    const services = [
      { ...mockService('postgres', 'PostgreSQL', 'database', 'medium'), confidenceReasons: ['Found in package.json'] },
      { ...mockService('pg', 'Pg', 'database', 'medium'), confidenceReasons: ['Found in .env'] },
      mockService('stripe', 'Stripe', 'payments', 'high'),
    ]

    const result = await refineServicesWithAI(services, testProvider)

    // stripe(high) kept, pg merged into postgres
    expect(result).toHaveLength(2)
    const postgres = result.find(s => s.id === 'postgres')
    expect(postgres).toBeDefined()
    expect(postgres!.confidenceReasons).toContain('Found in package.json')
    expect(postgres!.confidenceReasons).toContain('Found in .env')
    expect(result.find(s => s.id === 'stripe')).toBeDefined()
  })

  it('handles malformed AI response gracefully (returns original services)', async () => {
    vi.stubGlobal('fetch', mockFetchResponse('Sorry, I cannot process that request. Here is some random text.'))

    const services = [
      mockService('redis', 'Redis', 'database', 'medium'),
      mockService('stripe', 'Stripe', 'payments', 'medium'),
    ]

    const result = await refineServicesWithAI(services, testProvider)

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('redis')
    expect(result[1].id).toBe('stripe')
  })

  it('handles fetch error gracefully (throws, caller catches)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const services = [
      mockService('redis', 'Redis', 'database', 'medium'),
      mockService('stripe', 'Stripe', 'payments', 'medium'),
    ]

    await expect(refineServicesWithAI(services, testProvider)).rejects.toThrow('Network error')
  })

  it('handles non-ok HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
    }))

    const services = [
      mockService('redis', 'Redis', 'database', 'medium'),
      mockService('stripe', 'Stripe', 'payments', 'medium'),
    ]

    await expect(refineServicesWithAI(services, testProvider)).rejects.toThrow('AI HTTP 429')
  })

  it('ignores invalid category in AI response', async () => {
    vi.stubGlobal('fetch', mockFetchResponse('{"category":{"1":"not-a-real-category"}}'))

    const services = [
      mockService('redis', 'Redis', 'database', 'medium'),
      mockService('stripe', 'Stripe', 'payments', 'medium'),
    ]

    const result = await refineServicesWithAI(services, testProvider)

    expect(result[0].category).toBe('redis' === result[0].id ? 'database' : 'payments')
  })

  it('ignores invalid confidence in AI response', async () => {
    vi.stubGlobal('fetch', mockFetchResponse('{"confidence":{"1":"super-high"}}'))

    const services = [
      mockService('redis', 'Redis', 'database', 'medium'),
      mockService('stripe', 'Stripe', 'payments', 'medium'),
    ]

    const result = await refineServicesWithAI(services, testProvider)

    const redis = result.find(s => s.id === 'redis')
    expect(redis?.confidence).toBe('medium')
  })

  it('applies multiple actions in a single AI response', async () => {
    // toRefine = [firebase(medium), stripe(low), lodash(low)]
    vi.stubGlobal('fetch', mockFetchResponse(JSON.stringify({
      remove: [3],
      category: { '1': 'auth' },
      confidence: { '2': 'high' },
    })))

    const services = [
      mockService('firebase', 'Firebase', 'other', 'medium'),
      mockService('stripe', 'Stripe', 'payments', 'low'),
      mockService('lodash', 'Lodash', 'other', 'low'),
    ]

    const result = await refineServicesWithAI(services, testProvider)

    expect(result).toHaveLength(2)
    const firebase = result.find(s => s.id === 'firebase')
    expect(firebase?.category).toBe('auth')
    const stripe = result.find(s => s.id === 'stripe')
    expect(stripe?.confidence).toBe('high')
    expect(result.find(s => s.id === 'lodash')).toBeUndefined()
  })

  it('skips empty services array', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const result = await refineServicesWithAI([], testProvider)

    expect(result).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

// ── filterFalsePositivesWithAI ──

describe('filterFalsePositivesWithAI', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('keeps high-confidence services and AI-validated candidates', async () => {
    // Candidates (non-high) are is-e2e(low) and exit-code(low)
    // AI says only is-e2e is real (unlikely, but testing the mechanism)
    vi.stubGlobal('fetch', mockFetchResponse('["is-e2e"]'))

    const services = [
      mockService('redis', 'Redis', 'database', 'high'),
      mockService('is-e2e', 'Is E2e', 'other', 'low'),
      mockService('stripe', 'Stripe', 'payments', 'high'),
      mockService('exit-code', 'Exit Code', 'other', 'low'),
    ]

    const result = await filterFalsePositivesWithAI(services, testProvider)

    // redis(high) + stripe(high) always kept + is-e2e validated by AI
    expect(result).toHaveLength(3)
    expect(result.map(s => s.id)).toEqual(['redis', 'stripe', 'is-e2e'])
  })

  it('skips AI call when all services are high confidence', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const services = [
      mockService('redis', 'Redis', 'database', 'high'),
      mockService('stripe', 'Stripe', 'payments', 'high'),
    ]

    const result = await filterFalsePositivesWithAI(services, testProvider)

    expect(result).toHaveLength(2)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns original services when AI returns malformed JSON', async () => {
    vi.stubGlobal('fetch', mockFetchResponse('Sure! Here are the real services: redis, stripe'))

    const services = [
      mockService('redis', 'Redis', 'database', 'high'),
      mockService('stripe', 'Stripe', 'payments', 'medium'),
    ]

    const result = await filterFalsePositivesWithAI(services, testProvider)

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('redis')
    expect(result[1].id).toBe('stripe')
  })

  it('returns original services on fetch error (silent fallback)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const services = [
      mockService('redis', 'Redis', 'database', 'high'),
      mockService('stripe', 'Stripe', 'payments', 'medium'),
    ]

    const result = await filterFalsePositivesWithAI(services, testProvider)

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('redis')
    expect(result[1].id).toBe('stripe')
  })

  it('skips AI filter when more than 40 services', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const services = Array.from({ length: 41 }, (_, i) =>
      mockService(`svc-${i}`, `Service ${i}`, 'other', 'low')
    )

    const result = await filterFalsePositivesWithAI(services, testProvider)

    expect(result).toHaveLength(41)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
