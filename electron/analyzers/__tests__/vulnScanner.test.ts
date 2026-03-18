import { describe, it, expect, vi, beforeEach } from 'vitest'
import { scanVulnerabilities } from '../vulnScanner'
import type { Dependency } from '../../../shared/types'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  vi.resetAllMocks()
})

function makeDep(overrides: Partial<Dependency> & { name: string; ecosystem: Dependency['ecosystem'] }): Dependency {
  return {
    version: '1.0.0',
    type: 'production',
    ...overrides,
  }
}

function makeOsvResponse(results: any[]) {
  return {
    ok: true,
    json: async () => ({ results }),
  }
}

describe('scanVulnerabilities', () => {
  it('returns empty results for empty dependencies', async () => {
    const result = await scanVulnerabilities([])
    expect(result.results).toEqual([])
    expect(result.partial).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  describe('ecosystem mapping', () => {
    const ecosystemCases: [Dependency['ecosystem'], string][] = [
      ['npm', 'npm'],
      ['pip', 'PyPI'],
      ['cargo', 'crates.io'],
      ['go', 'Go'],
      ['composer', 'Packagist'],
      ['gem', 'RubyGems'],
      ['maven', 'Maven'],
      ['dart', 'Pub'],
    ]

    it.each(ecosystemCases)('maps %s to OSV ecosystem %s', async (ecosystem, osvEcosystem) => {
      mockFetch.mockResolvedValue(makeOsvResponse([{ vulns: [] }]))

      await scanVulnerabilities([makeDep({ name: 'test-pkg', ecosystem })])

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.queries[0].package.ecosystem).toBe(osvEcosystem)
    })
  })

  it('strips version prefix characters', async () => {
    mockFetch.mockResolvedValue(makeOsvResponse([{ vulns: [] }]))

    await scanVulnerabilities([makeDep({ name: 'lodash', ecosystem: 'npm', version: '^4.17.21' })])

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.queries[0].version).toBe('4.17.21')
  })

  it('skips dependencies with unknown ecosystem', async () => {
    const deps = [makeDep({ name: 'test', ecosystem: 'unknown' as any })]
    const result = await scanVulnerabilities(deps)
    expect(result.results).toEqual([])
    expect(mockFetch).not.toHaveBeenCalled()
  })

  describe('batching', () => {
    it('splits more than 100 deps into batches of 100', async () => {
      const deps: Dependency[] = Array.from({ length: 150 }, (_, i) =>
        makeDep({ name: `pkg-${i}`, ecosystem: 'npm' })
      )
      mockFetch.mockResolvedValue(makeOsvResponse(deps.map(() => ({ vulns: [] }))))

      await scanVulnerabilities(deps)

      expect(mockFetch).toHaveBeenCalledTimes(2)
      const batch1 = JSON.parse(mockFetch.mock.calls[0][1].body)
      const batch2 = JSON.parse(mockFetch.mock.calls[1][1].body)
      expect(batch1.queries).toHaveLength(100)
      expect(batch2.queries).toHaveLength(50)
    })
  })

  describe('response parsing', () => {
    it('maps OSV vulns to DepVulnResult', async () => {
      const deps = [makeDep({ name: 'lodash', ecosystem: 'npm', version: '4.17.20' })]
      mockFetch.mockResolvedValue(makeOsvResponse([{
        vulns: [{
          id: 'GHSA-1234',
          summary: 'Prototype pollution',
          severity: [{ score: 7.5 }],
          aliases: ['CVE-2021-12345'],
          affected: [{ ranges: [{ events: [{ fixed: '4.17.21' }] }] }],
          references: [{ url: 'https://github.com/advisories/GHSA-1234' }],
        }],
      }]))

      const { results } = await scanVulnerabilities(deps)

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('lodash')
      expect(results[0].ecosystem).toBe('npm')
      expect(results[0].version).toBe('4.17.20')
      expect(results[0].vulnerabilities).toHaveLength(1)
      expect(results[0].vulnerabilities[0]).toEqual({
        id: 'GHSA-1234',
        summary: 'Prototype pollution',
        severity: 'high',
        aliases: ['CVE-2021-12345'],
        fixedVersion: '4.17.21',
        url: 'https://github.com/advisories/GHSA-1234',
      })
    })

    it('limits to 5 vulnerabilities per dependency', async () => {
      const vulns = Array.from({ length: 10 }, (_, i) => ({
        id: `VULN-${i}`,
        summary: `Vuln ${i}`,
        severity: [],
        aliases: [],
      }))
      mockFetch.mockResolvedValue(makeOsvResponse([{ vulns }]))

      const { results } = await scanVulnerabilities([makeDep({ name: 'pkg', ecosystem: 'npm' })])

      expect(results[0].vulnerabilities).toHaveLength(5)
    })

    it('skips deps with no vulns', async () => {
      mockFetch.mockResolvedValue(makeOsvResponse([{ vulns: [] }]))

      const { results } = await scanVulnerabilities([makeDep({ name: 'safe-pkg', ecosystem: 'npm' })])

      expect(results).toEqual([])
    })
  })

  describe('severity mapping', () => {
    const severityCases: [number, string][] = [
      [9.5, 'critical'],
      [9.0, 'critical'],
      [7.5, 'high'],
      [7.0, 'high'],
      [5.0, 'medium'],
      [4.0, 'medium'],
      [2.0, 'low'],
      [0.1, 'low'],
    ]

    it.each(severityCases)('maps CVSS score %s to %s', async (score, expected) => {
      mockFetch.mockResolvedValue(makeOsvResponse([{
        vulns: [{
          id: 'TEST-1',
          summary: 'test',
          severity: [{ score }],
          aliases: [],
        }],
      }]))

      const { results } = await scanVulnerabilities([makeDep({ name: 'pkg', ecosystem: 'npm' })])

      expect(results[0].vulnerabilities[0].severity).toBe(expected)
    })

    it('returns unknown for empty severity array', async () => {
      mockFetch.mockResolvedValue(makeOsvResponse([{
        vulns: [{
          id: 'TEST-1',
          summary: 'test',
          severity: [],
          aliases: [],
        }],
      }]))

      const { results } = await scanVulnerabilities([makeDep({ name: 'pkg', ecosystem: 'npm' })])

      expect(results[0].vulnerabilities[0].severity).toBe('unknown')
    })
  })

  describe('error handling', () => {
    it('returns partial result on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const result = await scanVulnerabilities([makeDep({ name: 'pkg', ecosystem: 'npm' })])

      expect(result.results).toEqual([])
      expect(result.partial).toBe(true)
      expect(result.error).toContain('1/1 batches failed')
    })

    it('returns partial result on non-200 response', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 })

      const result = await scanVulnerabilities([makeDep({ name: 'pkg', ecosystem: 'npm' })])

      expect(result.results).toEqual([])
      expect(result.partial).toBe(true)
    })

    it('returns partial result on timeout', async () => {
      mockFetch.mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'))

      const result = await scanVulnerabilities([makeDep({ name: 'pkg', ecosystem: 'npm' })])

      expect(result.results).toEqual([])
      expect(result.partial).toBe(true)
    })

    it('retries on HTTP 429', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 429 })
        .mockResolvedValueOnce(makeOsvResponse([{ vulns: [] }]))

      const result = await scanVulnerabilities([makeDep({ name: 'pkg', ecosystem: 'npm' })])

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result.partial).toBe(false)
    })
  })
})
