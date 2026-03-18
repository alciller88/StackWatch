import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Inline the class for isolated testing
class IPCRateLimiter {
  private counts = new Map<string, number[]>()

  isAllowed(channel: string, config: { maxCalls: number; windowMs: number }): boolean {
    const now = Date.now()
    const calls = this.counts.get(channel) ?? []
    const recent = calls.filter(t => now - t < config.windowMs)
    if (recent.length >= config.maxCalls) {
      return false
    }
    recent.push(now)
    this.counts.set(channel, recent)
    return true
  }

  reset(channel: string): void {
    this.counts.delete(channel)
  }
}

describe('IPCRateLimiter', () => {
  let limiter: IPCRateLimiter

  beforeEach(() => {
    limiter = new IPCRateLimiter()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows first call within limit', () => {
    expect(limiter.isAllowed('test', { maxCalls: 5, windowMs: 1000 })).toBe(true)
  })

  it('allows calls within the limit', () => {
    const config = { maxCalls: 3, windowMs: 1000 }
    expect(limiter.isAllowed('test', config)).toBe(true)
    expect(limiter.isAllowed('test', config)).toBe(true)
    expect(limiter.isAllowed('test', config)).toBe(true)
  })

  it('denies calls exceeding the limit', () => {
    const config = { maxCalls: 2, windowMs: 1000 }
    expect(limiter.isAllowed('test', config)).toBe(true)
    expect(limiter.isAllowed('test', config)).toBe(true)
    expect(limiter.isAllowed('test', config)).toBe(false)
  })

  it('resets after time window expires', () => {
    const config = { maxCalls: 1, windowMs: 1000 }
    expect(limiter.isAllowed('test', config)).toBe(true)
    expect(limiter.isAllowed('test', config)).toBe(false)

    vi.advanceTimersByTime(1001)
    expect(limiter.isAllowed('test', config)).toBe(true)
  })

  it('reset() clears the counter', () => {
    const config = { maxCalls: 1, windowMs: 1000 }
    expect(limiter.isAllowed('test', config)).toBe(true)
    expect(limiter.isAllowed('test', config)).toBe(false)

    limiter.reset('test')
    expect(limiter.isAllowed('test', config)).toBe(true)
  })

  it('tracks channels independently', () => {
    const config = { maxCalls: 1, windowMs: 1000 }
    expect(limiter.isAllowed('channel-a', config)).toBe(true)
    expect(limiter.isAllowed('channel-a', config)).toBe(false)
    expect(limiter.isAllowed('channel-b', config)).toBe(true) // different channel
  })
})
