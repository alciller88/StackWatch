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
import { useDialogStore } from '../../store/dialogStore'
import { getNodeColor, getNodeIcon, getEdgeColor, getLayerIcon } from './flowUtils'
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
  const flowNodes = useStore(s => s.flowNodes)
  const flowEdges = useStore(s => s.flowEdges)
  const services = useStore(s => s.services)
  const config = useStore(s => s.config)
  const openFolder = useStore(s => s.openFolder)
  const scanDiffAdded = useStore(s => s.scanDiffAdded)
  const scanDiffRemoved = useStore(s => s.scanDiffRemoved)
  const nodes = useGraphStore(s => s.nodes)
  const edges = useGraphStore(s => s.edges)
  const onNodesChange = useGraphStore(s => s.onNodesChange)
  const onEdgesChange = useGraphStore(s => s.onEdgesChange)
  const onConnect = useGraphStore(s => s.onConnect)
  const initFromAnalysis = useGraphStore(s => s.initFromAnalysis)
  const saveNodePosition = useGraphStore(s => s.saveNodePosition)
  const addNode = useGraphStore(s => s.addNode)
  const updateNode = useGraphStore(s => s.updateNode)
  const deleteNode = useGraphStore(s => s.deleteNode)
  const excludeService = useGraphStore(s => s.excludeService)
  const deleteEdge = useGraphStore(s => s.deleteEdge)
  const updateEdgeType = useGraphStore(s => s.updateEdgeType)
  const resetLayout = useGraphStore(s => s.resetLayout)
  const persistToConfig = useGraphStore(s => s.persistToConfig)
  const { confirm } = useDialogStore()
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [editPanel, setEditPanel] = useState<EditPanelState | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)

  // Re-initialize graph only when analysis data changes.
  // config, services, and initFromAnalysis are intentionally excluded:
  // they change as a result of initialization, which would cause loops.
  useEffect(() => {
    if (flowNodes.length === 0) {
      initialized.current = false
      return
    }
    initFromAnalysis(flowNodes, flowEdges, config?.graph, services)
    initialized.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialization effect: config, services, and initFromAnalysis are excluded to prevent re-init loops
  }, [flowNodes, flowEdges])

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
      saveNodePosition(node.id, node.position)
    },
    [saveNodePosition],
  )

  // ── Build context menu items ──

  const buildNodeMenuItems = (nodeId: string): MenuEntry[] => {
    const node = nodes.find((n) => n.id === nodeId)
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
            window.stackwatch.openExternalUrl(url)
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
        onClick: async () => {
          const name = node.data.label ?? nodeId
          const result = await confirm({
            title: 'Delete node',
            message: `Delete ${name}?`,
            detail: 'This will also remove it from stackwatch.config.json.',
            buttons: [
              { label: 'Cancel', value: 'cancel' },
              { label: 'Delete', value: 'delete', danger: true },
            ],
          })
          if (result === 'delete') {
            if (node.data.source === 'inferred' && node.data.serviceId) {
              excludeService(node.data.serviceId)
            }
            deleteNode(nodeId)
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
      {
        label: 'Add layer node',
        icon: '\u{1F4CB}',
        onClick: () => {
          if (!contextMenu) return
          const id = `layer-custom-${Date.now()}`
          addNode(id, { x: contextMenu.x, y: contextMenu.y }, {
            label: 'New Layer',
            nodeType: 'layer',
            source: 'manual',
            layerColor: 'var(--color-accent)',
          })
        },
      },
      { divider: true },
      {
        label: 'Reset to auto layout',
        icon: '↺',
        onClick: async () => {
          const result = await confirm({
            title: 'Reset layout',
            message: 'Reset node positions to automatic layout?',
            detail: 'Custom positions will be lost.',
            buttons: [
              { label: 'Cancel', value: 'cancel' },
              { label: 'Reset', value: 'reset', primary: true },
            ],
          })
          if (result === 'reset') resetLayout()
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
        onClick: () => updateEdgeType(edgeId, t.type as any),
      })),
      { divider: true },
      {
        label: 'Delete edge',
        icon: '🗑️',
        danger: true,
        onClick: async () => {
          const result = await confirm({
            title: 'Delete edge',
            message: 'Delete this edge?',
            detail: 'This will also remove it from stackwatch.config.json.',
            buttons: [
              { label: 'Cancel', value: 'cancel' },
              { label: 'Delete', value: 'delete', danger: true },
            ],
          })
          if (result === 'delete') {
            deleteEdge(edgeId)
          }
        },
      },
    ]
  }

  // ── Edit panel handlers ──

  const handleEditSave = (data: {
    label: string
    nodeType: FlowNode['type']
    category?: ServiceCategory
    plan?: 'free' | 'paid' | 'trial' | 'unknown'
    confidence?: 'high' | 'medium' | 'low'
    url?: string
    note?: string
    billing?: import('../../types').ServiceBilling
  }) => {
    if (editPanel?.nodeId) {
      // Update existing node
      updateNode(editPanel.nodeId, {
        label: data.label,
        nodeType: data.nodeType,
        category: data.category,
        plan: data.plan,
        confidence: data.confidence,
        url: data.url,
        note: data.note,
      })
      // Sync ALL fields to the linked service so ServicesPanel stays in sync
      const node = nodes.find(n => n.id === editPanel.nodeId)
      if (node?.data?.serviceId) {
        const { useStore } = require('../../store/useStore')
        const svc = useStore.getState().services.find((s: import('../../types').Service) => s.id === node.data.serviceId)
        if (svc) {
          useStore.getState().updateManualService({
            ...svc,
            name: data.label,
            category: data.category ?? svc.category,
            plan: data.plan ?? svc.plan,
            confidence: data.confidence ?? svc.confidence,
            url: data.url ?? svc.url,
            notes: data.note ?? svc.notes,
            billing: data.billing ?? svc.billing,
          })
        }
      }
    } else {
      // Create new node
      const id = data.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      const position = editPanel?.createPosition ?? { x: 200, y: 200 }
      addNode(id, position, {
        label: data.label,
        nodeType: data.nodeType,
        category: data.category,
        plan: data.plan,
        confidence: data.confidence,
        url: data.url,
        note: data.note,
        source: 'manual',
      })
    }
    setEditPanel(null)
  }

  const getEditInitialData = () => {
    if (editPanel?.nodeId) {
      const node = nodes.find((n) => n.id === editPanel.nodeId)
      if (node) {
        // Get billing from linked service if available
        const { useStore } = require('../../store/useStore')
        const svc = node.data.serviceId
          ? useStore.getState().services.find((s: import('../../types').Service) => s.id === node.data.serviceId)
          : undefined
        return {
          label: node.data.label ?? '',
          nodeType: node.data.nodeType ?? 'external',
          category: node.data.category,
          plan: node.data.plan,
          confidence: node.data.confidence,
          url: node.data.url,
          note: node.data.note,
          billing: svc?.billing,
        }
      }
    }
    // Defaults for new node
    return {
      label: '',
      nodeType: 'external' as FlowNode['type'],
      category: editPanel?.isCustom ? ('other' as ServiceCategory) : undefined,
      plan: 'unknown',
      confidence: 'high' as const,
      url: undefined,
      note: undefined,
      billing: undefined,
    }
  }

  // ── Render ──

  if (flowNodes.length === 0 && nodes.length === 0) {
    return (
      <div
        style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '12px',
          fontFamily: 'IBM Plex Mono', fontSize: '11px', letterSpacing: '0.1em',
          color: 'var(--color-text-muted)', background: 'var(--color-bg-primary)',
          backgroundImage: 'linear-gradient(var(--color-grid) 1px, transparent 1px), linear-gradient(90deg, var(--color-grid) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          textTransform: 'uppercase',
        }}
      >
        <span>NO FLOW DATA — ANALYZE A REPOSITORY TO GENERATE THE GRAPH</span>
        <span style={{ fontSize: '10px', letterSpacing: '0.05em', textTransform: 'none', maxWidth: '420px', textAlign: 'center', lineHeight: '1.6' }}>
          Open a local folder or connect a GitHub repo to visualize your service architecture
        </span>
        <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
          <button
            onClick={() => openFolder()}
            className="bg-transparent border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)] transition-colors"
            style={{
              fontFamily: 'IBM Plex Mono', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase',
              padding: '6px 16px', cursor: 'pointer',
            }}
          >
            Open folder
          </button>
        </div>
      </div>
    )
  }

  // Apply confidence styling + icons + diff highlights to nodes for rendering
  const styledNodes = nodes.map((n) => {
    const confidence = n.data.confidence ?? 'high'
    const isLowConfidence = confidence === 'low'
    const isLayer = n.data.nodeType === 'layer'
    const icon = isLayer ? getLayerIcon(n.data.label ?? '') : getNodeIcon(n.data.nodeType ?? 'external')
    const serviceId = n.data.serviceId as string | undefined

    // Diff highlight
    const isAdded = serviceId ? scanDiffAdded.has(serviceId) : false
    const isRemoved = serviceId ? scanDiffRemoved.has(serviceId) : false

    let style = n.style ?? {}
    if (isLowConfidence && !isLayer) {
      style = { ...style, borderStyle: 'dashed', opacity: 0.7 }
    }
    if (isAdded) {
      style = { ...style, border: '2px solid var(--color-success)', boxShadow: '0 0 8px var(--color-success-muted)', transition: 'all 0.3s ease' }
    }
    if (isRemoved) {
      style = { ...style, opacity: 0.4, border: '2px solid var(--color-text-muted)', transition: 'opacity 0.5s ease' }
    }

    return {
      ...n,
      style,
      data: {
        ...n.data,
        label: isLayer ? (
          <div
            className="flex items-center gap-1.5"
            style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}
          >
            <span style={{ fontSize: '12px' }}>{icon}</span>
            <span className="truncate">{n.data.label}</span>
          </div>
        ) : (
          <div
            className="flex items-center gap-2"
            title={isLowConfidence ? 'Low confidence detection' : undefined}
          >
            <span>{icon}</span>
            <span className={`truncate ${isRemoved ? 'line-through' : ''}`}>{n.data.label}</span>
            {isLowConfidence && <span className="text-[var(--color-accent)] text-[11px]">?</span>}
          </div>
        ),
      },
    }
  })

  return (
    <div ref={containerRef} className="flex-1 relative" style={{ height: '100%' }}>
      {/* Legend */}
      <div
        className="absolute top-4 right-4 z-10 space-y-1.5"
        style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 0,
          padding: '10px 12px',
          fontSize: '10px',
          fontFamily: 'IBM Plex Mono',
        }}
      >
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--color-text-muted)', marginBottom: '8px' }}>Edge Types</div>
        {[
          { color: getEdgeColor('data'), label: 'Data' },
          { color: getEdgeColor('auth'), label: 'Auth' },
          { color: getEdgeColor('payment'), label: 'Payment' },
          { color: getEdgeColor('webhook'), label: 'Webhook' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="w-4 h-0.5 inline-block" style={{ background: item.color }} />
            <span style={{ color: 'var(--color-text-secondary)' }}>{item.label}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '6px', marginTop: '6px' }}>
          <div className="flex items-center gap-2">
            <span className="w-4 h-0.5 inline-block" style={{ borderTop: '1px dashed var(--color-accent)' }} />
            <span style={{ color: 'var(--color-text-secondary)' }}>Low confidence</span>
          </div>
        </div>
      </div>

      <ReactFlow
        nodes={styledNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
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
        <Background color="var(--color-border)" gap={32} size={1} />
        <Controls
          style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 0,
          }}
        />
        <MiniMap
          nodeColor={(node) => getNodeColor(node.data?.nodeType ?? 'external')}
          style={{
            background: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border)',
            borderRadius: 0,
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
          style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y,
            zIndex: 50,
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 0,
            padding: '4px 8px',
            fontFamily: 'IBM Plex Mono',
            fontSize: '10px',
            color: 'var(--color-text-secondary)',
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  )
}
