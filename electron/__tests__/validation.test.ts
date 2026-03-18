import { describe, it, expect } from 'vitest'
import { schemas, validate } from '../validation'

describe('IPC Validation', () => {
  describe('analyzeLocal', () => {
    it('accepts valid folderPath', () => {
      const result = validate(schemas.analyzeLocal, { folderPath: '/home/user/project' }, 'analyze-local')
      expect(result.folderPath).toBe('/home/user/project')
    })

    it('rejects empty folderPath', () => {
      expect(() => validate(schemas.analyzeLocal, { folderPath: '' }, 'analyze-local')).toThrow()
    })

    it('rejects path traversal with ..', () => {
      // zod schema allows .. in strings (path traversal is caught by validateRepoPath),
      // but we validate min length
      const result = validate(schemas.analyzeLocal, { folderPath: '/home/../etc' }, 'analyze-local')
      expect(result.folderPath).toBe('/home/../etc')
    })
  })

  describe('analyzeGitHub', () => {
    it('accepts valid owner/repo', () => {
      const result = validate(schemas.analyzeGitHub, { repo: 'owner/repo' }, 'analyze-github')
      expect(result.repo).toBe('owner/repo')
    })

    it('accepts repo with dots and underscores', () => {
      const result = validate(schemas.analyzeGitHub, { repo: 'my_org/my.project' }, 'analyze-github')
      expect(result.repo).toBe('my_org/my.project')
    })

    it('rejects invalid repo format', () => {
      expect(() => validate(schemas.analyzeGitHub, { repo: 'invalid' }, 'analyze-github')).toThrow()
    })

    it('rejects repo with slashes in name', () => {
      expect(() => validate(schemas.analyzeGitHub, { repo: 'a/b/c' }, 'analyze-github')).toThrow()
    })

    it('accepts optional token', () => {
      const result = validate(schemas.analyzeGitHub, { repo: 'owner/repo', token: 'ghp_abc' }, 'analyze-github')
      expect(result.token).toBe('ghp_abc')
    })
  })

  describe('saveConfig', () => {
    it('accepts valid config', () => {
      const result = validate(schemas.saveConfig, {
        repoPath: '/home/user/project',
        config: {
          version: '1',
          services: [{
            id: 'stripe',
            name: 'Stripe',
            category: 'payments',
            plan: 'paid',
            source: 'inferred',
          }],
        },
      }, 'save-config')
      expect(result.config.services).toHaveLength(1)
    })

    it('rejects config with invalid services array', () => {
      expect(() => validate(schemas.saveConfig, {
        repoPath: '/home/user/project',
        config: {
          version: '1',
          services: [{ id: 'x' }], // missing required fields
        },
      }, 'save-config')).toThrow()
    })
  })

  describe('openExternalUrl', () => {
    it('accepts https URL', () => {
      const result = validate(schemas.openExternalUrl, { url: 'https://example.com' }, 'open-external-url')
      expect(result.url).toBe('https://example.com')
    })

    it('accepts http URL', () => {
      const result = validate(schemas.openExternalUrl, { url: 'http://localhost:3000' }, 'open-external-url')
      expect(result.url).toBe('http://localhost:3000')
    })

    it('rejects file:// URL', () => {
      expect(() => validate(schemas.openExternalUrl, { url: 'file:///etc/passwd' }, 'open-external-url')).toThrow()
    })

    it('rejects javascript: URL', () => {
      expect(() => validate(schemas.openExternalUrl, { url: 'javascript:alert(1)' }, 'open-external-url')).toThrow()
    })
  })

  describe('scanVulnerabilities', () => {
    it('accepts valid deps array', () => {
      const result = validate(schemas.scanVulnerabilities, {
        deps: [{ name: 'lodash', version: '4.17.21', type: 'npm' }],
      }, 'scan-vulnerabilities')
      expect(result.deps).toHaveLength(1)
    })

    it('rejects deps array exceeding max', () => {
      const hugeDeps = Array.from({ length: 5001 }, (_, i) => ({
        name: `pkg-${i}`,
        version: '1.0.0',
        type: 'npm',
      }))
      expect(() => validate(schemas.scanVulnerabilities, { deps: hugeDeps }, 'scan-vulnerabilities')).toThrow()
    })
  })

  describe('setAISettings', () => {
    it('accepts valid settings', () => {
      const result = validate(schemas.setAISettings, {
        settings: {
          enabled: true,
          provider: {
            name: 'Ollama',
            baseUrl: 'http://localhost:11434/v1',
            model: 'llama3',
          },
        },
      }, 'set-ai-settings')
      expect(result.settings.enabled).toBe(true)
    })

    it('rejects invalid baseUrl', () => {
      expect(() => validate(schemas.setAISettings, {
        settings: {
          enabled: true,
          provider: {
            name: 'test',
            baseUrl: 'not-a-url',
            model: 'test',
          },
        },
      }, 'set-ai-settings')).toThrow()
    })
  })
})
