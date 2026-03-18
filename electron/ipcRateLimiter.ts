interface RateLimitConfig {
  maxCalls: number
  windowMs: number
}

class IPCRateLimiter {
  private counts = new Map<string, number[]>()

  isAllowed(channel: string, config: RateLimitConfig): boolean {
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

export const rateLimiter = new IPCRateLimiter()
export type { RateLimitConfig }
