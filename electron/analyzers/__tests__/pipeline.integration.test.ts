import { describe, it, expect } from 'vitest'
import path from 'path'
import { extractEvidences } from '../extractor'
import { classifyEvidences } from '../heuristic'
import { deduplicateServices } from '../deduplicator'
import { inferFlowGraph } from '../flowInference'

const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'simple-repo')

describe('Pipeline integration (fixture repo)', () => {
  it('runs full pipeline and detects expected services', async () => {
    const { evidences, dependencies, projectName } = await extractEvidences(FIXTURE_PATH)
    const heuristic = classifyEvidences(evidences, projectName)
    const { services } = deduplicateServices(heuristic)

    const names = services.map(s => s.name.toLowerCase())
    const ids = services.map(s => s.id)

    // Stripe: env_var (STRIPE_SECRET_KEY=7) + npm (1) + import (1) → score ≥ 8
    expect(names).toContain('stripe')
    const stripe = services.find(s => s.id === 'stripe')!
    expect(stripe.category).toBe('payments')

    // Sentry: env_var (SENTRY_DSN=6) + npm (1) → score ≥ 7
    expect(names).toContain('sentry')
    const sentry = services.find(s => s.name.toLowerCase() === 'sentry')!
    expect(sentry.category).toBe('monitoring')

    // PostgreSQL from DATABASE_URL
    const hasPg = ids.some(id => id.includes('postgresql') || id.includes('postgres'))
    expect(hasPg).toBe(true)
  })

  it('does not include utility libraries as false positives', async () => {
    const { evidences, dependencies, projectName } = await extractEvidences(FIXTURE_PATH)
    const heuristic = classifyEvidences(evidences, projectName)
    const { services } = deduplicateServices(heuristic)

    const names = services.map(s => s.name.toLowerCase())

    // Utility libraries should NOT appear (npm-only, score 1 < threshold 6)
    expect(names).not.toContain('lodash')
    expect(names).not.toContain('zod')
    expect(names).not.toContain('express')
  })

  it('generates valid flow graph from detected services', async () => {
    const { evidences, dependencies, projectName } = await extractEvidences(FIXTURE_PATH)
    const heuristic = classifyEvidences(evidences, projectName)
    const { services } = deduplicateServices(heuristic)
    const { nodes, edges } = inferFlowGraph(services, dependencies, projectName)

    // Must have user node
    expect(nodes.find(n => n.id === 'user')).toBeDefined()

    // Every service must have a corresponding node
    for (const svc of services) {
      const node = nodes.find(n => n.serviceId === svc.id)
      expect(node).toBeDefined()
    }

    // Edges must reference existing nodes
    const nodeIds = new Set(nodes.map(n => n.id))
    for (const edge of edges) {
      expect(nodeIds.has(edge.source)).toBe(true)
      expect(nodeIds.has(edge.target)).toBe(true)
    }
  })

  it('populates evidenceSummary on services', async () => {
    const { evidences, dependencies, projectName } = await extractEvidences(FIXTURE_PATH)
    const heuristic = classifyEvidences(evidences, projectName)
    const { services } = deduplicateServices(heuristic)

    const stripe = services.find(s => s.id === 'stripe')!
    expect(stripe.evidenceSummary).toBeDefined()
    expect(stripe.evidenceSummary!.length).toBeGreaterThan(0)

    // Should have multiple evidence types
    const types = new Set(stripe.evidenceSummary!.map(e => e.type))
    expect(types.size).toBeGreaterThan(1)
  })
})
