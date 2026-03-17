import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import { analyzeGitHubRepo } from '../index'
import type { AISettings } from '../../types'

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

describe('analyzeGitHubRepo pipeline', () => {
  it('returns empty results for an empty repo', async () => {
    const result = await analyzeGitHubRepo(
      mockFetchFile({}),
      mockListDir({}),
    )

    expect(result.services).toHaveLength(0)
    expect(result.dependencies).toHaveLength(0)
    // User node is always present
    expect(result.flowNodes).toHaveLength(1)
    expect(result.flowNodes[0].type).toBe('layer')
    expect(result.flowEdges).toHaveLength(0)
  })

  it('analyzes a repo with stripe npm + env var (multi-evidence detection)', async () => {
    const result = await analyzeGitHubRepo(
      mockFetchFile({
        'package.json': JSON.stringify({
          dependencies: { 'stripe': '^12.0.0', 'react': '^18.2.0' },
        }),
        '.env.example': 'STRIPE_SECRET_KEY=sk_test_xxx',
      }),
      mockListDir({}),
    )

    expect(result.dependencies).toHaveLength(2)
    expect(result.dependencies.map(d => d.name)).toContain('stripe')
    expect(result.dependencies.map(d => d.name)).toContain('react')

    // Stripe should be detected as a service (npm score 1 + env_var score 7 = 8)
    const stripeSvc = result.services.find(s => s.name === 'Stripe')
    expect(stripeSvc).toBeDefined()
    expect(stripeSvc!.category).toBe('payments')

    // Backend node should exist (Stripe is a payments service → backend)
    const backendNode = result.flowNodes.find(n => n.id === 'api')
    expect(backendNode).toBeDefined()
    expect(backendNode!.type).toBe('layer')
  })

  it('discards npm-only packages without additional evidence', async () => {
    const result = await analyzeGitHubRepo(
      mockFetchFile({
        'package.json': JSON.stringify({
          dependencies: { 'stripe': '^12.0.0', 'react': '^18.2.0' },
        }),
      }),
      mockListDir({}),
    )

    // Without env vars, stripe (score 1 - 4 npm-only penalty = -3) is below threshold
    const stripeSvc = result.services.find(s => s.name === 'Stripe')
    expect(stripeSvc).toBeUndefined()
  })

  it('returns services and dependencies from a repo with package.json and .env', async () => {
    const result = await analyzeGitHubRepo(
      mockFetchFile({
        'package.json': JSON.stringify({
          dependencies: { 'express': '^4.18.0' },
        }),
        '.env.example': 'REDIS_URL=redis://localhost:6379\nSENDGRID_API_KEY=SG.xxx',
      }),
      mockListDir({}),
    )

    expect(result.dependencies).toHaveLength(1)
    expect(result.dependencies[0].name).toBe('express')

    const serviceNames = result.services.map(s => s.name)
    expect(serviceNames).toContain('Redis')
    expect(serviceNames).toContain('Sendgrid')
  })

  it('generates flow nodes when both frontend and backend deps are present', async () => {
    const result = await analyzeGitHubRepo(
      mockFetchFile({
        'package.json': JSON.stringify({
          dependencies: {
            'react': '^18.2.0',
            'express': '^4.18.0',
            'stripe': '^12.0.0',
          },
        }),
        '.env.example': 'STRIPE_SECRET_KEY=sk_test_xxx',
      }),
      mockListDir({}),
    )

    const nodeIds = result.flowNodes.map(n => n.id)
    expect(nodeIds).toContain('user')
    // No hosting/cdn service → no frontend virtual node
    expect(nodeIds).toContain('api')
    // User and Backend are now layer nodes
    expect(result.flowNodes.find(n => n.id === 'user')!.type).toBe('layer')
    expect(result.flowNodes.find(n => n.id === 'api')!.type).toBe('layer')

    // Stripe should produce an external node
    const stripeNode = result.flowNodes.find(n => n.label === 'Stripe')
    expect(stripeNode).toBeDefined()
    expect(stripeNode!.type).toBe('external')

    // Payment edge from backend to stripe
    const paymentEdge = result.flowEdges.find(e => e.flowType === 'payment')
    expect(paymentEdge).toBeDefined()
    expect(paymentEdge!.source).toBe('api')
  })
})

describe('hybrid pipeline checkpoint behavior', () => {
  let originalFetch: typeof globalThis.fetch

  beforeAll(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  const hybridSettings: AISettings = {
    enabled: true,
    scanMode: 'hybrid',
    provider: {
      name: 'test',
      baseUrl: 'http://localhost:1234/v1',
      model: 'test-model',
      apiKey: 'test-key',
    },
  }

  it('falls back to heuristic results when AI fetch throws', async () => {
    // Make fetch always throw to simulate network failure
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')))

    const result = await analyzeGitHubRepo(
      mockFetchFile({
        'package.json': JSON.stringify({
          dependencies: { 'stripe': '^12.0.0', 'redis': '^4.0.0' },
        }),
        '.env.example': 'STRIPE_SECRET_KEY=sk_test_xxx\nREDIS_URL=redis://localhost:6379',
      }),
      mockListDir({}),
      hybridSettings,
    )

    // Services should be the heuristic results, not empty or partially modified
    const serviceNames = result.services.map(s => s.name)
    expect(serviceNames).toContain('Stripe')
    expect(serviceNames).toContain('Redis')
    // aiError should be set
    expect(result.aiError).toBeDefined()
    expect(result.aiError).toContain('Connection refused')
  })

  it('falls back to heuristic results when AI returns non-ok HTTP status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }))

    const result = await analyzeGitHubRepo(
      mockFetchFile({
        'package.json': JSON.stringify({
          dependencies: { 'stripe': '^12.0.0', 'express': '^4.18.0' },
        }),
        '.env.example': 'REDIS_URL=redis://localhost:6379\nSTRIPE_SECRET_KEY=sk_test_xxx',
      }),
      mockListDir({}),
      hybridSettings,
    )

    // Heuristic services should all be present (checkpoint restored)
    const serviceNames = result.services.map(s => s.name)
    expect(serviceNames).toContain('Stripe')
    expect(serviceNames).toContain('Redis')
    expect(result.aiError).toContain('AI HTTP 500')
    // Deep analysis should not be present
    expect(result.deepAnalysis).toBeUndefined()
  })
})
