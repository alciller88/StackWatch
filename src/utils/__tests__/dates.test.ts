import { describe, it, expect, vi, afterEach } from 'vitest'
import { daysUntil } from '../dates'

describe('daysUntil', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 0 for today', () => {
    const today = new Date().toISOString().split('T')[0]
    expect(daysUntil(today)).toBe(0)
  })

  it('returns positive for future dates', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01'))
    expect(daysUntil('2026-01-11')).toBe(10)
    vi.useRealTimers()
  })

  it('returns negative for past dates', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-11'))
    expect(daysUntil('2026-01-01')).toBe(-10)
    vi.useRealTimers()
  })
})
