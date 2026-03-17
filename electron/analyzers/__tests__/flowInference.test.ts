import { describe, it, expect } from 'vitest'
import { inferFlowGraph } from '../flowInference'
import type { Service, Dependency } from '../../types'

function makeService(overrides: Partial<Service> & Pick<Service, 'id' | 'name' | 'category'>): Service {
  return {
    plan: 'unknown',
    source: 'inferred',
    ...overrides,
  }
}

function makeDep(name: string): Dependency {
  return { name, version: '*', type: 'production', ecosystem: 'npm' }
}

describe('inferFlowGraph', () => {
  it('always creates a user node even with empty inputs', () => {
    const { nodes, edges } = inferFlowGraph([], [])
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toEqual({ id: 'user', label: 'User', type: 'user' })
    expect(edges).toHaveLength(0)
  })

  it('creates frontend virtual node when hosting service present', () => {
    const services = [
      makeService({ id: 'vercel', name: 'Vercel', category: 'hosting' }),
    ]
    const { nodes } = inferFlowGraph(services, [])
    const frontend = nodes.find(n => n.id === 'frontend')
    expect(frontend).toBeDefined()
    expect(frontend!.type).toBe('frontend')
    expect(frontend!.label).toBe('Frontend')
  })

  it('creates backend virtual node when database service present', () => {
    const services = [
      makeService({ id: 'pg', name: 'PostgreSQL', category: 'database' }),
    ]
    const { nodes } = inferFlowGraph(services, [])
    const api = nodes.find(n => n.id === 'api')
    expect(api).toBeDefined()
    expect(api!.type).toBe('api')
    expect(api!.label).toBe('Backend')
  })

  it('creates database nodes for services with category database', () => {
    const services = [
      makeService({ id: 'pg', name: 'PostgreSQL', category: 'database' }),
      makeService({ id: 'redis', name: 'Redis', category: 'database' }),
    ]
    const { nodes } = inferFlowGraph(services, [])
    const dbNodes = nodes.filter(n => n.type === 'database')
    expect(dbNodes).toHaveLength(2)
    expect(dbNodes.map(n => n.label)).toContain('PostgreSQL')
    expect(dbNodes.map(n => n.label)).toContain('Redis')
    expect(dbNodes[0].serviceId).toBe('pg')
  })

  it('creates external nodes for services with external categories', () => {
    const services = [
      makeService({ id: 'stripe', name: 'Stripe', category: 'payments' }),
      makeService({ id: 'sendgrid', name: 'SendGrid', category: 'email' }),
      makeService({ id: 'ga', name: 'Google Analytics', category: 'analytics' }),
      makeService({ id: 'vercel', name: 'Vercel', category: 'hosting' }),
    ]
    const { nodes } = inferFlowGraph(services, [])
    const externalNodes = nodes.filter(n => n.type === 'external')
    expect(externalNodes).toHaveLength(4) // Stripe, SendGrid, GA, Vercel (hosting → external)
    expect(externalNodes.map(n => n.label)).toContain('Stripe')
    expect(externalNodes.map(n => n.label)).toContain('SendGrid')
    expect(externalNodes.map(n => n.label)).toContain('Google Analytics')
    expect(externalNodes.map(n => n.label)).toContain('Vercel')
  })

  it('includes all categories including ai', () => {
    const services = [
      makeService({ id: 'openai', name: 'OpenAI', category: 'ai' }),
    ]
    const { nodes } = inferFlowGraph(services, [])
    const aiNode = nodes.find(n => n.serviceId === 'openai')
    expect(aiNode).toBeDefined()
    expect(aiNode!.type).toBe('external')
    expect(aiNode!.label).toBe('OpenAI')
  })

  it('routes cdn services through frontend virtual node', () => {
    const services = [
      makeService({ id: 'cf', name: 'Cloudflare', category: 'cdn' }),
    ]
    const { nodes, edges } = inferFlowGraph(services, [])
    const frontend = nodes.find(n => n.id === 'frontend')
    expect(frontend).toBeDefined()

    const userToFrontend = edges.find(e => e.source === 'user' && e.target === 'frontend')
    expect(userToFrontend).toBeDefined()

    const frontendToCdn = edges.find(e => e.source === 'frontend' && e.target === 'svc-cf')
    expect(frontendToCdn).toBeDefined()
  })

  it('assigns flowType payment to payment service edges', () => {
    const services = [
      makeService({ id: 'stripe', name: 'Stripe', category: 'payments' }),
    ]
    const { edges } = inferFlowGraph(services, [])
    const paymentEdge = edges.find(e => e.target === 'svc-stripe')
    expect(paymentEdge).toBeDefined()
    expect(paymentEdge!.flowType).toBe('payment')
  })

  it('assigns flowType auth to auth service edges', () => {
    const services = [
      makeService({ id: 'auth0', name: 'Auth0', category: 'auth' }),
      makeService({ id: 'vercel', name: 'Vercel', category: 'hosting' }),
    ]
    const { edges } = inferFlowGraph(services, [])
    const authEdge = edges.find(e => e.target === 'svc-auth0')
    expect(authEdge).toBeDefined()
    expect(authEdge!.flowType).toBe('auth')
  })

  // ── Hierarchical layout tests ──

  it('creates frontend → backend edge when both virtual nodes exist', () => {
    const services = [
      makeService({ id: 'vercel', name: 'Vercel', category: 'hosting' }),
      makeService({ id: 'pg', name: 'PostgreSQL', category: 'database' }),
    ]
    const { edges } = inferFlowGraph(services, [])
    const frontendToBackend = edges.find(e => e.source === 'frontend' && e.target === 'api')
    expect(frontendToBackend).toBeDefined()
  })

  it('does not create frontend if no hosting/cdn service', () => {
    const services = [
      makeService({ id: 'pg', name: 'PostgreSQL', category: 'database' }),
      makeService({ id: 'ga', name: 'PostHog', category: 'analytics' }),
    ]
    const { nodes } = inferFlowGraph(services, [])
    expect(nodes.find(n => n.id === 'frontend')).toBeUndefined()
    // analytics falls back to backend parent when no frontend
    const backendNode = nodes.find(n => n.id === 'api')
    expect(backendNode).toBeDefined()
  })

  it('creates Data Layer intermediate node for 2+ database/storage services', () => {
    const services = [
      makeService({ id: 'pg', name: 'PostgreSQL', category: 'database' }),
      makeService({ id: 'redis', name: 'Redis', category: 'database' }),
      makeService({ id: 's3', name: 'S3', category: 'storage' }),
    ]
    const { nodes, edges } = inferFlowGraph(services, [])
    const dataLayer = nodes.find(n => n.id === 'layer-data')
    expect(dataLayer).toBeDefined()
    expect(dataLayer!.label).toBe('Data Layer')

    // Data Layer connects to backend
    expect(edges.find(e => e.source === 'api' && e.target === 'layer-data')).toBeDefined()
    // Services connect through Data Layer
    expect(edges.find(e => e.source === 'layer-data' && e.target === 'svc-pg')).toBeDefined()
    expect(edges.find(e => e.source === 'layer-data' && e.target === 'svc-s3')).toBeDefined()
  })

  it('creates Auth Layer intermediate node for 2+ auth services', () => {
    const services = [
      makeService({ id: 'nextauth', name: 'NextAuth', category: 'auth' }),
      makeService({ id: 'saml', name: 'SAML', category: 'auth' }),
      makeService({ id: 'vercel', name: 'Vercel', category: 'hosting' }),
    ]
    const { nodes, edges } = inferFlowGraph(services, [])
    const authLayer = nodes.find(n => n.id === 'layer-auth')
    expect(authLayer).toBeDefined()
    expect(authLayer!.label).toBe('Auth Layer')

    // Auth Layer connects to frontend
    expect(edges.find(e => e.source === 'frontend' && e.target === 'layer-auth')).toBeDefined()
  })

  it('does not create intermediate node for single service in group', () => {
    const services = [
      makeService({ id: 'pg', name: 'PostgreSQL', category: 'database' }),
    ]
    const { nodes } = inferFlowGraph(services, [])
    expect(nodes.find(n => n.id === 'layer-data')).toBeUndefined()
  })

  it('routes other-category services with url to backend', () => {
    const services = [
      makeService({ id: 'custom', name: 'CustomAPI', category: 'other', url: 'https://api.example.com' }),
      makeService({ id: 'pg', name: 'PostgreSQL', category: 'database' }),
    ]
    const { edges } = inferFlowGraph(services, [])
    const customEdge = edges.find(e => e.target === 'svc-custom')
    expect(customEdge).toBeDefined()
    expect(customEdge!.source).toBe('api')
  })

  it('routes other-category services without url to frontend parent', () => {
    const services = [
      makeService({ id: 'unknown', name: 'Mystery', category: 'other' }),
      makeService({ id: 'vercel', name: 'Vercel', category: 'hosting' }),
    ]
    const { edges } = inferFlowGraph(services, [])
    const mysteryEdge = edges.find(e => e.target === 'svc-unknown')
    expect(mysteryEdge).toBeDefined()
    expect(mysteryEdge!.source).toBe('frontend')
  })

  it('virtual nodes have no serviceId', () => {
    const services = [
      makeService({ id: 'vercel', name: 'Vercel', category: 'hosting' }),
      makeService({ id: 'pg', name: 'PostgreSQL', category: 'database' }),
    ]
    const { nodes } = inferFlowGraph(services, [])
    const frontend = nodes.find(n => n.id === 'frontend')
    const backend = nodes.find(n => n.id === 'api')
    expect(frontend!.serviceId).toBeUndefined()
    expect(backend!.serviceId).toBeUndefined()
  })
})
