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

  it('skips refinement for less than 2 services (no fetch called)', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const services = [mockService('redis', 'Redis', 'database', 'high')]
    const result = await refineServicesWithAI(services, testProvider)

    expect(result).toEqual(services)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns services unchanged when AI returns empty {}', async () => {
    vi.stubGlobal('fetch', mockFetchResponse('{}'))

    const services = [
      mockService('redis', 'Redis', 'database', 'high'),
      mockService('stripe', 'Stripe', 'payments', 'medium'),
    ]

    const result = await refineServicesWithAI(services, testProvider)

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('redis')
    expect(result[1].id).toBe('stripe')
    expect(result[0].category).toBe('database')
    expect(result[1].category).toBe('payments')
  })

  it('removes false positives based on AI response', async () => {
    // AI says service at 1-based index 2 is a false positive
    vi.stubGlobal('fetch', mockFetchResponse('{"remove":[2]}'))

    const services = [
      mockService('redis', 'Redis', 'database', 'high'),
      mockService('lodash', 'Lodash', 'other', 'low'),
      mockService('stripe', 'Stripe', 'payments', 'medium'),
    ]

    const result = await refineServicesWithAI(services, testProvider)

    expect(result).toHaveLength(2)
    expect(result.map(s => s.id)).toEqual(['redis', 'stripe'])
    // Verify the false positive (lodash) was removed
    expect(result.find(s => s.id === 'lodash')).toBeUndefined()
  })

  it('fixes categories based on AI response', async () => {
    // AI says service 1 should be "database" instead of "other"
    vi.stubGlobal('fetch', mockFetchResponse('{"category":{"1":"database"}}'))

    const services = [
      mockService('supabase', 'Supabase', 'other', 'medium'),
      mockService('stripe', 'Stripe', 'payments', 'high'),
    ]

    const result = await refineServicesWithAI(services, testProvider)

    expect(result).toHaveLength(2)
    expect(result[0].category).toBe('database')
    // Other service unchanged
    expect(result[1].category).toBe('payments')
  })

  it('adjusts confidence based on AI response', async () => {
    vi.stubGlobal('fetch', mockFetchResponse('{"confidence":{"1":"high"}}'))

    const services = [
      mockService('redis', 'Redis', 'database', 'low'),
      mockService('stripe', 'Stripe', 'payments', 'medium'),
    ]

    const result = await refineServicesWithAI(services, testProvider)

    expect(result[0].confidence).toBe('high')
    expect(result[0].needsReview).toBe(false)
    // Other service unchanged
    expect(result[1].confidence).toBe('medium')
  })

  it('sets needsReview true when confidence adjusted to low', async () => {
    vi.stubGlobal('fetch', mockFetchResponse('{"confidence":{"1":"low"}}'))

    const services = [
      mockService('redis', 'Redis', 'database', 'high'),
      mockService('stripe', 'Stripe', 'payments', 'medium'),
    ]

    const result = await refineServicesWithAI(services, testProvider)

    expect(result[0].confidence).toBe('low')
    expect(result[0].needsReview).toBe(true)
  })

  it('merges duplicates, keeping first and absorbing confidenceReasons', async () => {
    vi.stubGlobal('fetch', mockFetchResponse('{"merge":[[1,2]]}'))

    const services = [
      { ...mockService('postgres', 'PostgreSQL', 'database', 'high'), confidenceReasons: ['Found in package.json'] },
      { ...mockService('pg', 'Pg', 'database', 'medium'), confidenceReasons: ['Found in .env'] },
      mockService('stripe', 'Stripe', 'payments', 'high'),
    ]

    const result = await refineServicesWithAI(services, testProvider)

    // pg should be merged into postgres, stripe stays
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('postgres')
    expect(result[0].confidenceReasons).toContain('Found in package.json')
    expect(result[0].confidenceReasons).toContain('Found in .env')
    expect(result[1].id).toBe('stripe')
  })

  it('handles malformed AI response gracefully (returns original services)', async () => {
    // AI returns garbage text instead of JSON
    vi.stubGlobal('fetch', mockFetchResponse('Sorry, I cannot process that request. Here is some random text.'))

    const services = [
      mockService('redis', 'Redis', 'database', 'high'),
      mockService('stripe', 'Stripe', 'payments', 'medium'),
    ]

    const result = await refineServicesWithAI(services, testProvider)

    // safeParseJSON returns {} fallback, so no actions applied => services unchanged
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('redis')
    expect(result[1].id).toBe('stripe')
  })

  it('handles fetch error gracefully (throws, caller catches)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const services = [
      mockService('redis', 'Redis', 'database', 'high'),
      mockService('stripe', 'Stripe', 'payments', 'medium'),
    ]

    // refineServicesWithAI calls callAI which throws on fetch error
    // The function itself does NOT catch - the pipeline catches it
    await expect(refineServicesWithAI(services, testProvider)).rejects.toThrow('Network error')
  })

  it('handles non-ok HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
    }))

    const services = [
      mockService('redis', 'Redis', 'database', 'high'),
      mockService('stripe', 'Stripe', 'payments', 'medium'),
    ]

    await expect(refineServicesWithAI(services, testProvider)).rejects.toThrow('AI HTTP 429')
  })

  it('ignores invalid category in AI response', async () => {
    vi.stubGlobal('fetch', mockFetchResponse('{"category":{"1":"not-a-real-category"}}'))

    const services = [
      mockService('redis', 'Redis', 'database', 'high'),
      mockService('stripe', 'Stripe', 'payments', 'medium'),
    ]

    const result = await refineServicesWithAI(services, testProvider)

    // Category should remain unchanged since "not-a-real-category" is not in VALID_CATEGORIES
    expect(result[0].category).toBe('database')
  })

  it('ignores invalid confidence in AI response', async () => {
    vi.stubGlobal('fetch', mockFetchResponse('{"confidence":{"1":"super-high"}}'))

    const services = [
      mockService('redis', 'Redis', 'database', 'high'),
      mockService('stripe', 'Stripe', 'payments', 'medium'),
    ]

    const result = await refineServicesWithAI(services, testProvider)

    // Confidence should remain unchanged
    expect(result[0].confidence).toBe('high')
  })

  it('applies multiple actions in a single AI response', async () => {
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
    expect(result[0].id).toBe('firebase')
    expect(result[0].category).toBe('auth')
    expect(result[1].id).toBe('stripe')
    expect(result[1].confidence).toBe('high')
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

  it('keeps only services whose IDs are returned by AI', async () => {
    vi.stubGlobal('fetch', mockFetchResponse('["redis", "stripe"]'))

    const services = [
      mockService('redis', 'Redis', 'database', 'high'),
      mockService('is-e2e', 'Is E2e', 'other', 'low'),
      mockService('stripe', 'Stripe', 'payments', 'high'),
      mockService('exit-code', 'Exit Code', 'other', 'low'),
    ]

    const result = await filterFalsePositivesWithAI(services, testProvider)

    expect(result).toHaveLength(2)
    expect(result.map(s => s.id)).toEqual(['redis', 'stripe'])
  })

  it('returns original services when AI returns malformed JSON', async () => {
    vi.stubGlobal('fetch', mockFetchResponse('Sure! Here are the real services: redis, stripe'))

    const services = [
      mockService('redis', 'Redis', 'database', 'high'),
      mockService('stripe', 'Stripe', 'payments', 'high'),
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
      mockService('stripe', 'Stripe', 'payments', 'high'),
    ]

    const result = await filterFalsePositivesWithAI(services, testProvider)

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('redis')
    expect(result[1].id).toBe('stripe')
  })
})
