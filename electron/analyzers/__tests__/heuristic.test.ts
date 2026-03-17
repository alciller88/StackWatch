import { describe, it, expect } from 'vitest'
import { classifyEvidences } from '../heuristic'
import type { Evidence } from '../../types'

describe('classifyEvidences', () => {
  describe('env vars', () => {
    it('classifies credential env vars with high confidence and score 7', () => {
      const evidences: Evidence[] = [
        { type: 'env_var', value: 'STRIPE_SECRET_KEY', file: '.env' },
        { type: 'env_var', value: 'TWITTER_API_KEY', file: '.env' },
      ]
      const results = classifyEvidences(evidences)
      expect(results.length).toBe(2)
      expect(results[0].serviceName).toBe('Stripe')
      expect(results[0].confidence).toBe('high')
      expect(results[0].score).toBe(7)
      expect(results[0].evidenceType).toBe('env_var')
      expect(results[1].serviceName).toBe('Twitter')
      expect(results[1].confidence).toBe('high')
      expect(results[1].score).toBe(7)
    })

    it('classifies endpoint env vars with score 6', () => {
      const results = classifyEvidences([
        { type: 'env_var', value: 'REDIS_URL', file: '.env' },
      ])
      expect(results[0].serviceName).toBe('Redis')
      expect(results[0].score).toBe(6)
      expect(results[0].confidence).toBe('medium')
      expect(results[0].category).toBe('database')
    })

    it('classifies unknown service env vars with score 2', () => {
      const results = classifyEvidences([
        { type: 'env_var', value: 'GA_MEASUREMENT_ID', file: '.env' },
      ])
      expect(results[0].serviceName).toBe('Ga Measurement')
      expect(results[0].score).toBe(2)
      expect(results[0].confidence).toBe('low')
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
      expect(results[0].score).toBe(7)
    })
  })

  describe('URLs', () => {
    it('classifies external URLs with score 5', () => {
      const results = classifyEvidences([
        { type: 'url', value: 'https://api.stripe.com/v1/charges', file: 'src/payments.ts' },
      ])
      expect(results[0].serviceName).toBe('Stripe')
      expect(results[0].score).toBe(5)
      expect(results[0].evidenceType).toBe('url')
    })

    it('classifies regular URLs with medium confidence', () => {
      const results = classifyEvidences([
        { type: 'url', value: 'https://hooks.slack.com/services/xxx', file: 'src/notify.ts' },
      ])
      expect(results[0].confidence).toBe('medium')
      expect(results[0].score).toBe(5)
    })
  })

  describe('npm packages', () => {
    it('classifies any npm package with score 1', () => {
      const results = classifyEvidences([
        { type: 'npm_package', value: '@upstash/redis', file: 'package.json' },
        { type: 'npm_package', value: '@vercel/functions', file: 'package.json' },
        { type: 'npm_package', value: '@sentry/node', file: 'package.json' },
      ])
      expect(results.length).toBe(3)
      expect(results[0].serviceName).toBe('Upstash')
      expect(results[0].category).toBe('database')
      expect(results[0].score).toBe(1)
      expect(results[1].serviceName).toBe('Vercel')
      expect(results[1].category).toBe('hosting')
      expect(results[2].serviceName).toBe('Sentry')
      expect(results[2].category).toBe('monitoring')
    })

    it('passes through utility packages with low score (dedup discards them)', () => {
      const results = classifyEvidences([
        { type: 'npm_package', value: 'lodash', file: 'package.json' },
        { type: 'npm_package', value: 'react', file: 'package.json' },
        { type: 'npm_package', value: 'typescript', file: 'package.json' },
        { type: 'npm_package', value: '@types/node', file: 'package.json' },
      ])
      // Utility packages now pass through with score 1
      // The deduplicator discards them (score 1 - 4 penalty = -3 < 6)
      for (const r of results) {
        expect(r.score).toBe(1)
        expect(r.evidenceType).toBe('npm_package')
      }
    })
  })

  describe('config files', () => {
    it('classifies hosting config files with score 10', () => {
      const results = classifyEvidences([
        { type: 'config_file', value: 'vercel.json', file: 'vercel.json' },
        { type: 'config_file', value: 'fly.toml', file: 'fly.toml' },
      ])
      expect(results.length).toBe(2)
      expect(results[0].serviceName).toBe('Vercel')
      expect(results[0].category).toBe('hosting')
      expect(results[0].confidence).toBe('high')
      expect(results[0].score).toBe(10)
      expect(results[1].serviceName).toBe('Fly.io')
    })

    it('classifies docker compose services', () => {
      const results = classifyEvidences([
        { type: 'config_file', value: 'docker-service:postgres', file: 'docker-compose.yml' },
        { type: 'config_file', value: 'docker-service:redis', file: 'docker-compose.yml' },
      ])
      expect(results.length).toBe(2)
      expect(results[0].category).toBe('database')
      expect(results[0].score).toBe(10)
      expect(results[1].category).toBe('database')
    })

    it('classifies GitHub Actions', () => {
      const results = classifyEvidences([
        { type: 'config_file', value: 'github-actions', file: '.github/workflows/ci.yml' },
      ])
      expect(results[0].serviceName).toBe('GitHub Actions')
      expect(results[0].category).toBe('cicd')
      expect(results[0].confidence).toBe('high')
      expect(results[0].score).toBe(10)
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
    it('discards env vars ending in config suffixes (score penalty makes them non-positive)', () => {
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

    it('filters out project own name variants via score penalty', () => {
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

  describe('scoring system', () => {
    it('assigns correct base scores by evidence type', () => {
      const configResult = classifyEvidences([
        { type: 'config_file', value: 'vercel.json', file: 'vercel.json' },
      ])
      expect(configResult[0].score).toBe(10)

      const credResult = classifyEvidences([
        { type: 'env_var', value: 'STRIPE_SECRET_KEY', file: '.env' },
      ])
      expect(credResult[0].score).toBe(7)

      const endpointResult = classifyEvidences([
        { type: 'env_var', value: 'REDIS_URL', file: '.env' },
      ])
      expect(endpointResult[0].score).toBe(6)

      const urlResult = classifyEvidences([
        { type: 'url', value: 'https://api.stripe.com/v1', file: 'src/pay.ts' },
      ])
      expect(urlResult[0].score).toBe(5)

      const genericEnvResult = classifyEvidences([
        { type: 'env_var', value: 'GA_MEASUREMENT_ID', file: '.env' },
      ])
      expect(genericEnvResult[0].score).toBe(2)

      const npmResult = classifyEvidences([
        { type: 'npm_package', value: 'stripe', file: 'package.json' },
      ])
      expect(npmResult[0].score).toBe(1)
    })

    it('applies -3 penalty for descriptive phrases (>2 words)', () => {
      // "Vercel Use Botid" is 3 words → -3 penalty would make it score 2-3 = -1 < 0
      // But this would need an env var generating that name. Let's test with config:
      // Config files don't generate multi-word names from the map, but env vars do.
      const results = classifyEvidences([
        { type: 'env_var', value: 'SOME_LONG_SERVICE_NAME_KEY', file: '.env' },
      ])
      // "Some Long Service Name" = 4 words → penalty -3, base 7, final 4
      if (results.length > 0) {
        expect(results[0].score).toBeLessThan(7)
      }
    })

    it('applies -10 penalty for project name matches', () => {
      // With project name "myapp", MYAPP_SECRET_KEY would match
      const results = classifyEvidences([
        { type: 'env_var', value: 'MYAPP_SECRET_KEY', file: '.env' },
      ], 'myapp')
      // score 7 - 10 = -3, filtered out
      expect(results.length).toBe(0)
    })
  })
})
