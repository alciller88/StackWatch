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

  describe('brand collapse (Problem 6)', () => {
    it('collapses Docker Hub + Dockerhub into one entry', () => {
      const results: HeuristicResult[] = [
        { serviceName: 'Docker Hub', category: 'infra', confidence: 'high', reason: 'action' },
        { serviceName: 'Dockerhub', category: 'infra', confidence: 'medium', reason: 'env' },
      ]
      const services = deduplicateServices(results)
      expect(services.length).toBe(1)
      expect(services[0].name).toBe('Docker Hub')
      expect(services[0].confidence).toBe('high')
    })

    it('collapses Cloudflare Sitekey + Cloudflare Turnstile into Cloudflare', () => {
      const results: HeuristicResult[] = [
        { serviceName: 'Cloudflare Sitekey', category: 'cdn', confidence: 'medium', reason: 'env 1' },
        { serviceName: 'Cloudflare Use Turnstile', category: 'cdn', confidence: 'medium', reason: 'env 2' },
        { serviceName: 'Cloudflare Turnstile', category: 'cdn', confidence: 'medium', reason: 'env 3' },
      ]
      const services = deduplicateServices(results)
      expect(services.length).toBe(1)
      expect(services[0].name).toBe('Cloudflare')
    })

    it('collapses Vercel + Vercel Use Botid In Booker into Vercel', () => {
      const results: HeuristicResult[] = [
        { serviceName: 'Vercel', category: 'hosting', confidence: 'high', reason: 'config' },
        { serviceName: 'Vercel Use Botid In Booker', category: 'hosting', confidence: 'medium', reason: 'env' },
      ]
      const services = deduplicateServices(results)
      expect(services.length).toBe(1)
      expect(services[0].name).toBe('Vercel')
      expect(services[0].confidence).toBe('high')
    })

    it('removes generic "Database" when PostgreSQL exists', () => {
      const results: HeuristicResult[] = [
        { serviceName: 'Database', category: 'database', confidence: 'medium', reason: 'env 1' },
        { serviceName: 'PostgreSQL', category: 'database', confidence: 'high', reason: 'connection string' },
        { serviceName: 'Insights Database', category: 'database', confidence: 'low', reason: 'env 2' },
      ]
      const services = deduplicateServices(results)
      expect(services.length).toBe(1)
      expect(services[0].name).toBe('PostgreSQL')
    })

    it('removes generic email entries when specific provider exists', () => {
      const results: HeuristicResult[] = [
        { serviceName: 'Email From', category: 'email', confidence: 'medium', reason: 'env 1' },
        { serviceName: 'Email Server', category: 'email', confidence: 'medium', reason: 'env 2' },
        { serviceName: 'User Email', category: 'email', confidence: 'low', reason: 'env 3' },
        { serviceName: 'SendGrid', category: 'email', confidence: 'high', reason: 'npm package' },
      ]
      const services = deduplicateServices(results)
      expect(services.length).toBe(1)
      expect(services[0].name).toBe('SendGrid')
    })
  })
})
