import { describe, it, expect } from 'vitest'
import { shouldNeedReview } from '../serviceValidation'
import type { Service } from '../../types'

function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: 'test',
    name: 'Test',
    category: 'hosting',
    plan: 'paid',
    source: 'inferred',
    ...overrides,
  }
}

describe('shouldNeedReview', () => {
  it('returns false when confidence is high', () => {
    expect(shouldNeedReview(makeService({ confidence: 'high' }))).toBe(false)
  })

  it('returns true when category is other', () => {
    expect(shouldNeedReview(makeService({ confidence: 'medium', category: 'other' }))).toBe(true)
  })

  it('returns true when aiContext has warnings', () => {
    expect(shouldNeedReview(makeService({
      confidence: 'medium',
      category: 'database',
      aiContext: {
        serviceId: 'test',
        usage: 'used for caching',
        criticalityLevel: 'important',
        usageLocations: ['src/cache.ts'],
        warnings: ['Potential misconfiguration'],
      },
    }))).toBe(true)
  })

  it('returns false when everything is correct (medium confidence, specific category, no warnings)', () => {
    expect(shouldNeedReview(makeService({
      confidence: 'medium',
      category: 'database',
    }))).toBe(false)
  })

  it('returns true when category is missing (undefined)', () => {
    expect(shouldNeedReview(makeService({
      confidence: 'low',
      category: undefined as any,
    }))).toBe(true)
  })
})
