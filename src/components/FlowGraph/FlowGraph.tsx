import { useState, useCallback, useEffect, useRef } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ConnectionMode,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  type Node,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useStore } from '../../store/useStore'
import { useGraphStore } from '../../store/graphStore'
import { getNodeColor, getNodeIcon } from './flowUtils'
import { ContextMenu, type MenuEntry } from './ContextMenu'
import { NodeEditPanel } from './NodeEditPanel'
import type { FlowNode, ServiceCategory } from '../../types'

interface ContextMenuState {
  x: number
  y: number
  type: 'node' | 'pane' | 'edge'
  nodeId?: string
  edgeId?: string
  edgeFlowType?: string
}

interface EditPanelState {
  x: number
  y: number
  nodeId: string | null // null = creating new node
  isCustom?: boolean
  createPosition?: { x: number; y: number }
}

export const FlowGraph: React.FC = () => {
  const { flowNodes, flowEdges, services, config } = useStore()
  const graphStore = useGraphStore()
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [editPanel, setEditPanel] = useState<EditPanelState | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)

  // Initialize graph store when analysis data changes
  useEffect(() => {
    if (flowNodes.length === 0) {
      initialized.current = false
      return
    }
    graphStore.initFromAnalysis(flowNodes, flowEdges, config?.graph, services)
    initialized.current = true
  }, [flowNodes, flowEdges]) // eslint-disable-line react-hooks/exhaustive-deps

  // Build confidence map
  const confidenceMap = new Map<string, string>()
  for (const s of services) {
    confidenceMap.set(s.id, s.confidence ?? 'high')
  }

  // Close menus on outside events
  const closeAll = useCallback(() => {
    setContextMenu(null)
    setEditPanel(null)
    setTooltip(null)
  }, [])

  // ── Context menu handlers ──

  const handleNodeContextMenu: NodeMouseHandler = useCallback(
    (event, node) => {
      event.preventDefault()
      const bounds = containerRef.current?.getBoundingClientRect()
      if (!bounds) return
      setContextMenu({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
        type: 'node',
        nodeId: node.id,
      })
      setEditPanel(null)
    },
    [],
  )

  const handlePaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      const bounds = containerRef.current?.getBoundingClientRect()
      if (!bounds) return
      setContextMenu({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
        type: 'pane',
      })
      setEditPanel(null)
    },
    [],
  )

  const handleEdgeContextMenu: EdgeMouseHandler = useCallback(
    (event, edge) => {
      event.preventDefault()
      const bounds = containerRef.current?.getBoundingClientRect()
      if (!bounds) return
      setContextMenu({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
        type: 'edge',
        edgeId: edge.id,
        edgeFlowType: edge.data?.flowType ?? 'data',
      })
      setEditPanel(null)
    },
    [],
  )

  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      const bounds = containerRef.current?.getBoundingClientRect()
      if (!bounds) return
      // Position panel near the node
      const nodeEl = document.querySelector(`[data-id="${node.id}"]`)
      const nodeRect = nodeEl?.getBoundingClientRect()
      const panelX = nodeRect ? nodeRect.right - bounds.left + 8 : 200
      const panelY = nodeRect ? nodeRect.top - bounds.top : 200
      setEditPanel({ x: panelX, y: panelY, nodeId: node.id })
      setContextMenu(null)
    },
    [],
  )

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      graphStore.saveNodePosition(node.id, node.position)
    },
    [graphStore],
  )

  // ── Build context menu items ──

  const buildNodeMenuItems = (nodeId: string): MenuEntry[] => {
    const node = graphStore.nodes.find((n) => n.id === nodeId)
    if (!node) return []

    return [
      {
        label: 'Edit',
        icon: '✏️',
        onClick: () => {
          const nodeEl = document.querySelector(`[data-id="${nodeId}"]`)
          const bounds = containerRef.current?.getBoundingClientRect()
          if (!nodeEl || !bounds) return
          const nodeRect = nodeEl.getBoundingClientRect()
          setEditPanel({
            x: nodeRect.right - bounds.left + 8,
            y: nodeRect.top - bounds.top,
            nodeId,
          })
        },
      },
      {
        label: 'Open URL',
        icon: '🔗',
        onClick: () => {
          const url = node.data.url
          if (url) {
            window.open(url, '_blank')
          } else {
            const bounds = containerRef.current?.getBoundingClientRect()
            if (!bounds) return
            const nodeEl = document.querySelector(`[data-id="${nodeId}"]`)
            const nodeRect = nodeEl?.getBoundingClientRect()
            setTooltip({
              x: (nodeRect?.right ?? 200) - bounds.left + 8,
              y: (nodeRect?.top ?? 200) - bounds.top,
              text: 'No URL configured — edit node to add one',
            })
            setTimeout(() => setTooltip(null), 2500)
          }
        },
      },
      { divider: true },
      {
        label: 'Delete node',
        icon: '🗑️',
        danger: true,
        onClick: () => {
          const name = node.data.label ?? nodeId
          if (confirm(`Delete ${name}? This will also remove it from stackwatch.config.json.`)) {
            // If it was inferred, add to excluded list
            if (node.data.source === 'inferred' && node.data.serviceId) {
              graphStore.excludeService(node.data.serviceId)
            }
            graphStore.deleteNode(nodeId)
          }
        },
      },
    ]
  }

  const buildPaneMenuItems = (): MenuEntry[] => {
    return [
      {
        label: 'Add service node',
        icon: '+',
        onClick: () => {
          if (!contextMenu) return
          setEditPanel({
            x: contextMenu.x,
            y: contextMenu.y,
            nodeId: null,
            createPosition: { x: contextMenu.x, y: contextMenu.y },
          })
        },
      },
      {
        label: 'Add custom node',
        icon: '+',
        onClick: () => {
          if (!contextMenu) return
          setEditPanel({
            x: contextMenu.x,
            y: contextMenu.y,
            nodeId: null,
            isCustom: true,
            createPosition: { x: contextMenu.x, y: contextMenu.y },
          })
        },
      },
      { divider: true },
      {
        label: 'Reset to auto layout',
        icon: '↺',
        onClick: () => {
          if (confirm('Reset node positions to automatic layout? Custom positions will be lost.')) {
            graphStore.resetLayout()
          }
        },
      },
    ]
  }

  const buildEdgeMenuItems = (edgeId: string, currentType: string): MenuEntry[] => {
    const types: Array<{ type: string; label: string }> = [
      { type: 'data', label: 'Data' },
      { type: 'auth', label: 'Auth' },
      { type: 'payment', label: 'Payment' },
      { type: 'webhook', label: 'Webhook' },
    ]

    return [
      ...types.map((t) => ({
        label: t.label,
        active: currentType === t.type,
        onClick: () => graphStore.updateEdgeType(edgeId, t.type as any),
      })),
      { divider: true },
      {
        label: 'Delete edge',
        icon: '🗑️',
        danger: true,
        onClick: () => graphStore.deleteEdge(edgeId),
      },
    ]
  }

  // ── Edit panel handlers ──

  const handleEditSave = (data: {
    label: string
    nodeType: FlowNode['type']
    category?: ServiceCategory
    plan?: 'free' | 'paid' | 'trial' | 'unknown'
    url?: string
    note?: string
  }) => {
    if (editPanel?.nodeId) {
      // Update existing node
      graphStore.updateNode(editPanel.nodeId, {
        label: data.label,
        nodeType: data.nodeType,
        category: data.category,
        plan: data.plan,
        url: data.url,
        note: data.note,
      })
    } else {
      // Create new node
      const id = data.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      const position = editPanel?.createPosition ?? { x: 200, y: 200 }
      graphStore.addNode(id, position, {
        label: data.label,
        nodeType: data.nodeType,
        category: data.category,
        plan: data.plan,
        url: data.url,
        note: data.note,
        source: 'manual',
      })
    }
    setEditPanel(null)
  }

  const getEditInitialData = () => {
    if (editPanel?.nodeId) {
      const node = graphStore.nodes.find((n) => n.id === editPanel.nodeId)
      if (node) {
        return {
          label: node.data.label ?? '',
          nodeType: node.data.nodeType ?? 'external',
          category: node.data.category,
          plan: node.data.plan,
          url: node.data.url,
          note: node.data.note,
        }
      }
    }
    // Defaults for new node
    return {
      label: '',
      nodeType: (editPanel?.isCustom ? 'external' : 'external') as FlowNode['type'],
      category: editPanel?.isCustom ? ('other' as ServiceCategory) : undefined,
      plan: 'unknown',
      url: undefined,
      note: undefined,
    }
  }

  // ── Render ──

  if (flowNodes.length === 0 && graphStore.nodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
        No flow data available. Analyze a repository to generate the architecture graph.
      </div>
    )
  }

  // Apply confidence styling + icons to nodes for rendering
  const styledNodes = graphStore.nodes.map((n) => {
    const serviceId = n.data.serviceId
    const confidence = serviceId ? confidenceMap.get(serviceId) : 'high'
    const isLowConfidence = confidence === 'low'

    return {
      ...n,
      style: isLowConfidence
        ? { ...n.style, borderStyle: 'dashed', borderColor: '#c2410c', opacity: 0.8 }
        : n.style,
      data: {
        ...n.data,
        label: (
          <div
            className="flex items-center gap-2"
            title={isLowConfidence ? 'Low confidence detection' : undefined}
          >
            <span>{getNodeIcon(n.data.nodeType ?? 'external')}</span>
            <span className="truncate">{n.data.label}</span>
            {isLowConfidence && <span className="text-orange-400 text-[10px]">?</span>}
          </div>
        ),
      },
    }
  })

  return (
    <div ref={containerRef} className="flex-1 relative" style={{ height: '100%' }}>
      {/* Legend */}
      <div className="absolute top-4 right-4 z-10 bg-gray-900/90 border border-gray-700 rounded-lg p-3 text-xs space-y-1.5">
        <div className="text-gray-400 font-medium mb-2">Edge Types</div>
        {[
          { color: 'bg-blue-500', label: 'Data' },
          { color: 'bg-green-500', label: 'Auth' },
          { color: 'bg-amber-500', label: 'Payment' },
          { color: 'bg-red-500', label: 'Webhook' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className={`w-4 h-0.5 ${item.color} inline-block`} />
            <span className="text-gray-400">{item.label}</span>
          </div>
        ))}
        <div className="border-t border-gray-700 pt-1.5 mt-1.5">
          <div className="flex items-center gap-2">
            <span className="w-4 h-0.5 border-t border-dashed border-orange-500 inline-block" />
            <span className="text-gray-400">Low confidence</span>
          </div>
        </div>
      </div>

      <ReactFlow
        nodes={styledNodes}
        edges={graphStore.edges}
        onNodesChange={graphStore.onNodesChange}
        onEdgesChange={graphStore.onEdgesChange}
        onConnect={graphStore.onConnect}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneContextMenu={handlePaneContextMenu}
        onEdgeContextMenu={handleEdgeContextMenu}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeDragStop={handleNodeDragStop}
        onPaneClick={closeAll}
        connectionMode={ConnectionMode.Loose}
        snapToGrid
        snapGrid={[16, 16]}
        deleteKeyCode="Delete"
        fitView
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#374151" gap={20} />
        <Controls
          style={{
            background: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '8px',
          }}
        />
        <MiniMap
          nodeColor={(node) => getNodeColor(node.data?.nodeType ?? 'external')}
          style={{
            background: '#111827',
            border: '1px solid #374151',
            borderRadius: '8px',
          }}
        />
      </ReactFlow>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={
            contextMenu.type === 'node'
              ? buildNodeMenuItems(contextMenu.nodeId!)
              : contextMenu.type === 'edge'
                ? buildEdgeMenuItems(contextMenu.edgeId!, contextMenu.edgeFlowType!)
                : buildPaneMenuItems()
          }
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Edit Panel */}
      {editPanel && (
        <NodeEditPanel
          x={editPanel.x}
          y={editPanel.y}
          initialData={getEditInitialData()}
          onSave={handleEditSave}
          onCancel={() => setEditPanel(null)}
        />
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{ position: 'absolute', left: tooltip.x, top: tooltip.y, zIndex: 50 }}
          className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-300 shadow-lg"
        >
          {tooltip.text}
        </div>
      )}
    </div>
  )
}
