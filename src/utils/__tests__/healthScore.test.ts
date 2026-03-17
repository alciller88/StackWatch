import { describe, it, expect } from 'vitest'
import { calculateHealthScore } from '../healthScore'
import type { Service, FlowNode, FlowEdge } from '../../../shared/types'

function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: overrides.id ?? 'svc-1',
    name: overrides.name ?? 'Test Service',
    category: 'hosting',
    plan: 'paid',
    source: 'inferred',
    ...overrides,
  }
}

function makeNode(id: string, type: FlowNode['type'] = 'external'): FlowNode {
  return { id, label: id, type }
}

function makeEdge(source: string, target: string): FlowEdge {
  return { source, target, flowType: 'data' }
}

describe('calculateHealthScore', () => {
  it('returns 0 for empty services array', () => {
    const result = calculateHealthScore([], [], [])
    expect(result.score).toBe(0)
    expect(result.servicesWithCost).toBe(0)
    expect(result.servicesWithOwner).toBe(0)
    expect(result.servicesReviewed).toBe(0)
    expect(result.graphCompleteness).toBe(0)
  })

  it('scores 30 when all services have costs documented', () => {
    const services = [
      makeService({ id: 's1', cost: { amount: 10, currency: 'USD', period: 'monthly' } }),
      makeService({ id: 's2', cost: { amount: 0, currency: 'USD', period: 'monthly' }, needsReview: true }),
    ]
    const result = calculateHealthScore(services, [], [])
    expect(result.servicesWithCost).toBe(100)
    expect(result.score).toBeGreaterThanOrEqual(30)
  })

  it('scores 25 when all services have owners assigned', () => {
    const services = [
      makeService({ id: 's1', owner: 'Alice', needsReview: true }),
      makeService({ id: 's2', owner: 'Bob', needsReview: true }),
    ]
    const result = calculateHealthScore(services, [], [])
    expect(result.servicesWithOwner).toBe(100)
    expect(result.score).toBe(25)
  })

  it('scores 25 when all services are reviewed (needsReview false)', () => {
    const services = [
      makeService({ id: 's1', needsReview: false }),
      makeService({ id: 's2', needsReview: false }),
    ]
    const result = calculateHealthScore(services, [], [])
    expect(result.servicesReviewed).toBe(100)
    expect(result.score).toBe(25)
  })

  it('scores 20 when graph is fully connected', () => {
    const services = [
      makeService({ id: 's1', needsReview: true }),
    ]
    const nodes = [makeNode('n1', 'api'), makeNode('n2', 'database')]
    const edges = [makeEdge('n1', 'n2')]
    const result = calculateHealthScore(services, nodes, edges)
    expect(result.graphCompleteness).toBe(100)
    expect(result.score).toBe(20)
  })

  it('returns 100 when all criteria are met', () => {
    const services = [
      makeService({
        id: 's1',
        cost: { amount: 50, currency: 'USD', period: 'monthly' },
        owner: 'Alice',
        needsReview: false,
      }),
      makeService({
        id: 's2',
        cost: { amount: 0, currency: 'USD', period: 'yearly' },
        owner: 'Bob',
        needsReview: false,
      }),
    ]
    const nodes = [makeNode('n1', 'api'), makeNode('n2', 'database')]
    const edges = [makeEdge('n1', 'n2')]
    const result = calculateHealthScore(services, nodes, edges)
    expect(result.score).toBe(100)
  })

  it('calculates partial scores correctly', () => {
    const services = [
      makeService({
        id: 's1',
        cost: { amount: 10, currency: 'USD', period: 'monthly' },
        owner: 'Alice',
        needsReview: false,
      }),
      makeService({
        id: 's2',
        needsReview: true,
      }),
    ]
    const nodes = [makeNode('n1', 'api'), makeNode('n2', 'database')]
    const edges = [makeEdge('n1', 'n2')]
    const result = calculateHealthScore(services, nodes, edges)

    expect(result.servicesWithCost).toBe(50)
    expect(result.servicesWithOwner).toBe(50)
    expect(result.servicesReviewed).toBe(50)
    expect(result.graphCompleteness).toBe(100)
    expect(result.score).toBe(Math.round(0.5 * 30 + 0.5 * 25 + 0.5 * 25 + 1.0 * 20))
  })

  it('does not exceed 100', () => {
    const services = [
      makeService({
        id: 's1',
        cost: { amount: 100, currency: 'USD', period: 'monthly' },
        owner: 'Team Lead',
        needsReview: false,
      }),
    ]
    const nodes = [makeNode('n1', 'api'), makeNode('n2', 'database')]
    const edges = [makeEdge('n1', 'n2')]
    const result = calculateHealthScore(services, nodes, edges)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('minimum score is 0 (no negative scores)', () => {
    const services = [
      makeService({ id: 's1', needsReview: true }),
    ]
    const result = calculateHealthScore(services, [], [])
    expect(result.score).toBeGreaterThanOrEqual(0)
  })

  it('excludes user-type nodes from graph completeness', () => {
    const services = [makeService({ id: 's1', needsReview: true })]
    const nodes = [makeNode('user-1', 'user'), makeNode('n1', 'api')]
    const edges = [makeEdge('user-1', 'n1')]
    const result = calculateHealthScore(services, nodes, edges)
    expect(result.graphCompleteness).toBe(100)
  })

  it('treats services with needsReview undefined as reviewed', () => {
    const services = [makeService({ id: 's1' })]
    const result = calculateHealthScore(services, [], [])
    expect(result.servicesReviewed).toBe(100)
  })
})
