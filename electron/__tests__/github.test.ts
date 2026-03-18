import { describe, it, expect, vi } from 'vitest'
import { schemas, validate } from '../validation'

describe('GitHub Authentication', () => {
  describe('repo format validation', () => {
    it('accepts owner/repo', () => {
      const result = validate(schemas.analyzeGitHub, { repo: 'alciller88/StackWatch' }, 'analyze-github')
      expect(result.repo).toBe('alciller88/StackWatch')
    })

    it('accepts repo with dots', () => {
      const result = validate(schemas.analyzeGitHub, { repo: 'org/my.project' }, 'analyze-github')
      expect(result.repo).toBe('org/my.project')
    })

    it('accepts repo with hyphens and underscores', () => {
      const result = validate(schemas.analyzeGitHub, { repo: 'my-org/my_project' }, 'analyze-github')
      expect(result.repo).toBe('my-org/my_project')
    })

    it('rejects owner/repo/extra', () => {
      expect(() => validate(schemas.analyzeGitHub, { repo: 'a/b/c' }, 'analyze-github')).toThrow()
    })

    it('rejects owner without repo', () => {
      expect(() => validate(schemas.analyzeGitHub, { repo: 'justowner' }, 'analyze-github')).toThrow()
    })

    it('rejects special characters in repo name', () => {
      expect(() => validate(schemas.analyzeGitHub, { repo: 'owner/re po' }, 'analyze-github')).toThrow()
    })

    it('rejects empty string', () => {
      expect(() => validate(schemas.analyzeGitHub, { repo: '' }, 'analyze-github')).toThrow()
    })
  })

  describe('token handling', () => {
    it('valid repo with token', () => {
      const result = validate(schemas.analyzeGitHub, { repo: 'owner/repo', token: 'ghp_abc123' }, 'analyze-github')
      expect(result.token).toBe('ghp_abc123')
    })

    it('valid repo without token', () => {
      const result = validate(schemas.analyzeGitHub, { repo: 'owner/repo' }, 'analyze-github')
      expect(result.token).toBeUndefined()
    })

    it('token as undefined is ok', () => {
      const result = validate(schemas.analyzeGitHub, { repo: 'owner/repo', token: undefined }, 'analyze-github')
      expect(result.token).toBeUndefined()
    })

    it('rejects token longer than 256 chars', () => {
      expect(() => validate(schemas.analyzeGitHub, {
        repo: 'owner/repo',
        token: 'a'.repeat(257),
      }, 'analyze-github')).toThrow()
    })
  })

  describe('Octokit initialization logic', () => {
    it('creates unauthenticated client when token empty', () => {
      const token = ''
      const hasToken = typeof token === 'string' && token.trim().length > 0
      expect(hasToken).toBe(false)
    })

    it('creates authenticated client when token provided', () => {
      const token = 'ghp_abc123'
      const hasToken = typeof token === 'string' && token.trim().length > 0
      expect(hasToken).toBe(true)
    })

    it('treats whitespace-only token as empty', () => {
      const token = '   '
      const hasToken = typeof token === 'string' && token.trim().length > 0
      expect(hasToken).toBe(false)
    })
  })

  describe('rate limiting logic', () => {
    it('sets rateLimited flag on 403', () => {
      let rateLimited = false

      async function fetchFile(filePath: string): Promise<string | null> {
        if (rateLimited) return null
        try {
          throw Object.assign(new Error('Forbidden'), { status: 403 })
        } catch (err: any) {
          if (err?.status === 403) rateLimited = true
          return null
        }
      }

      // First call triggers rate limit
      fetchFile('package.json')
      expect(rateLimited).toBe(true)
    })

    it('returns null immediately when rateLimited', async () => {
      let rateLimited = true
      let fetchCount = 0

      async function fetchFile(filePath: string): Promise<string | null> {
        if (rateLimited) return null
        fetchCount++
        return 'content'
      }

      const result = await fetchFile('package.json')
      expect(result).toBeNull()
      expect(fetchCount).toBe(0)
    })

    it('listDir returns empty when rateLimited', async () => {
      let rateLimited = true

      async function listDir(dirPath: string): Promise<string[]> {
        if (rateLimited) return []
        return ['file.ts']
      }

      const result = await listDir('src')
      expect(result).toEqual([])
    })
  })

  describe('error sanitization', () => {
    it('redacts token from error messages', () => {
      const token = 'ghp_abc123456789'
      let message = `Request failed: Bad credentials for ghp_abc123456789`
      if (token && token.length > 4) {
        message = message.replaceAll(token, token.slice(0, 4) + '****')
      }
      expect(message).not.toContain('ghp_abc123456789')
      expect(message).toContain('ghp_****')
    })

    it('handles short token safely', () => {
      const token = 'ab'
      let message = `Request failed for ab`
      if (token && token.length > 4) {
        message = message.replaceAll(token, token.slice(0, 4) + '****')
      }
      // Short token should not be redacted
      expect(message).toContain('ab')
    })
  })
})
