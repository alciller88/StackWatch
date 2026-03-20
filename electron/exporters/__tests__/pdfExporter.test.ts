import { describe, it, expect } from 'vitest'
import { generatePdfBuffer } from '../pdfExporter'
import type { PdfExportData } from '../../../shared/types'

function makePdfData(overrides?: Partial<PdfExportData>): PdfExportData {
  return {
    projectName: 'Test Project',
    graphImageBase64: '',
    score: 75,
    passingChecks: 6,
    totalChecks: 8,
    checks: [
      { id: 'NO_CRITICAL_VULNS', category: 'security', status: 'pass', label: 'No critical vulnerabilities' },
      { id: 'NO_HIGH_VULNS', category: 'security', status: 'pass', label: 'No high vulnerabilities' },
      { id: 'NO_ZOMBIE_SERVICES', category: 'security', status: 'pass', label: 'No zombie services' },
      { id: 'NO_OVERDUE_RENEWALS', category: 'security', status: 'unchecked', label: 'No overdue renewals' },
      { id: 'NO_UPCOMING_RENEWALS', category: 'security', status: 'unchecked', label: 'No upcoming renewals' },
      { id: 'ALL_PAID_HAVE_OWNER', category: 'completeness', status: 'pass', label: 'All paid services have owner' },
      { id: 'ALL_PAID_HAVE_BILLING', category: 'completeness', status: 'fail', label: 'All paid services have billing' },
      { id: 'ALL_PAID_HAVE_RENEWAL', category: 'completeness', status: 'pass', label: 'All paid services have renewal' },
    ],
    generatedAt: '2026-03-20T12:00:00Z',
    ...overrides,
  }
}

describe('PDF Exporter', () => {
  it('generates a valid PDF buffer', () => {
    const data = makePdfData()
    const buffer = generatePdfBuffer(data)

    expect(buffer).toBeInstanceOf(ArrayBuffer)
    expect(buffer.byteLength).toBeGreaterThan(0)

    // PDF files start with %PDF-
    const header = new Uint8Array(buffer, 0, 5)
    const headerStr = String.fromCharCode(...header)
    expect(headerStr).toBe('%PDF-')
  })

  it('generates PDF with project name in content', () => {
    const data = makePdfData({ projectName: 'My Awesome App' })
    const buffer = generatePdfBuffer(data)

    // Convert to string to check content (PDF text is embedded)
    const text = new TextDecoder('latin1').decode(buffer)
    expect(text).toContain('My Awesome App')
    expect(text).toContain('StackWatch')
  })

  it('generates PDF with score value', () => {
    const data = makePdfData({ score: 85 })
    const buffer = generatePdfBuffer(data)

    const text = new TextDecoder('latin1').decode(buffer)
    expect(text).toContain('85')
    expect(text).toContain('STACK SCORE')
  })

  it('generates PDF with check labels', () => {
    const data = makePdfData()
    const buffer = generatePdfBuffer(data)

    const text = new TextDecoder('latin1').decode(buffer)
    expect(text).toContain('No critical vulnerabilities')
    expect(text).toContain('All paid services have billing')
  })

  it('generates PDF without graph image (placeholder shown)', () => {
    const data = makePdfData({ graphImageBase64: '' })
    const buffer = generatePdfBuffer(data)

    expect(buffer.byteLength).toBeGreaterThan(0)
    const text = new TextDecoder('latin1').decode(buffer)
    expect(text).toContain('No graph data')
  })

  it('handles zero score gracefully', () => {
    const data = makePdfData({ score: 0, passingChecks: 0, totalChecks: 8 })
    const buffer = generatePdfBuffer(data)

    expect(buffer.byteLength).toBeGreaterThan(0)
    const text = new TextDecoder('latin1').decode(buffer)
    expect(text).toContain('0/8 checks passing')
  })

  it('handles empty checks array', () => {
    const data = makePdfData({ checks: [] })
    const buffer = generatePdfBuffer(data)
    expect(buffer.byteLength).toBeGreaterThan(0)
  })

  it('includes date in footer area', () => {
    const data = makePdfData({ generatedAt: '2026-03-20T15:30:00Z' })
    const buffer = generatePdfBuffer(data)

    const text = new TextDecoder('latin1').decode(buffer)
    expect(text).toContain('2026-03-20')
  })

  it('includes GitHub URL in footer', () => {
    const data = makePdfData()
    const buffer = generatePdfBuffer(data)

    const text = new TextDecoder('latin1').decode(buffer)
    expect(text).toContain('github.com/alciller88/StackWatch')
  })
})
