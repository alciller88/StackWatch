// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Service, Evidence } from '../../types'
import type { ZombieResult } from '../zombieDetector'

// ── Mock child_process.execFile ──
// The source uses `promisify(execFile)`. Node's `execFile` has a custom
// `util.promisify.custom` that makes `promisify(execFile)` return a
// different function from standard promisify wrapping.
// We mock child_process with `__esModule: true` and provide execFile
// that has the custom promisify symbol.

const { execFileAsyncMock } = vi.hoisted(() => {
  return { execFileAsyncMock: vi.fn() }
})

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>()
  const { promisify } = await import('util')

  // Create a wrapper around the original execFile
  const mockExecFile = Object.assign(
    ((...args: any[]) => (actual.execFile as Function)(...args)) as typeof actual.execFile,
    {
      // Override the promisify custom symbol to return our mock
      [promisify.custom]: execFileAsyncMock,
    },
  )

  return {
    ...actual,
    execFile: mockExecFile,
  }
})

import { detectZombieServices, enrichServicesWithZombieData } from '../zombieDetector'

function mockExecFile(dateMap: Record<string, string>) {
  execFileAsyncMock.mockImplementation(
    (_cmd: string, args: string[], _opts: any) => {
      const filePath = args[args.length - 1]
      const date = dateMap[filePath]
      if (date) {
        return Promise.resolve({ stdout: date + '\n', stderr: '' })
      }
      return Promise.reject(new Error('not found'))
    },
  )
}

function mockExecFileError() {
  execFileAsyncMock.mockImplementation(
    () => Promise.reject(new Error('git failed')),
  )
}

// ── Helpers ──

function makeService(overrides: Partial<Service> & { id: string; name: string }): Service {
  return {
    category: 'other',
    plan: 'unknown',
    source: 'inferred',
    confidence: 'medium',
    ...overrides,
  }
}

function makeEvidence(overrides: Partial<Evidence> & { value: string; file: string }): Evidence {
  return {
    type: 'npm_package',
    ...overrides,
  }
}

// ── Tests ──

