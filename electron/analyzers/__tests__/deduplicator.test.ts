import { describe, it, expect } from 'vitest'
import { deduplicateServices } from '../deduplicator'
import type { HeuristicResult } from '../../types'

describe('deduplicateServices', () => {
  it('deduplicates services with the same normalized name by summing scores', () => {
    const results: HeuristicResult[] = [
      { serviceName: 'Stripe', category: 'payments', confidence: 'high', reason: 'env var STRIPE_KEY', score: 7, evidenceType: 'env_var' },
      { serviceName: 'Stripe', category: 'payments', confidence: 'low', reason: 'npm package @stripe/stripe-js', score: 1, evidenceType: 'npm_package' },
    ]
    const services = deduplicateServices(results)
    expect(services.length).toBe(1)
    expect(services[0].name).toBe('Stripe')
    // score 7+1=8 → low confidence (6-8 range), needsReview: true
    expect(services[0].confidence).toBe('low')
    expect(services[0].needsReview).toBe(true)
    expect(services[0].confidenceReasons?.length).toBe(2)
  })

  it('uses score-based confidence thresholds', () => {
    const results: HeuristicResult[] = [
      { serviceName: 'Redis', category: 'database', confidence: 'low', reason: 'import', score: 1, evidenceType: 'import' },
      { serviceName: 'Redis', category: 'database', confidence: 'high', reason: 'env var REDIS_URL', score: 6, evidenceType: 'env_var' },
      { serviceName: 'Redis', category: 'database', confidence: 'high', reason: 'docker service', score: 10, evidenceType: 'config_file' },
    ]
    const services = deduplicateServices(results)
    // score 1+6+10=17 → high confidence (>=15)
    expect(services[0].confidence).toBe('high')
    expect(services[0].needsReview).toBe(false)
  })

  it('prefers specific category over other', () => {
    const results: HeuristicResult[] = [
      { serviceName: 'Sentry', category: 'other', confidence: 'medium', reason: 'npm package', score: 1, evidenceType: 'npm_package' },
      { serviceName: 'Sentry', category: 'monitoring', confidence: 'high', reason: 'env var', score: 7, evidenceType: 'env_var' },
    ]
    const services = deduplicateServices(results)
    expect(services[0].category).toBe('monitoring')
  })

  it('merges related groups by prefix and sums scores', () => {
    const results: HeuristicResult[] = [
      { serviceName: 'Upstash', category: 'database', confidence: 'medium', reason: 'npm @upstash/redis', score: 1, evidenceType: 'npm_package' },
      { serviceName: 'Upstash Ratelimit', category: 'other', confidence: 'medium', reason: 'npm @upstash/ratelimit', score: 1, evidenceType: 'npm_package' },
      { serviceName: 'Upstash', category: 'database', confidence: 'high', reason: 'env var UPSTASH_REDIS_TOKEN', score: 7, evidenceType: 'env_var' },
    ]
    const services = deduplicateServices(results)
    expect(services.length).toBe(1)
    expect(services[0].id).toBe('upstash')
    expect(services[0].category).toBe('database')
    // score 1+1+7=9 → medium confidence
    expect(services[0].confidence).toBe('medium')
  })

  it('discards services below score threshold 6', () => {
    const results: HeuristicResult[] = [
      { serviceName: 'Unknown Service', category: 'other', confidence: 'low', reason: 'npm package', score: 1, evidenceType: 'npm_package' },
    ]
    const services = deduplicateServices(results)
    // score 1, penalty -4 for npm-only = -3, below 6 → discarded
    expect(services.length).toBe(0)
  })

  it('marks score 6-8 services as needsReview with low confidence', () => {
    const results: HeuristicResult[] = [
      { serviceName: 'Someservice', category: 'other', confidence: 'medium', reason: 'env var SOMESERVICE_URL', score: 6, evidenceType: 'env_var' },
    ]
    const services = deduplicateServices(results)
    expect(services.length).toBe(1)
    expect(services[0].confidence).toBe('low')
    expect(services[0].needsReview).toBe(true)
  })

  it('keeps separate services that are unrelated', () => {
    const results: HeuristicResult[] = [
      { serviceName: 'Stripe', category: 'payments', confidence: 'high', reason: 'env', score: 7, evidenceType: 'env_var' },
      { serviceName: 'Sentry', category: 'monitoring', confidence: 'high', reason: 'env', score: 7, evidenceType: 'env_var' },
      { serviceName: 'Redis', category: 'database', confidence: 'high', reason: 'docker', score: 10, evidenceType: 'config_file' },
    ]
    const services = deduplicateServices(results)
    expect(services.length).toBe(3)
  })

  it('applies -4 penalty when only import/npm_package evidence', () => {
    const results: HeuristicResult[] = [
      { serviceName: 'Lodash', category: 'other', confidence: 'low', reason: 'npm lodash', score: 1, evidenceType: 'npm_package' },
    ]
    const services = deduplicateServices(results)
    // score 1 - 4 = -3 < 6 → discarded
    expect(services.length).toBe(0)
  })

  it('does not apply npm-only penalty when mixed evidence types', () => {
    const results: HeuristicResult[] = [
      { serviceName: 'Stripe', category: 'payments', confidence: 'low', reason: 'npm stripe', score: 1, evidenceType: 'npm_package' },
      { serviceName: 'Stripe', category: 'payments', confidence: 'high', reason: 'env STRIPE_KEY', score: 7, evidenceType: 'env_var' },
    ]
    const services = deduplicateServices(results)
    expect(services.length).toBe(1)
    // score 1+7=8, no npm-only penalty → low confidence (6-8)
    expect(services[0].confidence).toBe('low')
  })

  describe('brand collapse (Problem 6)', () => {
    it('collapses Docker Hub + Dockerhub into one entry', () => {
      const results: HeuristicResult[] = [
        { serviceName: 'Docker Hub', category: 'infra', confidence: 'high', reason: 'action', score: 10, evidenceType: 'config_file' },
        { serviceName: 'Dockerhub', category: 'infra', confidence: 'medium', reason: 'env', score: 6, evidenceType: 'env_var' },
      ]
      const services = deduplicateServices(results)
      expect(services.length).toBe(1)
      expect(services[0].name).toBe('Docker Hub')
      // score 10+6=16 → high confidence
      expect(services[0].confidence).toBe('high')
    })

    it('collapses Cloudflare Sitekey + Cloudflare Turnstile into Cloudflare', () => {
      const results: HeuristicResult[] = [
        { serviceName: 'Cloudflare Sitekey', category: 'cdn', confidence: 'medium', reason: 'env 1', score: 7, evidenceType: 'env_var' },
        { serviceName: 'Cloudflare Use Turnstile', category: 'cdn', confidence: 'medium', reason: 'env 2', score: 2, evidenceType: 'env_var' },
        { serviceName: 'Cloudflare Turnstile', category: 'cdn', confidence: 'medium', reason: 'env 3', score: 7, evidenceType: 'env_var' },
      ]
      const services = deduplicateServices(results)
      expect(services.length).toBe(1)
      expect(services[0].name).toBe('Cloudflare')
    })

    it('collapses Vercel + Vercel Use Botid In Booker into Vercel', () => {
      const results: HeuristicResult[] = [
        { serviceName: 'Vercel', category: 'hosting', confidence: 'high', reason: 'config', score: 10, evidenceType: 'config_file' },
        { serviceName: 'Vercel Use Botid In Booker', category: 'hosting', confidence: 'medium', reason: 'env', score: 2, evidenceType: 'env_var' },
      ]
      const services = deduplicateServices(results)
      expect(services.length).toBe(1)
      expect(services[0].name).toBe('Vercel')
      // score 10+2=12 → medium confidence
      expect(services[0].confidence).toBe('medium')
    })

    it('removes generic "Database" when PostgreSQL exists', () => {
      const results: HeuristicResult[] = [
        { serviceName: 'Database', category: 'database', confidence: 'medium', reason: 'env 1', score: 2, evidenceType: 'env_var' },
        { serviceName: 'PostgreSQL', category: 'database', confidence: 'high', reason: 'connection string', score: 10, evidenceType: 'domain' },
        { serviceName: 'Insights Database', category: 'database', confidence: 'low', reason: 'env 2', score: 2, evidenceType: 'env_var' },
      ]
      const services = deduplicateServices(results)
      expect(services.length).toBe(1)
      expect(services[0].name).toBe('PostgreSQL')
    })

    it('removes generic email entries when specific provider exists', () => {
      const results: HeuristicResult[] = [
        { serviceName: 'Email From', category: 'email', confidence: 'medium', reason: 'env 1', score: 2, evidenceType: 'env_var' },
        { serviceName: 'Email Server', category: 'email', confidence: 'medium', reason: 'env 2', score: 2, evidenceType: 'env_var' },
        { serviceName: 'User Email', category: 'email', confidence: 'low', reason: 'env 3', score: 2, evidenceType: 'env_var' },
        { serviceName: 'SendGrid', category: 'email', confidence: 'high', reason: 'npm package', score: 7, evidenceType: 'env_var' },
      ]
      const services = deduplicateServices(results)
      expect(services.length).toBe(1)
      expect(services[0].name).toBe('SendGrid')
    })
  })

  describe('score thresholds', () => {
    it('score >= 15 → high confidence', () => {
      const results: HeuristicResult[] = [
        { serviceName: 'Stripe', category: 'payments', confidence: 'high', reason: 'config', score: 10, evidenceType: 'config_file' },
        { serviceName: 'Stripe', category: 'payments', confidence: 'high', reason: 'env', score: 7, evidenceType: 'env_var' },
      ]
      const services = deduplicateServices(results)
      expect(services[0].confidence).toBe('high')
      expect(services[0].needsReview).toBe(false)
    })

    it('score 9-14 → medium confidence', () => {
      const results: HeuristicResult[] = [
        { serviceName: 'Sentry', category: 'monitoring', confidence: 'high', reason: 'config', score: 10, evidenceType: 'config_file' },
      ]
      const services = deduplicateServices(results)
      expect(services[0].confidence).toBe('medium')
      expect(services[0].needsReview).toBe(false)
    })

    it('score 6-8 → low confidence, needsReview', () => {
      const results: HeuristicResult[] = [
        { serviceName: 'Someapi', category: 'other', confidence: 'high', reason: 'env', score: 7, evidenceType: 'env_var' },
      ]
      const services = deduplicateServices(results)
      expect(services[0].confidence).toBe('low')
      expect(services[0].needsReview).toBe(true)
    })

    it('score < 6 → discarded', () => {
      const results: HeuristicResult[] = [
        { serviceName: 'Weak', category: 'other', confidence: 'low', reason: 'url', score: 5, evidenceType: 'url' },
      ]
      const services = deduplicateServices(results)
      expect(services.length).toBe(0)
    })
  })
})
