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

  it('creates frontend node when React dependency present', () => {
    const { nodes } = inferFlowGraph([], [makeDep('react')], 'MyProject')
    const frontend = nodes.find(n => n.id === 'frontend')
    expect(frontend).toBeDefined()
    expect(frontend!.type).toBe('frontend')
    expect(frontend!.label).toBe('MyProject')
  })

  it('creates API node when Express dependency present', () => {
    const { nodes } = inferFlowGraph([], [makeDep('express')], 'MyProject')
    const api = nodes.find(n => n.id === 'api')
    expect(api).toBeDefined()
    expect(api!.type).toBe('api')
    expect(api!.label).toBe('MyProject')
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
    ]
    const { nodes } = inferFlowGraph(services, [])
    const externalNodes = nodes.filter(n => n.type === 'external')
    expect(externalNodes).toHaveLength(3)
    expect(externalNodes.map(n => n.label)).toContain('Stripe')
    expect(externalNodes.map(n => n.label)).toContain('SendGrid')
    expect(externalNodes.map(n => n.label)).toContain('Google Analytics')
  })

  it('includes all categories including ai (previously missing bug)', () => {
    const services = [
      makeService({ id: 'openai', name: 'OpenAI', category: 'ai' }),
    ]
    const { nodes } = inferFlowGraph(services, [])
    const aiNode = nodes.find(n => n.serviceId === 'openai')
    expect(aiNode).toBeDefined()
    expect(aiNode!.type).toBe('external')
    expect(aiNode!.label).toBe('OpenAI')
  })

  it('connects User → CDN → Frontend for CDN services', () => {
    const services = [
      makeService({ id: 'cf', name: 'Cloudflare', category: 'cdn' }),
    ]
    const { nodes, edges } = inferFlowGraph(services, [makeDep('react')])

    const cdnNode = nodes.find(n => n.serviceId === 'cf')
    expect(cdnNode).toBeDefined()
    expect(cdnNode!.type).toBe('cdn')

    const userToCdn = edges.find(e => e.source === 'user' && e.target === cdnNode!.id)
    expect(userToCdn).toBeDefined()

    const cdnToFrontend = edges.find(e => e.source === cdnNode!.id && e.target === 'frontend')
    expect(cdnToFrontend).toBeDefined()
  })

  it('assigns flowType payment to payment service edges', () => {
    const services = [
      makeService({ id: 'stripe', name: 'Stripe', category: 'payments' }),
    ]
    const { edges } = inferFlowGraph(services, [makeDep('express')])
    const paymentEdge = edges.find(e => e.target === 'svc-stripe')
    expect(paymentEdge).toBeDefined()
    expect(paymentEdge!.flowType).toBe('payment')
  })

  it('assigns flowType auth to auth service edges', () => {
    const services = [
      makeService({ id: 'auth0', name: 'Auth0', category: 'auth' }),
    ]
    const { edges } = inferFlowGraph(services, [makeDep('express')])
    const authEdge = edges.find(e => e.target === 'svc-auth0')
    expect(authEdge).toBeDefined()
    expect(authEdge!.flowType).toBe('auth')
  })
})