describe('detectZombieServices', () => {
  beforeEach(() => {
    execFileAsyncMock.mockReset()
  })

  it('returns empty array for empty services', async () => {
    const result = await detectZombieServices([], [], '/repo')
    expect(result).toEqual([])
  })

  it('skips manual services (only processes inferred)', async () => {
    const services: Service[] = [
      makeService({ id: 'manual-svc', name: 'ManualService', source: 'manual' }),
    ]
    const result = await detectZombieServices(services, [], '/repo')
    expect(result).toEqual([])
  })

  it('classifies as active when last activity is less than 90 days ago', async () => {
    const recentDate = new Date()
    recentDate.setDate(recentDate.getDate() - 30)
    const isoDate = recentDate.toISOString()

    mockExecFile({ 'package.json': isoDate })

    const services: Service[] = [
      makeService({ id: 'stripe', name: 'Stripe', inferredFrom: 'package.json' }),
    ]

    const result = await detectZombieServices(services, [], '/repo')
    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('active')
    expect(result[0].serviceId).toBe('stripe')
    expect(result[0].daysSinceActivity).toBeGreaterThanOrEqual(29)
    expect(result[0].daysSinceActivity).toBeLessThanOrEqual(31)
  })

  it('classifies as stale when last activity is 90-179 days ago', async () => {
    const staleDate = new Date()
    staleDate.setDate(staleDate.getDate() - 120)
    const isoDate = staleDate.toISOString()

    mockExecFile({ '.env': isoDate })

    const services: Service[] = [
      makeService({ id: 'redis', name: 'Redis', inferredFrom: '.env' }),
    ]

    const result = await detectZombieServices(services, [], '/repo')
    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('stale')
  })

  it('classifies as zombie when last activity is 180+ days ago', async () => {
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 200)
    const isoDate = oldDate.toISOString()

    mockExecFile({ 'config.yml': isoDate })

    const services: Service[] = [
      makeService({ id: 'sentry', name: 'Sentry', inferredFrom: 'config.yml' }),
    ]

    const result = await detectZombieServices(services, [], '/repo')
    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('zombie')
  })

  it('defaults to active when service has no evidence files', async () => {
    const services: Service[] = [
      makeService({ id: 'unknown', name: 'UnknownSvc' }),
    ]

    const result = await detectZombieServices(services, [], '/repo')
    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('active')
    expect(result[0].lastActivityDate).toBeNull()
    expect(result[0].daysSinceActivity).toBeNull()
  })

  it('defaults to active when git log fails for all files', async () => {
    mockExecFileError()

    const services: Service[] = [
      makeService({ id: 'stripe', name: 'Stripe', inferredFrom: 'package.json' }),
    ]

    const result = await detectZombieServices(services, [], '/repo')
    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('active')
    expect(result[0].lastActivityDate).toBeNull()
  })

  it('caches file dates (does not call git log twice for same file)', async () => {
    const recentDate = new Date()
    recentDate.setDate(recentDate.getDate() - 10)
    const isoDate = recentDate.toISOString()

    mockExecFile({ 'package.json': isoDate })

    const services: Service[] = [
      makeService({ id: 'stripe', name: 'Stripe', inferredFrom: 'package.json' }),
      makeService({ id: 'sentry', name: 'Sentry', inferredFrom: 'package.json' }),
    ]

    await detectZombieServices(services, [], '/repo')

    // The promisified execFile async mock should only be called once for the same file
    const gitCalls = execFileAsyncMock.mock.calls.filter(
      (call: any[]) => call[1][call[1].length - 1] === 'package.json',
    )
    expect(gitCalls).toHaveLength(1)
  })

  it('uses most recent date when service has multiple evidence files', async () => {
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 200)
    const recentDate = new Date()
    recentDate.setDate(recentDate.getDate() - 10)

    mockExecFile({
      'package.json': oldDate.toISOString(),
      '.env': recentDate.toISOString(),
    })

    const services: Service[] = [
      makeService({ id: 'stripe', name: 'Stripe', inferredFrom: 'package.json' }),
    ]

    const evidences: Evidence[] = [
      makeEvidence({ value: 'STRIPE_KEY=xxx', file: '.env' }),
    ]

    const result = await detectZombieServices(services, evidences, '/repo')
    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('active')
  })
})

describe('enrichServicesWithZombieData', () => {
  it('adds zombie fields to matching services', () => {
    const services: Service[] = [
      makeService({ id: 'stripe', name: 'Stripe' }),
      makeService({ id: 'redis', name: 'Redis' }),
    ]

    const zombieResults: ZombieResult[] = [
      { serviceId: 'stripe', lastActivityDate: '2024-01-01', daysSinceActivity: 200, status: 'zombie' },
    ]

    const enriched = enrichServicesWithZombieData(services, zombieResults)
    expect(enriched[0].zombieStatus).toBe('zombie')
    expect(enriched[0].daysSinceActivity).toBe(200)
    expect(enriched[0].lastActivityDate).toBe('2024-01-01')
  })

  it('leaves non-matching services unchanged', () => {
    const services: Service[] = [
      makeService({ id: 'stripe', name: 'Stripe' }),
      makeService({ id: 'redis', name: 'Redis' }),
    ]

    const zombieResults: ZombieResult[] = [
      { serviceId: 'stripe', lastActivityDate: '2024-01-01', daysSinceActivity: 200, status: 'zombie' },
    ]

    const enriched = enrichServicesWithZombieData(services, zombieResults)
    expect(enriched[1].zombieStatus).toBeUndefined()
    expect(enriched[1].daysSinceActivity).toBeUndefined()
    expect(enriched[1].id).toBe('redis')
  })

  it('handles empty zombie results', () => {
    const services: Service[] = [
      makeService({ id: 'stripe', name: 'Stripe' }),
    ]

    const enriched = enrichServicesWithZombieData(services, [])
    expect(enriched).toEqual(services)
  })
})
