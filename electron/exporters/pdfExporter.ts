import { jsPDF } from 'jspdf'
import type { PdfExportData } from '../../shared/types'

/** Margins and layout constants for A4 landscape */
const PAGE_W = 297 // A4 landscape width (mm)
const PAGE_H = 210 // A4 landscape height (mm)
const MARGIN = 12
const HEADER_H = 14
const FOOTER_H = 10
const DIVIDER_X = PAGE_W / 2
const CONTENT_TOP = MARGIN + HEADER_H + 4
const CONTENT_BOTTOM = PAGE_H - MARGIN - FOOTER_H

/** Color palette (print-friendly) */
const COLORS = {
  accent: [226, 176, 74] as [number, number, number],     // #e2b04a
  text: [30, 30, 35] as [number, number, number],
  muted: [120, 130, 145] as [number, number, number],
  success: [34, 197, 94] as [number, number, number],      // green
  danger: [239, 68, 68] as [number, number, number],       // red
  border: [200, 205, 215] as [number, number, number],
  bgLight: [245, 246, 248] as [number, number, number],
}

/**
 * Generates a PDF buffer from PdfExportData.
 * Layout: A4 landscape with Flow Graph (left) and Stack Score (right).
 */
export function generatePdfBuffer(data: PdfExportData): ArrayBuffer {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  drawHeader(doc, data)
  drawDivider(doc)
  drawFlowGraph(doc, data)
  drawStackScore(doc, data)
  drawFooter(doc, data)

  return doc.output('arraybuffer')
}

function drawHeader(doc: jsPDF, data: PdfExportData): void {
  const y = MARGIN

  // StackWatch logo text
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...COLORS.accent)
  doc.text('StackWatch', MARGIN, y + 6)

  // Project name (centered)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...COLORS.text)
  const projectName = data.projectName || 'Untitled Stack'
  doc.text(projectName, PAGE_W / 2, y + 6, { align: 'center' })

  // Date (right-aligned)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.muted)
  const date = data.generatedAt.split('T')[0] ?? ''
  doc.text(date, PAGE_W - MARGIN, y + 6, { align: 'right' })

  // Header separator line
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, y + HEADER_H, PAGE_W - MARGIN, y + HEADER_H)
}

function drawDivider(doc: jsPDF): void {
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.2)
  doc.line(DIVIDER_X, CONTENT_TOP, DIVIDER_X, CONTENT_BOTTOM)
}

function drawFlowGraph(doc: jsPDF, data: PdfExportData): void {
  const graphLeft = MARGIN
  const graphRight = DIVIDER_X - 6
  const graphW = graphRight - graphLeft
  const graphTop = CONTENT_TOP + 2
  const graphBottom = CONTENT_BOTTOM - 2
  const graphH = graphBottom - graphTop

  // Section label
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.muted)
  doc.text('FLOW GRAPH', graphLeft, graphTop - 1)

  if (data.graphImageBase64) {
    try {
      // Determine image format from base64 prefix
      const format = data.graphImageBase64.startsWith('data:image/svg') ? 'SVG' : 'PNG'
      const imgData = data.graphImageBase64

      // Add the graph image, fit within bounds
      doc.addImage(imgData, format, graphLeft, graphTop + 2, graphW, graphH - 4, undefined, 'FAST')
    } catch {
      // Fallback: show placeholder if image fails
      drawPlaceholder(doc, graphLeft, graphTop + 2, graphW, graphH - 4, 'Graph image unavailable')
    }
  } else {
    drawPlaceholder(doc, graphLeft, graphTop + 2, graphW, graphH - 4, 'No graph data')
  }
}

function drawPlaceholder(doc: jsPDF, x: number, y: number, w: number, h: number, text: string): void {
  doc.setFillColor(...COLORS.bgLight)
  doc.setDrawColor(...COLORS.border)
  doc.rect(x, y, w, h, 'FD')
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.muted)
  doc.text(text, x + w / 2, y + h / 2, { align: 'center', baseline: 'middle' })
}

function drawStackScore(doc: jsPDF, data: PdfExportData): void {
  const scoreLeft = DIVIDER_X + 6
  const scoreRight = PAGE_W - MARGIN
  const scoreW = scoreRight - scoreLeft
  const scoreTop = CONTENT_TOP + 2

  // Section label
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.muted)
  doc.text('STACK SCORE', scoreLeft, scoreTop - 1)

  // Score circle area
  const circleX = scoreLeft + scoreW / 2
  const circleY = scoreTop + 22
  const circleR = 16

  // Score background circle
  const scoreColor = data.score >= 80 ? COLORS.success : data.score >= 50 ? COLORS.accent : COLORS.danger
  doc.setDrawColor(...scoreColor)
  doc.setLineWidth(2)
  doc.circle(circleX, circleY, circleR)

  // Score number
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.setTextColor(...scoreColor)
  doc.text(String(data.score), circleX, circleY + 1, { align: 'center', baseline: 'middle' })

  // Label under score
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.muted)
  doc.text(`${data.passingChecks}/${data.totalChecks} checks passing`, circleX, circleY + circleR + 6, { align: 'center' })

  // Checks list
  const checksTop = circleY + circleR + 14
  const checks = data.checks ?? []
  const lineH = 7

  for (let i = 0; i < checks.length; i++) {
    const check = checks[i]!
    const y = checksTop + i * lineH

    if (y > CONTENT_BOTTOM - 4) break // Don't overflow

    // Status icon
    const isPassing = check.status === 'pass'
    const isUnchecked = check.status === 'unchecked'
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)

    if (isUnchecked) {
      doc.setTextColor(...COLORS.muted)
      doc.text('—', scoreLeft + 2, y)
    } else if (isPassing) {
      doc.setTextColor(...COLORS.success)
      doc.text('\u2713', scoreLeft + 2, y)
    } else {
      doc.setTextColor(...COLORS.danger)
      doc.text('\u2717', scoreLeft + 2, y)
    }

    // Check label
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(isUnchecked ? COLORS.muted[0]! : COLORS.text[0]!, isUnchecked ? COLORS.muted[1]! : COLORS.text[1]!, isUnchecked ? COLORS.muted[2]! : COLORS.text[2]!)
    doc.text(check.label, scoreLeft + 10, y)
  }
}

function drawFooter(doc: jsPDF, _data: PdfExportData): void {
  const y = PAGE_H - MARGIN

  // Footer separator
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, y - FOOTER_H, PAGE_W - MARGIN, y - FOOTER_H)

  // Footer text
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...COLORS.muted)
  doc.text('Generated by StackWatch \u2014 github.com/alciller88/StackWatch', PAGE_W / 2, y - 3, { align: 'center' })
}
