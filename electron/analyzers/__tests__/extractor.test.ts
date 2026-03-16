import { describe, it, expect } from 'vitest'
import { extractEvidencesFromGitHub } from '../extractor'

function mockFetchFile(files: Record<string, string>) {
  return async (path: string): Promise<string | null> => {
    return files[path] ?? null
  }
}

function mockListDir(dirs: Record<string, string[]>) {
  return async (path: string): Promise<string[]> => {
    return dirs[path] ?? []
  }
}

describe('extractEvidencesFromGitHub', () => {
  describe('package.json parsing', () => {
    it('extracts npm dependencies and evidences', async () => {
      const { evidences, dependencies } = await extractEvidencesFromGitHub(
        mockFetchFile({
          'package.json': JSON.stringify({
            dependencies: { 'stripe': '^12.0.0', 'express': '^4.18.0' },
            devDependencies: { 'vitest': '^3.0.0' },
          }),
        }),
        mockListDir({}),
      )

      expect(dependencies).toHaveLength(3)
      expect(dependencies[0]).toEqual({
        name: 'stripe',
        version: '^12.0.0',
        type: 'production',
        ecosystem: 'npm',
      })
      expect(dependencies[2].type).toBe('development')

      const npmEvidences = evidences.filter(e => e.type === 'npm_package')
      expect(npmEvidences).toHaveLength(3)
      expect(npmEvidences.map(e => e.value)).toContain('stripe')
    })
  })

  describe('.env file parsing', () => {
    it('extracts env vars', async () => {
      const { evidences } = await extractEvidencesFromGitHub(
        mockFetchFile({
          '.env.example': 'STRIPE_SECRET_KEY=sk_test_xxx\nDATABASE_URL=postgres://localhost/db\n# comment\nNODE_ENV=development',
        }),
        mockListDir({}),
      )

      const envVars = evidences.filter(e => e.type === 'env_var')
      expect(envVars.map(e => e.value)).toContain('STRIPE_SECRET_KEY')
      expect(envVars.map(e => e.value)).toContain('DATABASE_URL')
      expect(envVars.map(e => e.value)).toContain('NODE_ENV')
    })

    it('extracts URLs from env values', async () => {
      const { evidences } = await extractEvidencesFromGitHub(
        mockFetchFile({
          '.env': 'API_URL=https://api.stripe.com/v1',
        }),
        mockListDir({}),
      )

      const urls = evidences.filter(e => e.type === 'url')
      expect(urls.length).toBeGreaterThanOrEqual(1)
      expect(urls[0].value).toContain('api.stripe.com')
    })

    it('detects database type from DATABASE_URL', async () => {
      const { evidences } = await extractEvidencesFromGitHub(
        mockFetchFile({
          '.env': 'DATABASE_URL=postgres://user:pass@host:5432/db',
        }),
        mockListDir({}),
      )

      const domains = evidences.filter(e => e.type === 'domain')
      expect(domains.map(e => e.value)).toContain('postgresql')
    })
  })

  describe('docker-compose parsing', () => {
    it('extracts docker images', async () => {
      const { evidences } = await extractEvidencesFromGitHub(
        mockFetchFile({
          'docker-compose.yml': `version: "3"
services:
  db:
    image: postgres:15
  cache:
    image: redis:7-alpine
`,
        }),
        mockListDir({}),
      )

      const domains = evidences.filter(e => e.type === 'domain')
      expect(domains.map(e => e.value)).toContain('postgres')
      expect(domains.map(e => e.value)).toContain('redis')
    })

    it('extracts service names from compose', async () => {
      const { evidences } = await extractEvidencesFromGitHub(
        mockFetchFile({
          'docker-compose.yml': `version: "3"
services:
  db:
    image: postgres:15
  cache:
    image: redis:7
`,
        }),
        mockListDir({}),
      )

      const configFiles = evidences.filter(e => e.type === 'config_file' && e.value.startsWith('docker-service:'))
      expect(configFiles.map(e => e.value)).toContain('docker-service:db')
      expect(configFiles.map(e => e.value)).toContain('docker-service:cache')
    })
  })

  describe('CI workflow parsing', () => {
    it('extracts GitHub Actions secrets', async () => {
      const { evidences } = await extractEvidencesFromGitHub(
        mockFetchFile({
          '.github/workflows/deploy.yml': `
name: Deploy
on: push
jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      AWS_ACCESS_KEY_ID: \${{ secrets.AWS_ACCESS_KEY }}
      VERCEL_TOKEN: \${{ secrets.VERCEL_TOKEN }}
`,
        }),
        mockListDir({ '.github/workflows': ['deploy.yml'] }),
      )

      const secrets = evidences.filter(e => e.type === 'ci_secret')
      const secretValues = secrets.map(e => e.value)
      expect(secretValues).toContain('AWS_ACCESS_KEY')
      expect(secretValues).toContain('VERCEL_TOKEN')
    })

    it('detects github-actions config file', async () => {
      const { evidences } = await extractEvidencesFromGitHub(
        mockFetchFile({
          '.github/workflows/ci.yml': 'name: CI\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest',
        }),
        mockListDir({ '.github/workflows': ['ci.yml'] }),
      )

      const configFiles = evidences.filter(e => e.type === 'config_file' && e.value === 'github-actions')
      expect(configFiles.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('config file detection', () => {
    it('detects hosting config files', async () => {
      const { evidences } = await extractEvidencesFromGitHub(
        mockFetchFile({
          'vercel.json': '{}',
          'fly.toml': 'app = "myapp"',
        }),
        mockListDir({}),
      )

      const configFiles = evidences.filter(e => e.type === 'config_file')
      const values = configFiles.map(e => e.value)
      expect(values).toContain('vercel.json')
      expect(values).toContain('fly.toml')
    })
  })

  describe('Python requirements.txt', () => {
    it('extracts pip dependencies', async () => {
      const { dependencies } = await extractEvidencesFromGitHub(
        mockFetchFile({
          'requirements.txt': 'flask>=2.0\nrequests==2.28.0\n# comment\nnumpy',
        }),
        mockListDir({}),
      )

      const pipDeps = dependencies.filter(d => d.ecosystem === 'pip')
      expect(pipDeps).toHaveLength(3)
      expect(pipDeps.map(d => d.name)).toContain('flask')
      expect(pipDeps.map(d => d.name)).toContain('requests')
      expect(pipDeps.map(d => d.name)).toContain('numpy')
    })
  })

  describe('source code extraction', () => {
    it('extracts imports from source files', async () => {
      const { evidences } = await extractEvidencesFromGitHub(
        mockFetchFile({
          'src/api.ts': `
import Stripe from 'stripe'
import { Redis } from '@upstash/redis'
`,
        }),
        mockListDir({ 'src': ['api.ts'] }),
      )

      const imports = evidences.filter(e => e.type === 'import')
      expect(imports.map(e => e.value)).toContain('stripe')
      expect(imports.map(e => e.value)).toContain('@upstash/redis')
    })

    it('captures URLs in fetch() calls', async () => {
      const { evidences } = await extractEvidencesFromGitHub(
        mockFetchFile({
          'src/api.ts': `
const res = await fetch('https://api.twitter.com/2/tweets')
const data = await fetch("https://api.sendgrid.com/v3/mail/send")
`,
        }),
        mockListDir({ 'src': ['api.ts'] }),
      )

      const urls = evidences.filter(e => e.type === 'url')
      expect(urls).toHaveLength(2)
      expect(urls.map(e => e.value)).toContain('https://api.twitter.com/2/tweets')
      expect(urls.map(e => e.value)).toContain('https://api.sendgrid.com/v3/mail/send')
    })

    it('captures URLs in axios calls', async () => {
      const { evidences } = await extractEvidencesFromGitHub(
        mockFetchFile({
          'src/client.ts': `
axios.get('https://api.upstash.com/v2/redis')
axios.post('https://api.stripe.com/v1/charges')
`,
        }),
        mockListDir({ 'src': ['client.ts'] }),
      )

      const urls = evidences.filter(e => e.type === 'url')
      expect(urls).toHaveLength(2)
      expect(urls.map(e => e.value)).toContain('https://api.upstash.com/v2/redis')
      expect(urls.map(e => e.value)).toContain('https://api.stripe.com/v1/charges')
    })

    it('captures URLs in baseURL and url config properties', async () => {
      const { evidences } = await extractEvidencesFromGitHub(
        mockFetchFile({
          'src/config.ts': `
const client = axios.create({
  baseURL: 'https://api.plausible.io/v1',
})
const redis = new Redis({ url: 'https://us1-merry-cat.upstash.io' })
`,
        }),
        mockListDir({ 'src': ['config.ts'] }),
      )

      const urls = evidences.filter(e => e.type === 'url')
      expect(urls.map(e => e.value)).toContain('https://api.plausible.io/v1')
      expect(urls.map(e => e.value)).toContain('https://us1-merry-cat.upstash.io')
    })

    it('captures process.env references that look like service URLs', async () => {
      const { evidences } = await extractEvidencesFromGitHub(
        mockFetchFile({
          'src/db.ts': `
const url = process.env.UPSTASH_REDIS_REST_URL
const dsn = process.env.SENTRY_DSN
const host = process.env.DATABASE_HOST
`,
        }),
        mockListDir({ 'src': ['db.ts'] }),
      )

      const envVars = evidences.filter(e => e.type === 'env_var')
      expect(envVars.map(e => e.value)).toContain('UPSTASH_REDIS_REST_URL')
      expect(envVars.map(e => e.value)).toContain('SENTRY_DSN')
      expect(envVars.map(e => e.value)).toContain('DATABASE_HOST')
    })

    it('does NOT capture URLs in href attributes', async () => {
      const { evidences } = await extractEvidencesFromGitHub(
        mockFetchFile({
          'src/Footer.tsx': `
<a href="https://wa.me/1234567890">WhatsApp</a>
<a href="https://reddit.com/r/myproject">Reddit</a>
<a href="https://policies.google.com/privacy">Privacy</a>
`,
        }),
        mockListDir({ 'src': ['Footer.tsx'] }),
      )

      const urls = evidences.filter(e => e.type === 'url')
      expect(urls).toHaveLength(0)
    })

    it('does NOT capture URLs in src attributes', async () => {
      const { evidences } = await extractEvidencesFromGitHub(
        mockFetchFile({
          'src/Avatar.tsx': `
<img src="https://unavatar.io/user@example.com" alt="avatar" />
<img src="https://pbs.twimg.com/profile_images/123/photo.jpg" />
`,
        }),
        mockListDir({ 'src': ['Avatar.tsx'] }),
      )

      const urls = evidences.filter(e => e.type === 'url')
      expect(urls).toHaveLength(0)
    })

    it('does NOT capture URLs in comments', async () => {
      const { evidences } = await extractEvidencesFromGitHub(
        mockFetchFile({
          'src/utils.ts': `
// See https://api.twitter.com/2/docs for details
/* API docs: https://api.stripe.com/v1 */
* Reference: https://api.sendgrid.com/v3
`,
        }),
        mockListDir({ 'src': ['utils.ts'] }),
      )

      const urls = evidences.filter(e => e.type === 'url')
      expect(urls).toHaveLength(0)
    })

    it('does NOT capture URLs from ignored domains', async () => {
      const { evidences } = await extractEvidencesFromGitHub(
        mockFetchFile({
          'src/api.ts': `
fetch('https://www.youtube.com/watch?v=123')
fetch('https://github.com/my/repo')
fetch('https://www.facebook.com/share')
`,
        }),
        mockListDir({ 'src': ['api.ts'] }),
      )

      const urls = evidences.filter(e => e.type === 'url')
      expect(urls).toHaveLength(0)
    })

    it('does NOT capture plain string URLs without API call context', async () => {
      const { evidences } = await extractEvidencesFromGitHub(
        mockFetchFile({
          'src/constants.ts': `
const HOMEPAGE = 'https://xgridnews.com'
const PRIVACY = 'https://policies.google.com/privacy'
const SUPPORT = 'https://support.google.com/accounts'
const AVATAR_URL = 'https://unavatar.io/user'
`,
        }),
        mockListDir({ 'src': ['constants.ts'] }),
      )

      const urls = evidences.filter(e => e.type === 'url')
      expect(urls).toHaveLength(0)
    })

    it('captures URLs in new URL() constructor', async () => {
      const { evidences } = await extractEvidencesFromGitHub(
        mockFetchFile({
          'src/api.ts': `
const endpoint = new URL('https://api.openai.com/v1/chat/completions')
`,
        }),
        mockListDir({ 'src': ['api.ts'] }),
      )

      const urls = evidences.filter(e => e.type === 'url')
      expect(urls).toHaveLength(1)
      expect(urls[0].value).toContain('api.openai.com')
    })

    it('captures URLs in endpoint config', async () => {
      const { evidences } = await extractEvidencesFromGitHub(
        mockFetchFile({
          'src/config.ts': `
const config = { endpoint: 'https://my-service.amazonaws.com/prod' }
`,
        }),
        mockListDir({ 'src': ['config.ts'] }),
      )

      const urls = evidences.filter(e => e.type === 'url')
      expect(urls).toHaveLength(1)
      expect(urls[0].value).toContain('amazonaws.com')
    })

    it('captures URLs assigned to constants with API-related names', async () => {
      const { evidences } = await extractEvidencesFromGitHub(
        mockFetchFile({
          'lib/twitterApiIo.ts': `
const BASE_URL = 'https://api.twitterapi.io/twitter/tweet/advanced_search'
const apiEndpoint = 'https://api.openai.com/v1/completions'
`,
        }),
        mockListDir({ 'lib': ['twitterApiIo.ts'] }),
      )

      const urls = evidences.filter(e => e.type === 'url')
      expect(urls.map(e => e.value)).toContain('https://api.twitterapi.io/twitter/tweet/advanced_search')
      expect(urls.map(e => e.value)).toContain('https://api.openai.com/v1/completions')
    })

    it('captures process.env references with KEY, SECRET, TOKEN, BEARER suffixes', async () => {
      const { evidences } = await extractEvidencesFromGitHub(
        mockFetchFile({
          'lib/api.ts': `
const apiKey = process.env.TWITTERAPI_IO_KEY
const bearer = process.env.X_API_BEARER
const secret = process.env.STRIPE_SECRET
const token = process.env.GITHUB_TOKEN
`,
        }),
        mockListDir({ 'lib': ['api.ts'] }),
      )

      const envVars = evidences.filter(e => e.type === 'env_var')
      expect(envVars.map(e => e.value)).toContain('TWITTERAPI_IO_KEY')
      expect(envVars.map(e => e.value)).toContain('X_API_BEARER')
      expect(envVars.map(e => e.value)).toContain('STRIPE_SECRET')
      expect(envVars.map(e => e.value)).toContain('GITHUB_TOKEN')
    })

    it('captures URLs in generic .get/.post calls', async () => {
      const { evidences } = await extractEvidencesFromGitHub(
        mockFetchFile({
          'src/api.ts': `
const res = await client.get('https://api.example-service.com/data')
await http.post('https://hooks.slack.com/services/T00/B00/xxx')
`,
        }),
        mockListDir({ 'src': ['api.ts'] }),
      )

      const urls = evidences.filter(e => e.type === 'url')
      expect(urls).toHaveLength(2)
    })
  })

  describe('Terraform parsing', () => {
    it('extracts terraform providers', async () => {
      const { evidences } = await extractEvidencesFromGitHub(
        mockFetchFile({
          'main.tf': `
provider "aws" {
  region = "us-east-1"
}

resource "aws_s3_bucket" "data" {
  bucket = "my-bucket"
}
`,
        }),
        mockListDir({ '.': ['main.tf'] }),
      )

      const tfEvidences = evidences.filter(e => e.type === 'config_file' && e.value.startsWith('terraform:'))
      expect(tfEvidences.map(e => e.value)).toContain('terraform:aws')
    })
  })
})
