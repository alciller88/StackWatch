import { describe, it, expect } from 'vitest'
import { hashStructure } from '../graphStore'
import type { FlowNode, FlowEdge } from '../../types'

describe('Dagre layout cache', () => {
  const nodes: FlowNode[] = [
    { id: 'user', label: 'User', type: 'layer' },
    { id: 'svc-stripe', label: 'Stripe', type: 'external', serviceId: 'stripe' },
    { id: 'svc-sentry', label: 'Sentry', type: 'external', serviceId: 'sentry' },
  ]

  const edges: FlowEdge[] = [
    { source: 'user', target: 'svc-stripe', flowType: 'payment' },
    { source: 'user', target: 'svc-sentry', flowType: 'data' },
  ]

  it('same structure produces same hash', () => {
    const hash1 = hashStructure(nodes, edges)
    const hash2 = hashStructure(nodes, edges)
    expect(hash1).toBe(hash2)
  })

  it('different node order produces same hash (sorted)', () => {
    const reversed = [...nodes].reverse()
    expect(hashStructure(reversed, edges)).toBe(hashStructure(nodes, edges))
  })

  it('adding a node changes the hash', () => {
    const extended = [...nodes, { id: 'svc-new', label: 'New', type: 'external' as const, serviceId: 'new' }]
    expect(hashStructure(extended, edges)).not.toBe(hashStructure(nodes, edges))
  })

  it('removing a node changes the hash', () => {
    const fewer = nodes.slice(0, 2)
    expect(hashStructure(fewer, edges)).not.toBe(hashStructure(nodes, edges))
  })

  it('adding an edge changes the hash', () => {
    const moreEdges = [...edges, { source: 'svc-stripe', target: 'svc-sentry', flowType: 'data' as const }]
    expect(hashStructure(nodes, moreEdges)).not.toBe(hashStructure(nodes, edges))
  })

  it('empty graph has consistent hash', () => {
    expect(hashStructure([], [])).toBe('|')
  })
})
