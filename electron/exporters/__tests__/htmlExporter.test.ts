import { describe, it, expect } from 'vitest'
import { generateHtmlReport } from '../htmlExporter'
import type { HtmlExportData } from '../htmlExporter'
import type { Service, Dependency, FlowNode, FlowEdge } from '../../types'

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

function makeDep(overrides: Partial<Dependency> & { name: string }): Dependency {
  return {
    version: '1.0.0',
    type: 'production',
    ecosystem: 'npm',
    ...overrides,
  }
}

function makeExportData(overrides?: Partial<HtmlExportData>): HtmlExportData {
  return {
    projectName: 'TestProject',
    services: [],
    dependencies: [],
    flowNodes: [],
    flowEdges: [],
    score: 72,
    scoreBreakdown: {
      servicesWithCost: 60,
      servicesWithOwner: 80,
      servicesReviewed: 70,
      graphCompleteness: 50,
    },
    generatedAt: '2025-03-15T12:00:00Z',
    ...overrides,
  }
}

// ── Tests ──

describe('generateHtmlReport', () => {
  it('returns valid HTML with doctype, html, head, body tags', () => {
    const html = generateHtmlReport(makeExportData())
    expect(html).toMatch(/^<!DOCTYPE html>/)
    expect(html).toContain('<html lang="en">')
    expect(html).toContain('<head>')
    expect(html).toContain('<body>')
    expect(html).toContain('</html>')
  })

  it('includes project name in title and header', () => {
    const html = generateHtmlReport(makeExportData({ projectName: 'MyApp' }))
    expect(html).toContain('<title>StackWatch Report -- MyApp</title>')
    expect(html).toContain('<h1>MyApp</h1>')
  })

  it('includes Stack Score with correct value', () => {
    const html = generateHtmlReport(makeExportData({ score: 85 }))
    expect(html).toContain('85')
    expect(html).toContain('out of 100')
    expect(html).toContain('Stack Score:')
  })

  it('includes services grouped by category', () => {
    const services: Service[] = [
      makeService({ id: 'stripe', name: 'Stripe', category: 'payments', plan: 'paid' }),
      makeService({ id: 'sentry', name: 'Sentry', category: 'monitoring', plan: 'free' }),
      makeService({ id: 'braintree', name: 'Braintree', category: 'payments', plan: 'paid' }),
    ]
    const html = generateHtmlReport(makeExportData({ services }))

    expect(html).toContain('Payments')
    expect(html).toContain('Monitoring')
    expect(html).toContain('Stripe')
    expect(html).toContain('Sentry')
    expect(html).toContain('Braintree')
    // Payments should show count of 2
    expect(html).toContain('(2)')
    // Monitoring should show count of 1
    expect(html).toContain('(1)')
  })

  it('includes dependencies grouped by ecosystem', () => {
    const dependencies: Dependency[] = [
      makeDep({ name: 'react', ecosystem: 'npm' }),
      makeDep({ name: 'express', ecosystem: 'npm' }),
      makeDep({ name: 'flask', ecosystem: 'pip' }),
    ]
    const html = generateHtmlReport(makeExportData({ dependencies }))

    expect(html).toContain('npm')
    expect(html).toContain('pip')
    expect(html).toContain('react')
    expect(html).toContain('express')
    expect(html).toContain('flask')
  })

  it('includes cost summary with monthly and yearly totals', () => {
    const services: Service[] = [
      makeService({
        id: 'stripe',
        name: 'Stripe',
        category: 'payments',
        plan: 'paid',
        cost: { amount: 50, currency: 'USD', period: 'monthly' },
      }),
      makeService({
        id: 'sentry',
        name: 'Sentry',
        category: 'monitoring',
        plan: 'paid',
        cost: { amount: 30, currency: 'USD', period: 'monthly' },
      }),
    ]
    const html = generateHtmlReport(makeExportData({ services }))

    // Monthly = $80.00
    expect(html).toContain('$80.00')
    // Yearly = $960.00
    expect(html).toContain('$960.00')
  })

  it('includes budget progress when budget is set', () => {
    const services: Service[] = [
      makeService({
        id: 'stripe',
        name: 'Stripe',
        category: 'payments',
        plan: 'paid',
        cost: { amount: 80, currency: 'USD', period: 'monthly' },
      }),
    ]
    const html = generateHtmlReport(makeExportData({
      services,
      budget: { monthly: 100, currency: 'USD' },
    }))

    expect(html).toContain('Budget')
    expect(html).toContain('$80.00')
    expect(html).toContain('$100.00')
    expect(html).toContain('80%')
  })

  it('escapes HTML special characters in service names (XSS prevention)', () => {
    const services: Service[] = [
      makeService({ id: 'xss', name: '<script>alert("xss")</script>', category: 'other' }),
    ]
    const html = generateHtmlReport(makeExportData({ services }))

    expect(html).not.toContain('<script>alert("xss")</script>')
    expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
  })

  it('includes generation timestamp', () => {
    const html = generateHtmlReport(makeExportData({ generatedAt: '2025-03-15T12:00:00Z' }))
    expect(html).toContain('2025-03-15')
  })

  it('handles empty services array', () => {
    const html = generateHtmlReport(makeExportData({ services: [] }))
    expect(html).toContain('No services detected.')
    expect(html).toContain('Services (0)')
  })

  it('handles empty dependencies array', () => {
    const html = generateHtmlReport(makeExportData({ dependencies: [] }))
    expect(html).toContain('No dependencies detected.')
    expect(html).toContain('Dependencies (0)')
  })

  it('includes print-friendly media query', () => {
    const html = generateHtmlReport(makeExportData())
    expect(html).toContain('@media print')
    expect(html).toContain('background:#fff')
  })

  it('converts yearly cost to monthly for display', () => {
    const services: Service[] = [
      makeService({
        id: 'domain',
        name: 'Domain',
        category: 'domain',
        plan: 'paid',
        cost: { amount: 120, currency: 'USD', period: 'yearly' },
      }),
    ]
    const html = generateHtmlReport(makeExportData({ services }))

    // 120/12 = $10.00/mo
    expect(html).toContain('$10.00/mo')
  })
})
