import type { FlowNode, FlowEdge } from '../../types'

export function getNodeColor(type: FlowNode['type']): string {
  const colors: Record<FlowNode['type'], string> = {
    user: '#3b82f6',
    cdn: '#14b8a6',
    frontend: '#22c55e',
    api: '#a855f7',
    database: '#f97316',
    external: '#ec4899',
    layer: '#e2b04a',
  }
  return colors[type] ?? '#6b7280'
}

export function getEdgeColor(flowType: FlowEdge['flowType']): string {
  const colors: Record<FlowEdge['flowType'], string> = {
    data: '#3b82f6',
    auth: '#22c55e',
    payment: '#f59e0b',
    webhook: '#ef4444',
  }
  return colors[flowType] ?? '#6b7280'
}

export function getConfidenceBackground(confidence: 'high' | 'medium' | 'low' | undefined): string {
  switch (confidence) {
    case 'high': return 'var(--color-badge-bg-success)'
    case 'medium': return 'var(--color-badge-bg-warning)'
    case 'low': return 'var(--color-danger-bg)'
    default: return 'var(--color-bg-tertiary)'
  }
}

export function getNodeIcon(type: FlowNode['type']): string {
  const icons: Record<FlowNode['type'], string> = {
    user: '\u{1F464}',
    cdn: '\u{1F310}',
    frontend: '\u{1F5A5}\uFE0F',
    api: '\u26A1',
    database: '\u{1F5C4}\uFE0F',
    external: '\u{1F50C}',
    layer: '\u{1F4CB}',
  }
  return icons[type] ?? '\u2699\uFE0F'
}

export function getLayerIcon(label: string): string {
  const lower = label.toLowerCase()
  if (lower === 'user') return '\u{1F464}'
  if (lower === 'frontend') return '\u{1F5A5}\uFE0F'
  if (lower === 'backend') return '\u26A1'
  return '\u{1F4CB}'
}
