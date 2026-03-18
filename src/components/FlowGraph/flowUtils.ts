import type { FlowNode, FlowEdge, GraphStyles } from '../../types'
import { DEFAULT_GRAPH_STYLES } from '../../styles/defaults'

export function getNodeColor(
  type: FlowNode['type'],
  styles: GraphStyles = DEFAULT_GRAPH_STYLES,
): string {
  return styles.nodeColors[type as keyof GraphStyles['nodeColors']]
    ?? styles.nodeColors.fallback
}

export function getEdgeColor(
  flowType: FlowEdge['flowType'],
  styles: GraphStyles = DEFAULT_GRAPH_STYLES,
): string {
  return styles.edgeColors[flowType as keyof GraphStyles['edgeColors']]
    ?? styles.edgeColors.data
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
