import { describe, it, expect } from 'vitest'
import { deduplicateServices } from '../deduplicator'
import type { HeuristicResult } from '../../types'

describe('deduplicateServices', () => {
  it('deduplicates by best-score-per-type, not additive per instance', () => {
    const results: HeuristicResult[] = [
      { serviceName: 'Stripe', category: 'payments', confidence: 'high', reason: 'env var STRIPE_KEY', score: 7, evidenceType: 'env_var' },
      { serviceName: 'Stripe', category: 'payments', confidence: 'low', reason: 'npm package @stripe/stripe-js', score: 1, evidenceType: 'npm_package' },
    ]
    const { services } = deduplicateServices(results)
    expect(services.length).toBe(1)
    expect(services[0].name).toBe('Stripe')
    // env_var: max(7)=7, import/npm: max(1)=1 → total 8 → low (6-10)
    expect(services[0].confidence).toBe('low')
    expect(services[0].needsReview).toBe(true)
    expect(services[0].confidenceReasons?.length).toBe(2)
  })

  it('50 duplicate imports of same package do NOT inflate score', () => {
    // framer-motion imported 50 times — all are import type with score 1
    const results: HeuristicResult[] = Array.from({ length: 50 }, (_, i) => ({
      serviceName: 'Framer Motion',
      category: 'other' as const,
      confidence: 'low' as const,
      reason: `import framer-motion in file${i}.ts`,
      score: 1,
      evidenceType: 'import' as const,
    }))
    const { services } = deduplicateServices(results)
    // import/npm: max(1)=1 → total 1 → below 6 → discarded
    expect(services.length).toBe(0)
  })

  it('uses score-based confidence thresholds with multi-type evidence', () => {
    const results: HeuristicResult[] = [
      { serviceName: 'Redis', category: 'database', confidence: 'low', reason: 'import', score: 1, evidenceType: 'import' },
      { serviceName: 'Redis', category: 'database', confidence: 'high', reason: 'env var REDIS_URL', score: 6, evidenceType: 'env_var' },
      { serviceName: 'Redis', category: 'database', confidence: 'high', reason: 'docker service', score: 10, evidenceType: 'config_file' },
    ]
    const { services } = deduplicateServices(results)
    // import/npm: 1, env_var: 6, config_file: 10 → total 17 → high (>10)
    expect(services[0].confidence).toBe('high')
    expect(services[0].needsReview).toBe(false)
  })

  it('prefers specific category over other', () => {
    const results: HeuristicResult[] = [
      { serviceName: 'Sentry', category: 'other', confidence: 'medium', reason: 'npm package', score: 1, evidenceType: 'npm_package' },
      { serviceName: 'Sentry', category: 'monitoring', confidence: 'high', reason: 'env var', score: 7, evidenceType: 'env_var' },
    ]
    const { services } = deduplicateServices(results)
    expect(services[0].category).toBe('monitoring')
  })

  it('merges related groups by prefix using best-per-type scoring', () => {
    const results: HeuristicResult[] = [
      { serviceName: 'Upstash', category: 'database', confidence: 'medium', reason: 'npm @upstash/redis', score: 1, evidenceType: 'npm_package' },
      { serviceName: 'Upstash Ratelimit', category: 'other', confidence: 'medium', reason: 'npm @upstash/ratelimit', score: 1, evidenceType: 'npm_package' },
      { serviceName: 'Upstash', category: 'database', confidence: 'high', reason: 'env var UPSTASH_REDIS_TOKEN', score: 7, evidenceType: 'env_var' },
    ]
    const { services } = deduplicateServices(results)
    expect(services.length).toBe(1)
    expect(services[0].id).toBe('upstash')
    expect(services[0].category).toBe('database')
    // import/npm: max(1,1)=1, env_var: 7 → total 8 → low (6-10)
    expect(services[0].confidence).toBe('low')
  })

  it('discards services below score threshold 6', () => {
    const results: HeuristicResult[] = [
      { serviceName: 'Unknown Service', category: 'other', confidence: 'low', reason: 'npm package', score: 1, evidenceType: 'npm_package' },
    ]
    const { services } = deduplicateServices(results)
    // import/npm: 1 → total 1 < 6 → discarded
    expect(services.length).toBe(0)
  })

  it('marks score 6-10 services as needsReview with low confidence', () => {
    const results: HeuristicResult[] = [
      { serviceName: 'Someservice', category: 'other', confidence: 'medium', reason: 'env var SOMESERVICE_URL', score: 6, evidenceType: 'env_var' },
    ]
    const { services } = deduplicateServices(results)
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
    const { services } = deduplicateServices(results)
    expect(services.length).toBe(3)
  })

  it('npm-only evidence stays below threshold (no additive trick)', () => {
    const results: HeuristicResult[] = [
      { serviceName: 'Lodash', category: 'other', confidence: 'low', reason: 'npm lodash', score: 1, evidenceType: 'npm_package' },
    ]
    const { services } = deduplicateServices(results)
    // import/npm: 1 → total 1 < 6 → discarded
    expect(services.length).toBe(0)
  })

  it('does not inflate score when mixed evidence has multiple instances of same type', () => {
    // Stripe with 3 env vars (different suffixes) and 1 npm
    const results: HeuristicResult[] = [
      { serviceName: 'Stripe', category: 'payments', confidence: 'low', reason: 'npm stripe', score: 1, evidenceType: 'npm_package' },
      { serviceName: 'Stripe', category: 'payments', confidence: 'high', reason: 'env STRIPE_KEY', score: 7, evidenceType: 'env_var' },
      { serviceName: 'Stripe', category: 'payments', confidence: 'medium', reason: 'env STRIPE_URL', score: 6, evidenceType: 'env_var' },
      { serviceName: 'Stripe', category: 'payments', confidence: 'low', reason: 'env STRIPE_REGION', score: 2, evidenceType: 'env_var' },
    ]
    const { services } = deduplicateServices(results)
    expect(services.length).toBe(1)
    // import/npm: max(1)=1, env_var: max(7,6,2)=7 → total 8 → low (6-10)
    expect(services[0].confidence).toBe('low')
  })

  describe('brand collapse (Problem 6)', () => {
    it('collapses Docker Hub + Dockerhub into one entry', () => {
      const results: HeuristicResult[] = [
        { serviceName: 'Docker Hub', category: 'infra', confidence: 'high', reason: 'action', score: 10, evidenceType: 'config_file' },
        { serviceName: 'Dockerhub', category: 'infra', confidence: 'medium', reason: 'env', score: 6, evidenceType: 'env_var' },
      ]
      const { services } = deduplicateServices(results)
      expect(services.length).toBe(1)
      expect(services[0].name).toBe('Docker Hub')
      // config_file: 10, env_var: 6 → total 16 → high (>10)
      expect(services[0].confidence).toBe('high')
    })

    it('collapses Cloudflare Sitekey + Cloudflare Turnstile into Cloudflare', () => {
      const results: HeuristicResult[] = [
        { serviceName: 'Cloudflare Sitekey', category: 'cdn', confidence: 'medium', reason: 'env 1', score: 7, evidenceType: 'env_var' },
        { serviceName: 'Cloudflare Use Turnstile', category: 'cdn', confidence: 'medium', reason: 'env 2', score: 2, evidenceType: 'env_var' },
        { serviceName: 'Cloudflare Turnstile', category: 'cdn', confidence: 'medium', reason: 'env 3', score: 7, evidenceType: 'env_var' },
      ]
      const { services } = deduplicateServices(results)
      expect(services.length).toBe(1)
      expect(services[0].name).toBe('Cloudflare')
    })

    it('collapses Vercel + Vercel Use Botid In Booker into Vercel', () => {
      const results: HeuristicResult[] = [
        { serviceName: 'Vercel', category: 'hosting', confidence: 'high', reason: 'config', score: 10, evidenceType: 'config_file' },
        { serviceName: 'Vercel Use Botid In Booker', category: 'hosting', confidence: 'medium', reason: 'env', score: 2, evidenceType: 'env_var' },
      ]
      const { services } = deduplicateServices(results)
      expect(services.length).toBe(1)
      expect(services[0].name).toBe('Vercel')
      // config_file: 10, env_var: 2 → total 12 → high (>10)
      expect(services[0].confidence).toBe('high')
    })

    it('removes generic "Database" when PostgreSQL exists', () => {
      const results: HeuristicResult[] = [
        { serviceName: 'Database', category: 'database', confidence: 'medium', reason: 'env 1', score: 2, evidenceType: 'env_var' },
        { serviceName: 'PostgreSQL', category: 'database', confidence: 'high', reason: 'connection string', score: 10, evidenceType: 'domain' },
        { serviceName: 'Insights Database', category: 'database', confidence: 'low', reason: 'env 2', score: 2, evidenceType: 'env_var' },
      ]
      const { services } = deduplicateServices(results)
      expect(services.length).toBe(1)
      expect(services[0].name).toBe('PostgreSQL')
    })

    it('removes generic email entries when specific provider exists', () => {
      const results: HeuristicResult[] = [
        { serviceName: 'Email From', category: 'email', confidence: 'medium', reason: 'env 1', score: 2, evidenceType: 'env_var' },
        { serviceName: 'Email Server', category: 'email', confidence: 'medium', reason: 'env 2', score: 2, evidenceType: 'env_var' },
        { serviceName: 'User Email', category: 'email', confidence: 'low', reason: 'env 3', score: 2, evidenceType: 'env_var' },
        { serviceName: 'SendGrid', category: 'email', confidence: 'high', reason: 'env var', score: 7, evidenceType: 'env_var' },
      ]
      const { services } = deduplicateServices(results)
      expect(services.length).toBe(1)
      expect(services[0].name).toBe('SendGrid')
    })
  })

  describe('score thresholds', () => {
    it('score > 10 → high confidence (multi-type evidence)', () => {
      const results: HeuristicResult[] = [
        { serviceName: 'Stripe', category: 'payments', confidence: 'high', reason: 'config', score: 10, evidenceType: 'config_file' },
        { serviceName: 'Stripe', category: 'payments', confidence: 'high', reason: 'env', score: 7, evidenceType: 'env_var' },
      ]
      const { services } = deduplicateServices(results)
      // config_file: 10, env_var: 7 → total 17 → high
      expect(services[0].confidence).toBe('high')
      expect(services[0].needsReview).toBe(false)
    })

    it('score 6-10 → low confidence, needsReview (grey zone for AI)', () => {
      const results: HeuristicResult[] = [
        { serviceName: 'Someapi', category: 'other', confidence: 'high', reason: 'env', score: 7, evidenceType: 'env_var' },
      ]
      const { services } = deduplicateServices(results)
      // env_var: 7 → total 7 → low
      expect(services[0].confidence).toBe('low')
      expect(services[0].needsReview).toBe(true)
    })

    it('single config_file (score 10) → low confidence, needs AI validation', () => {
      const results: HeuristicResult[] = [
        { serviceName: 'Sentry', category: 'monitoring', confidence: 'high', reason: 'config', score: 10, evidenceType: 'config_file' },
      ]
      const { services } = deduplicateServices(results)
      // config_file: 10 → total 10 → low (6-10, not >10)
      expect(services[0].confidence).toBe('low')
      expect(services[0].needsReview).toBe(true)
    })

    it('score < 6 → discarded', () => {
      const results: HeuristicResult[] = [
        { serviceName: 'Weak', category: 'other', confidence: 'low', reason: 'url', score: 5, evidenceType: 'url' },
      ]
      const { services } = deduplicateServices(results)
      expect(services.length).toBe(0)
    })

    it('example: Sentry env_var(6) + ci_secret(8) + import(1) = 15 → high', () => {
      const results: HeuristicResult[] = [
        { serviceName: 'Sentry', category: 'monitoring', confidence: 'medium', reason: 'env SENTRY_DSN', score: 6, evidenceType: 'env_var' },
        { serviceName: 'Sentry', category: 'monitoring', confidence: 'high', reason: 'ci secret', score: 8, evidenceType: 'ci_secret' },
        { serviceName: 'Sentry', category: 'monitoring', confidence: 'low', reason: 'import @sentry/node', score: 1, evidenceType: 'import' },
      ]
      const { services } = deduplicateServices(results)
      expect(services.length).toBe(1)
      // env_var: 6, ci_secret: 8, import/npm: 1 → total 15 → high
      expect(services[0].confidence).toBe('high')
      expect(services[0].needsReview).toBe(false)
    })
  })

  describe('discarded items tracking', () => {
    it('tracks low_score discards', () => {
      const results: HeuristicResult[] = [
        { serviceName: 'Lodash', category: 'other', confidence: 'low', reason: 'npm lodash', score: 1, evidenceType: 'npm_package' },
      ]
      const { services, discarded } = deduplicateServices(results)
      expect(services.length).toBe(0)
      expect(discarded.length).toBe(1)
      expect(discarded[0].name).toBe('Lodash')
      expect(discarded[0].reason).toBe('low_score')
      expect(discarded[0].score).toBe(1)
    })

    it('tracks generic_term discards', () => {
      const results: HeuristicResult[] = [
        { serviceName: 'Database', category: 'database', confidence: 'medium', reason: 'env', score: 7, evidenceType: 'env_var' },
        { serviceName: 'PostgreSQL', category: 'database', confidence: 'high', reason: 'docker', score: 10, evidenceType: 'config_file' },
      ]
      const { services, discarded } = deduplicateServices(results)
      expect(services.length).toBe(1)
      expect(services[0].name).toBe('PostgreSQL')
      expect(discarded.length).toBe(1)
      expect(discarded[0].name).toBe('Database')
      expect(discarded[0].reason).toBe('generic_term')
    })

    it('returns empty discarded when all pass', () => {
      const results: HeuristicResult[] = [
        { serviceName: 'Stripe', category: 'payments', confidence: 'high', reason: 'config', score: 10, evidenceType: 'config_file' },
        { serviceName: 'Stripe', category: 'payments', confidence: 'high', reason: 'env', score: 7, evidenceType: 'env_var' },
      ]
      const { services, discarded } = deduplicateServices(results)
      expect(services.length).toBe(1)
      expect(discarded.length).toBe(0)
    })
  })
})
