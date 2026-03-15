import { useMemo } from 'react'
import dagre from '@dagrejs/dagre'
import type { Node, Edge } from 'reactflow'
import type { FlowNode, FlowEdge } from '../../types'
import { getNodeColor, getEdgeColor } from './flowUtils'

const NODE_WIDTH = 180
const NODE_HEIGHT = 60

export function useLayoutNodes(
  flowNodes: FlowNode[],
  flowEdges: FlowEdge[]
): { nodes: Node[]; edges: Edge[] } {
  return useMemo(() => {
    if (flowNodes.length === 0) return { nodes: [], edges: [] }

    const g = new dagre.graphlib.Graph()
    g.setDefaultEdgeLabel(() => ({}))
    g.setGraph({
      rankdir: 'TB',
      ranksep: 80,
      nodesep: 40,
      marginx: 20,
      marginy: 20,
    })

    for (const node of flowNodes) {
      g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
    }

    for (const edge of flowEdges) {
      g.setEdge(edge.source, edge.target)
    }

    dagre.layout(g)

    const nodes: Node[] = flowNodes.map((node) => {
      const pos = g.node(node.id)
      return {
        id: node.id,
        position: {
          x: (pos?.x ?? 0) - NODE_WIDTH / 2,
          y: (pos?.y ?? 0) - NODE_HEIGHT / 2,
        },
        data: { label: node.label, nodeType: node.type },
        style: {
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          background: '#1f2937',
          border: `2px solid ${getNodeColor(node.type)}`,
          borderRadius: '12px',
          color: '#f9fafb',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px',
        },
      }
    })

    const edges: Edge[] = flowEdges.map((edge, i) => ({
      id: `e-${edge.source}-${edge.target}-${i}`,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      animated: true,
      style: { stroke: getEdgeColor(edge.flowType), strokeWidth: 2 },
      labelStyle: { fill: '#9ca3af', fontSize: 11 },
    }))

    return { nodes, edges }
  }, [flowNodes, flowEdges])
}
