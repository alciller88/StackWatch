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

    it('categorizes SAML as auth, not database', () => {
      const results = classifyEvidences([
        { type: 'env_var', value: 'SAML_DATABASE_URL', file: '.env' },
      ])
      expect(results[0]?.category).toBe('auth')
    })

    it('categorizes OUTLOOK as auth (OAuth provider)', () => {
      const results = classifyEvidences([
        { type: 'env_var', value: 'OUTLOOK_CLIENT_ID', file: '.env' },
      ])
      expect(results[0]?.category).toBe('auth')
    })
  })

  describe('config suffix filtering (Problem 1)', () => {
    it('discards env vars ending in config suffixes', () => {
      const configVars = [
        'FEATURE_ENABLED', 'RETRY_DISABLED', 'POLL_INTERVAL',
        'NOTIFY_DELAY_MS', 'NOTIFY_DELAY', 'SESSION_TIMEOUT',
        'API_RATE_LIMIT', 'UPLOAD_MAX', 'DOWNLOAD_MIN',
        'BATCH_SIZE', 'WORKER_COUNT', 'REQUEST_RATE',
        'PLAN_PRICE', 'TOTAL_COST', 'ACCESS_POLICY',
        'FEATURE_ROLLOUT', 'DAILY_REPORT', 'WEEKLY_REPORTS',
        'UPLOAD_DIR', 'CONFIG_PATH', 'RUN_MODE', 'LOG_LEVEL',
        'CRON_SCHEDULE', 'ALERT_THRESHOLD', 'MAX_RETRIES',
        'IMPORT_BATCH', 'SESSION_TTL', 'RESULT_CACHE', 'RATE_QUOTA',
        'AWAITING_PAYMENT_EMAIL_DELAY_MINUTES',
      ]

      for (const varName of configVars) {
        const results = classifyEvidences([
          { type: 'env_var', value: varName, file: '.env' },
        ])
        expect(results.length, `Expected ${varName} to be filtered`).toBe(0)
      }
    })

    it('still detects real services even with similar-looking names', () => {
      const results = classifyEvidences([
        { type: 'env_var', value: 'STRIPE_SECRET_KEY', file: '.env' },
        { type: 'env_var', value: 'SENTRY_DSN', file: '.env' },
      ])
      expect(results.length).toBe(2)
    })
  })

  describe('CI/script variable filtering (Problem 2)', () => {
    it('discards CI artifact and pipeline variables', () => {
      const ciVars = [
        'EXIT_CODE', 'HTTP_CODE', 'HEAD_REF', 'HEAD_BRANCH',
        'BRANCH_NAME', 'LAST_DAY', 'HTML_REPORT',
      ]

      for (const varName of ciVars) {
        const results = classifyEvidences([
          { type: 'env_var', value: varName, file: '.env' },
        ])
        expect(results.length, `Expected ${varName} to be filtered`).toBe(0)
      }
    })

    it('discards variables with AI agent prefixes', () => {
      const agentVars = ['DEVIN_TOKEN', 'COPILOT_WORKSPACE_ID']

      for (const varName of agentVars) {
        const results = classifyEvidences([
          { type: 'env_var', value: varName, file: '.env' },
        ])
        expect(results.length, `Expected ${varName} to be filtered`).toBe(0)
      }
    })

    it('discards action verb names from generic names', () => {
      const verbVars = ['RUN', 'DEPLOY', 'RELEASE', 'TRIGGER', 'MERGE']

      for (const varName of verbVars) {
        const results = classifyEvidences([
          { type: 'env_var', value: `${varName}_KEY`, file: '.env' },
        ])
        expect(results.length, `Expected ${varName} to be filtered as generic`).toBe(0)
      }
    })
  })

  describe('feature flag filtering (Problem 3)', () => {
    it('discards IS_* feature flags', () => {
      const flagVars = ['IS_E2E', 'IS_PREMIUM', 'IS_SELF_HOSTED']

      for (const varName of flagVars) {
        const results = classifyEvidences([
          { type: 'env_var', value: varName, file: '.env' },
        ])
        expect(results.length, `Expected ${varName} to be filtered`).toBe(0)
      }
    })

    it('discards DISABLE_/ENABLE_ when not a known service', () => {
      const flagVars = ['DISABLE_SIGNUP', 'ENABLE_ANALYTICS_V2']

      for (const varName of flagVars) {
        const results = classifyEvidences([
          { type: 'env_var', value: varName, file: '.env' },
        ])
        expect(results.length, `Expected ${varName} to be filtered`).toBe(0)
      }
    })

    it('discards app-specific config patterns', () => {
      const appVars = [
        'BOOKER_LAYOUT', 'AVAILABILITY_WINDOW', 'COMPANY_NAME',
        'APP_NAME', 'WEBSITE_URL', 'WEBAPP_URL', 'MINUTES_TO_BOOK',
      ]

      for (const varName of appVars) {
        const results = classifyEvidences([
          { type: 'env_var', value: varName, file: '.env' },
        ])
        expect(results.length, `Expected ${varName} to be filtered`).toBe(0)
      }
    })

    it('discards *_SEATS and *_CREDITS pricing params', () => {
      const pricingVars = ['TEAM_SEATS', 'MONTHLY_CREDITS']

      for (const varName of pricingVars) {
        const results = classifyEvidences([
          { type: 'env_var', value: varName, file: '.env' },
        ])
        expect(results.length, `Expected ${varName} to be filtered`).toBe(0)
      }
    })

    it('discards browser API patterns', () => {
      const browserVars = ['RESIZE_POLYFILL', 'INTERSECTION_OBSERVER', 'GOOGLE_LOGIN_ENABLED']

      for (const varName of browserVars) {
        const results = classifyEvidences([
          { type: 'env_var', value: varName, file: '.env' },
        ])
        expect(results.length, `Expected ${varName} to be filtered`).toBe(0)
      }
    })
  })

  describe('generic name filtering (Problem 4)', () => {
    it('filters out names that are clearly not external services', () => {
      const genericVars = [
        'SEED_KEY', 'CI_TOKEN', 'RUN_KEY', 'RELEASE_TOKEN',
        'PROJECT_KEY', 'TEAM_TOKEN', 'BRANCH_KEY', 'HEAD_KEY',
      ]

      for (const varName of genericVars) {
        const results = classifyEvidences([
          { type: 'env_var', value: varName, file: '.env' },
        ])
        expect(results.length, `Expected ${varName} to be filtered`).toBe(0)
      }
    })

    it('filters out project own name variants', () => {
      const results = classifyEvidences([
        { type: 'env_var', value: 'CAL_SIGNATURE_KEY', file: '.env' },
        { type: 'env_var', value: 'CALCOM_ENCRYPTION_KEY', file: '.env' },
      ], 'calcom')
      expect(results.length).toBe(0)
    })
  })

  describe('categorization fixes (Problem 5)', () => {
    it('discards *_POLYFILL and *_OBSERVER as browser APIs', () => {
      const results = classifyEvidences([
        { type: 'env_var', value: 'RESIZE_POLYFILL', file: '.env' },
        { type: 'env_var', value: 'MUTATION_OBSERVER', file: '.env' },
      ])
      expect(results.length).toBe(0)
    })

    it('discards *_LOGIN_ENABLED as feature flag', () => {
      const results = classifyEvidences([
        { type: 'env_var', value: 'GOOGLE_LOGIN_ENABLED', file: '.env' },
      ])
      expect(results.length).toBe(0)
    })
  })
})
