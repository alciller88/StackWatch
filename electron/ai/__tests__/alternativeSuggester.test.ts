import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Service, AIProvider } from '../../types'

// ── Mock deepAnalyzer ──

vi.mock('../deepAnalyzer', () => ({
  callAI: vi.fn(),
  safeParseJSON: vi.fn((text: string, fallback: any) => {
    try {
      // Extract JSON from possible markdown fences
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
      const clean = match ? match[1].trim() : text.trim()
      return JSON.parse(clean)
    } catch {
      return fallback
    }
  }),
}))

import { callAI } from '../deepAnalyzer'
import { suggestAlternatives } from '../alternativeSuggester'

// ── Helpers ──

function makeService(overrides: Partial<Service> & { id: string; name: string }): Service {
  return {
    category: 'other',
    plan: 'unknown',
    source: 'inferred',
    confidence: 'medium',
    ...overrides,
  }
}

const testProvider: AIProvider = {
  name: 'test',
  baseUrl: 'http://localhost:1234/v1',
  model: 'test-model',
  apiKey: 'test-key',
}

// ── Tests ──

describe('suggestAlternatives', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns empty array for empty services', async () => {
    const result = await suggestAlternatives([], testProvider)
    expect(result).toEqual([])
    expect(callAI).not.toHaveBeenCalled()
  })

  it('returns empty array when no paid/trial/high-confidence services', async () => {
    const services: Service[] = [
      makeService({ id: 'svc1', name: 'FreeService', plan: 'free', confidence: 'low' }),
      makeService({ id: 'svc2', name: 'UnknownService', plan: 'unknown', confidence: 'medium' }),
    ]

    const result = await suggestAlternatives(services, testProvider)
    expect(result).toEqual([])
    expect(callAI).not.toHaveBeenCalled()
  })

  it('filters to only paid/trial/high-confidence services', async () => {
    vi.mocked(callAI).mockResolvedValue(JSON.stringify([]))

    const services: Service[] = [
      makeService({ id: 'free', name: 'FreeService', plan: 'free', confidence: 'low' }),
      makeService({ id: 'paid', name: 'PaidService', plan: 'paid', confidence: 'medium' }),
      makeService({ id: 'trial', name: 'TrialService', plan: 'trial', confidence: 'medium' }),
      makeService({ id: 'high', name: 'HighConfService', plan: 'unknown', confidence: 'high' }),
    ]

    await suggestAlternatives(services, testProvider)

    expect(callAI).toHaveBeenCalledTimes(1)
    const prompt = vi.mocked(callAI).mock.calls[0][1]
    expect(prompt).toContain('PaidService')
    expect(prompt).toContain('TrialService')
    expect(prompt).toContain('HighConfService')
    expect(prompt).not.toContain('FreeService')
  })

  it('parses valid AI response correctly', async () => {
    const aiResponse = JSON.stringify([
      {
        id: 1,
        alternatives: [
          {
            name: 'OpenStripe',
            reason: 'Free open-source payment processor',
            type: 'open-source',
            url: 'https://openstripe.example.com',
          },
        ],
      },
    ])
    vi.mocked(callAI).mockResolvedValue(aiResponse)

    const services: Service[] = [
      makeService({ id: 'stripe', name: 'Stripe', category: 'payments', plan: 'paid' }),
    ]

    const result = await suggestAlternatives(services, testProvider)

    expect(result).toHaveLength(1)
    expect(result[0].serviceId).toBe('stripe')
    expect(result[0].serviceName).toBe('Stripe')
    expect(result[0].alternatives).toHaveLength(1)
    expect(result[0].alternatives[0].name).toBe('OpenStripe')
    expect(result[0].alternatives[0].type).toBe('open-source')
  })

  it('handles malformed AI response gracefully (returns [])', async () => {
    vi.mocked(callAI).mockResolvedValue('Sorry, I cannot help with that request.')

    const services: Service[] = [
      makeService({ id: 'stripe', name: 'Stripe', plan: 'paid' }),
    ]

    const result = await suggestAlternatives(services, testProvider)
    expect(result).toEqual([])
  })

  it('handles network error gracefully (returns [])', async () => {
    vi.mocked(callAI).mockRejectedValue(new Error('Network error'))

    const services: Service[] = [
      makeService({ id: 'stripe', name: 'Stripe', plan: 'paid' }),
    ]

    const result = await suggestAlternatives(services, testProvider)
    expect(result).toEqual([])
  })

  it('maps response IDs back to service IDs correctly', async () => {
    const aiResponse = JSON.stringify([
      {
        id: 1,
        alternatives: [
          { name: 'Alt1', reason: 'Cheaper option', type: 'cheaper' },
        ],
      },
      {
        id: 2,
        alternatives: [
          { name: 'Alt2', reason: 'Open source option', type: 'open-source' },
        ],
      },
    ])
    vi.mocked(callAI).mockResolvedValue(aiResponse)

    const services: Service[] = [
      makeService({ id: 'stripe', name: 'Stripe', plan: 'paid', category: 'payments' }),
      makeService({ id: 'sentry', name: 'Sentry', plan: 'paid', category: 'monitoring' }),
    ]

    const result = await suggestAlternatives(services, testProvider)

    expect(result).toHaveLength(2)
    expect(result[0].serviceId).toBe('stripe')
    expect(result[0].alternatives[0].name).toBe('Alt1')
    expect(result[1].serviceId).toBe('sentry')
    expect(result[1].alternatives[0].name).toBe('Alt2')
  })

  it('limits to max 2 alternatives per service', async () => {
    const aiResponse = JSON.stringify([
      {
        id: 1,
        alternatives: [
          { name: 'Alt1', reason: 'Reason 1', type: 'cheaper' },
          { name: 'Alt2', reason: 'Reason 2', type: 'open-source' },
          { name: 'Alt3', reason: 'Reason 3', type: 'self-hosted' },
          { name: 'Alt4', reason: 'Reason 4', type: 'cheaper' },
        ],
      },
    ])
    vi.mocked(callAI).mockResolvedValue(aiResponse)

    const services: Service[] = [
      makeService({ id: 'stripe', name: 'Stripe', plan: 'paid' }),
    ]

    const result = await suggestAlternatives(services, testProvider)

    expect(result).toHaveLength(1)
    expect(result[0].alternatives.length).toBeLessThanOrEqual(2)
  })

  it('skips alternatives with missing required fields', async () => {
    const aiResponse = JSON.stringify([
      {
        id: 1,
        alternatives: [
          { name: 'GoodAlt', reason: 'Valid reason', type: 'cheaper' },
          { name: '', reason: 'No name', type: 'cheaper' },
          { name: 'NoReason', reason: '', type: 'open-source' },
          { name: 'NoType', reason: 'Valid reason' },
        ],
      },
    ])
    vi.mocked(callAI).mockResolvedValue(aiResponse)

    const services: Service[] = [
      makeService({ id: 'stripe', name: 'Stripe', plan: 'paid' }),
    ]

    const result = await suggestAlternatives(services, testProvider)

    expect(result).toHaveLength(1)
    expect(result[0].alternatives).toHaveLength(1)
    expect(result[0].alternatives[0].name).toBe('GoodAlt')
  })

  it('ignores out-of-range IDs in AI response', async () => {
    const aiResponse = JSON.stringify([
      {
        id: 99,
        alternatives: [
          { name: 'Alt', reason: 'Reason', type: 'cheaper' },
        ],
      },
    ])
    vi.mocked(callAI).mockResolvedValue(aiResponse)

    const services: Service[] = [
      makeService({ id: 'stripe', name: 'Stripe', plan: 'paid' }),
    ]

    const result = await suggestAlternatives(services, testProvider)
    expect(result).toEqual([])
  })
})
