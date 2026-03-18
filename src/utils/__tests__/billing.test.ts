import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  calculateNextDate,
  renewService,
  getRenewalThreshold,
} from '../billing'
import type { ServiceBilling } from '../../../shared/types'

// Use noon UTC to avoid timezone edge cases
const TODAY_ISO = new Date('2026-03-18T12:00:00Z').toISOString().split('T')[0]

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-03-18T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('calculateNextDate', () => {
  it('monthly from lastRenewed', () => {
    const billing: ServiceBilling = { type: 'manual', period: 'monthly', lastRenewed: '2026-02-15' }
    // 2026-02-15 + 1 month = 2026-03-15
    const result = calculateNextDate(billing)
    expect(result).toBe('2026-03-15')
  })

  it('yearly from lastRenewed', () => {
    const billing: ServiceBilling = { type: 'manual', period: 'yearly', lastRenewed: '2025-06-15' }
    const result = calculateNextDate(billing)
    expect(result).toBe('2026-06-15')
  })

  it('one-time → undefined', () => {
    const billing: ServiceBilling = { type: 'manual', period: 'one-time', amount: 100 }
    expect(calculateNextDate(billing)).toBeUndefined()
  })

  it('free → undefined', () => {
    const billing: ServiceBilling = { type: 'free' }
    expect(calculateNextDate(billing)).toBeUndefined()
  })
})

describe('renewService', () => {
  it('updates lastRenewed to today', () => {
    const billing: ServiceBilling = { type: 'manual', period: 'monthly', lastRenewed: '2026-02-15' }
    const renewed = renewService(billing)
    expect(renewed.lastRenewed).toBe(TODAY_ISO)
  })

  it('recalculates nextDate', () => {
    const billing: ServiceBilling = { type: 'manual', period: 'monthly', lastRenewed: '2026-02-15' }
    const renewed = renewService(billing)
    // lastRenewed becomes today (2026-03-18), so nextDate = 2026-04-18
    const expected = calculateNextDate({ ...billing, lastRenewed: TODAY_ISO })
    expect(renewed.nextDate).toBe(expected)
  })
})

describe('getRenewalThreshold', () => {
  it('manual monthly → 7', () => {
    expect(getRenewalThreshold({ type: 'manual', period: 'monthly' })).toBe(7)
  })

  it('manual yearly → 30', () => {
    expect(getRenewalThreshold({ type: 'manual', period: 'yearly' })).toBe(30)
  })

  it('automatic monthly → undefined (no tracking)', () => {
    expect(getRenewalThreshold({ type: 'automatic', period: 'monthly' })).toBeUndefined()
  })

  it('automatic yearly → 60', () => {
    expect(getRenewalThreshold({ type: 'automatic', period: 'yearly' })).toBe(60)
  })
})
