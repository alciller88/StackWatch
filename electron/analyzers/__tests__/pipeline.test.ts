import { describe, it, expect } from 'vitest'
import { analyzeGitHubRepo } from '../index'

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
    expect(result.flowNodes[0].type).toBe('user')
    expect(result.flowEdges).toHaveLength(0)
  })

  it('analyzes a minimal repo with package.json containing stripe and react', async () => {
    const result = await analyzeGitHubRepo(
      mockFetchFile({
        'package.json': JSON.stringify({
          dependencies: { 'stripe': '^12.0.0', 'react': '^18.2.0' },
        }),
      }),
      mockListDir({}),
    )

    expect(result.dependencies).toHaveLength(2)
    expect(result.dependencies.map(d => d.name)).toContain('stripe')
    expect(result.dependencies.map(d => d.name)).toContain('react')

    // Stripe should be detected as a service
    const stripeSvc = result.services.find(s => s.name === 'Stripe')
    expect(stripeSvc).toBeDefined()
    expect(stripeSvc!.category).toBe('payments')

    // Frontend node should exist
    const frontendNode = result.flowNodes.find(n => n.type === 'frontend')
    expect(frontendNode).toBeDefined()
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
      }),
      mockListDir({}),
    )

    const nodeTypes = result.flowNodes.map(n => n.type)
    expect(nodeTypes).toContain('user')
    expect(nodeTypes).toContain('frontend')
    expect(nodeTypes).toContain('api')

    // Stripe should produce an external node
    const stripeNode = result.flowNodes.find(n => n.label === 'Stripe')
    expect(stripeNode).toBeDefined()
    expect(stripeNode!.type).toBe('external')

    // Should have edges connecting the flow
    const frontendToApi = result.flowEdges.find(
      e => e.source === 'frontend' && e.target === 'api',
    )
    expect(frontendToApi).toBeDefined()
    expect(frontendToApi!.flowType).toBe('data')

    // Payment edge from api to stripe
    const paymentEdge = result.flowEdges.find(e => e.flowType === 'payment')
    expect(paymentEdge).toBeDefined()
    expect(paymentEdge!.source).toBe('api')
  })
})
