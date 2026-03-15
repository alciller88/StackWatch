import { describe, it, expect } from 'vitest'
import { classifyEvidences } from '../heuristic'
import type { Evidence } from '../../types'

describe('classifyEvidences', () => {
  describe('env vars', () => {
    it('classifies credential env vars with high confidence', () => {
      const evidences: Evidence[] = [
        { type: 'env_var', value: 'STRIPE_SECRET_KEY', file: '.env' },
        { type: 'env_var', value: 'TWITTER_API_KEY', file: '.env' },
      ]
      const results = classifyEvidences(evidences)
      expect(results.length).toBe(2)
      expect(results[0].serviceName).toBe('Stripe')
      expect(results[0].confidence).toBe('high')
      expect(results[1].serviceName).toBe('Twitter')
      expect(results[1].confidence).toBe('high')
    })

    it('classifies endpoint env vars with high confidence', () => {
      const results = classifyEvidences([
        { type: 'env_var', value: 'REDIS_URL', file: '.env' },
      ])
      expect(results[0].serviceName).toBe('Redis')
      expect(results[0].confidence).toBe('high')
      expect(results[0].category).toBe('database')
    })

    it('classifies unknown service env vars with medium confidence', () => {
      const results = classifyEvidences([
        { type: 'env_var', value: 'GA_MEASUREMENT_ID', file: '.env' },
      ])
      expect(results[0].serviceName).toBe('Ga Measurement')
      expect(results[0].confidence).toBe('medium')
    })

    it('ignores system env vars', () => {
      const results = classifyEvidences([
        { type: 'env_var', value: 'NODE_ENV', file: '.env' },
        { type: 'env_var', value: 'PORT', file: '.env' },
        { type: 'env_var', value: 'DEBUG', file: '.env' },
      ])
      expect(results.length).toBe(0)
    })

    it('strips framework prefixes', () => {
      const results = classifyEvidences([
        { type: 'env_var', value: 'NEXT_PUBLIC_STRIPE_KEY', file: '.env' },
      ])
      expect(results[0].serviceName).toBe('Stripe')
      expect(results[0].confidence).toBe('high')
    })
  })

  describe('URLs', () => {
    it('classifies API URLs with high confidence', () => {
      const results = classifyEvidences([
        { type: 'url', value: 'https://api.stripe.com/v1/charges', file: 'src/payments.ts' },
      ])
      expect(results[0].serviceName).toBe('Stripe')
      expect(results[0].confidence).toBe('high')
    })

    it('classifies regular URLs with medium confidence', () => {
      const results = classifyEvidences([
        { type: 'url', value: 'https://hooks.slack.com/services/xxx', file: 'src/notify.ts' },
      ])
      expect(results[0].confidence).toBe('medium')
    })
  })

  describe('npm packages', () => {
    it('classifies service SDK packages', () => {
      const results = classifyEvidences([
        { type: 'npm_package', value: '@upstash/redis', file: 'package.json' },
        { type: 'npm_package', value: '@vercel/functions', file: 'package.json' },
        { type: 'npm_package', value: '@sentry/node', file: 'package.json' },
      ])
      expect(results.length).toBe(3)
      expect(results[0].serviceName).toBe('Upstash')
      expect(results[0].category).toBe('database')
      expect(results[1].serviceName).toBe('Vercel')
      expect(results[1].category).toBe('hosting')
      expect(results[2].serviceName).toBe('Sentry')
      expect(results[2].category).toBe('monitoring')
    })

    it('ignores utility packages', () => {
      const results = classifyEvidences([
        { type: 'npm_package', value: 'lodash', file: 'package.json' },
        { type: 'npm_package', value: 'react', file: 'package.json' },
        { type: 'npm_package', value: 'typescript', file: 'package.json' },
        { type: 'npm_package', value: '@types/node', file: 'package.json' },
      ])
      expect(results.length).toBe(0)
    })
  })

  describe('config files', () => {
    it('classifies hosting config files with high confidence', () => {
      const results = classifyEvidences([
        { type: 'config_file', value: 'vercel.json', file: 'vercel.json' },
        { type: 'config_file', value: 'fly.toml', file: 'fly.toml' },
      ])
      expect(results.length).toBe(2)
      expect(results[0].serviceName).toBe('Vercel')
      expect(results[0].category).toBe('hosting')
      expect(results[0].confidence).toBe('high')
      expect(results[1].serviceName).toBe('Fly.io')
    })

    it('classifies docker compose services', () => {
      const results = classifyEvidences([
        { type: 'config_file', value: 'docker-service:postgres', file: 'docker-compose.yml' },
        { type: 'config_file', value: 'docker-service:redis', file: 'docker-compose.yml' },
      ])
      expect(results.length).toBe(2)
      expect(results[0].category).toBe('database')
      expect(results[1].category).toBe('database')
    })

    it('classifies GitHub Actions', () => {
      const results = classifyEvidences([
        { type: 'config_file', value: 'github-actions', file: '.github/workflows/ci.yml' },
      ])
      expect(results[0].serviceName).toBe('GitHub Actions')
      expect(results[0].category).toBe('cicd')
      expect(results[0].confidence).toBe('high')
    })
  })

  describe('category inference', () => {
    it('correctly categorizes known service names', () => {
      const testCases: [string, string][] = [
        ['stripe', 'payments'],
        ['sendgrid', 'email'],
        ['sentry', 'monitoring'],
        ['cloudinary', 'storage'],
        ['auth0', 'auth'],
        ['openai', 'ai'],
        ['twilio', 'messaging'],
        ['cloudflare', 'cdn'],
        ['aws', 'infra'],
      ]

      for (const [name, expectedCategory] of testCases) {
        const results = classifyEvidences([
          { type: 'env_var', value: `${name.toUpperCase()}_KEY`, file: '.env' },
        ])
        expect(results[0]?.category).toBe(expectedCategory)
      }
    })
  })
})
