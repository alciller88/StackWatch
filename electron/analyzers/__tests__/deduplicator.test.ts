import { describe, it, expect } from 'vitest'
import { deduplicateServices } from '../deduplicator'
import type { HeuristicResult } from '../../types'

describe('deduplicateServices', () => {
  it('deduplicates services with the same normalized name', () => {
    const results: HeuristicResult[] = [
      { serviceName: 'Stripe', category: 'payments', confidence: 'high', reason: 'env var STRIPE_KEY' },
      { serviceName: 'Stripe', category: 'payments', confidence: 'medium', reason: 'npm package @stripe/stripe-js' },
    ]
    const services = deduplicateServices(results)
    expect(services.length).toBe(1)
    expect(services[0].name).toBe('Stripe')
    expect(services[0].confidence).toBe('high')
    expect(services[0].confidenceReasons?.length).toBe(2)
  })

  it('uses highest confidence from group', () => {
    const results: HeuristicResult[] = [
      { serviceName: 'Redis', category: 'database', confidence: 'low', reason: 'import' },
      { serviceName: 'Redis', category: 'database', confidence: 'high', reason: 'env var REDIS_URL' },
    ]
    const services = deduplicateServices(results)
    expect(services[0].confidence).toBe('high')
  })

  it('prefers specific category over other', () => {
    const results: HeuristicResult[] = [
      { serviceName: 'Sentry', category: 'other', confidence: 'medium', reason: 'npm package' },
      { serviceName: 'Sentry', category: 'monitoring', confidence: 'medium', reason: 'env var' },
    ]
    const services = deduplicateServices(results)
    expect(services[0].category).toBe('monitoring')
  })

  it('merges related groups by prefix', () => {
    const results: HeuristicResult[] = [
      { serviceName: 'Upstash', category: 'database', confidence: 'medium', reason: 'npm @upstash/redis' },
      { serviceName: 'Upstash Ratelimit', category: 'other', confidence: 'medium', reason: 'npm @upstash/ratelimit' },
    ]
    const services = deduplicateServices(results)
    expect(services.length).toBe(1)
    expect(services[0].id).toBe('upstash')
    expect(services[0].category).toBe('database')
  })

  it('marks low confidence services as needsReview', () => {
    const results: HeuristicResult[] = [
      { serviceName: 'Unknown Service', category: 'other', confidence: 'low', reason: 'domain found' },
    ]
    const services = deduplicateServices(results)
    expect(services[0].needsReview).toBe(true)
  })

  it('keeps separate services that are unrelated', () => {
    const results: HeuristicResult[] = [
      { serviceName: 'Stripe', category: 'payments', confidence: 'high', reason: 'env' },
      { serviceName: 'Sentry', category: 'monitoring', confidence: 'high', reason: 'env' },
      { serviceName: 'Redis', category: 'database', confidence: 'medium', reason: 'docker' },
    ]
    const services = deduplicateServices(results)
    expect(services.length).toBe(3)
  })
})
