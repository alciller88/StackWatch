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
    it('extracts URLs and imports from source files', async () => {
      const { evidences } = await extractEvidencesFromGitHub(
        mockFetchFile({
          'src/api.ts': `
import Stripe from 'stripe'
const url = 'https://api.sendgrid.com/v3/mail/send'
`,
        }),
        mockListDir({ 'src': ['api.ts'] }),
      )

      const imports = evidences.filter(e => e.type === 'import')
      expect(imports.map(e => e.value)).toContain('stripe')

      const urls = evidences.filter(e => e.type === 'url')
      expect(urls.length).toBeGreaterThanOrEqual(1)
      expect(urls[0].value).toContain('sendgrid.com')
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
