import { create } from 'zustand'
import {
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge as rfAddEdge,
} from 'reactflow'
import dagre from '@dagrejs/dagre'
import type { FlowNode, FlowEdge, GraphConfig, GraphNodeData, ServiceCategory } from '../types'
import { DEBOUNCE_PERSIST_MS } from '../constants'
import { getNodeColor, getEdgeColor, getConfidenceBackground } from '../components/FlowGraph/flowUtils'
import { useHistoryStore } from './historyStore'

const NODE_WIDTH = 180
const NODE_HEIGHT = 60
const LAYER_NODE_WIDTH = 220
const LAYER_NODE_HEIGHT = 44
const VIRTUAL_NODE_WIDTH = 160
const VIRTUAL_NODE_HEIGHT = 48

function isLayerNode(node: FlowNode | Node): boolean {
  const data = 'data' in node ? (node as Node).data : node
  const nodeType = data?.nodeType ?? data?.type
  return nodeType === 'layer'
}

// Virtual nodes have no serviceId — they are grouping nodes (frontend, backend, layer-*)
function isVirtualNode(node: FlowNode | Node): boolean {
  const data = 'data' in node ? (node as Node).data : node
  return !data?.serviceId
}

function getNodeDimensions(node: FlowNode | Node): { width: number; height: number } {
  if (isLayerNode(node)) return { width: LAYER_NODE_WIDTH, height: LAYER_NODE_HEIGHT }
  if (isVirtualNode(node)) return { width: VIRTUAL_NODE_WIDTH, height: VIRTUAL_NODE_HEIGHT }
  return { width: NODE_WIDTH, height: NODE_HEIGHT }
}
let persistTimer: ReturnType<typeof setTimeout> | null = null
let persistLock = false
let persistQueued = false

// Dagre layout cache — skip recalculation when structure hasn't changed
let lastLayoutHash = ''
let lastLayoutPositions: Map<string, { x: number; y: number }> = new Map()

export function hashStructure(nodes: FlowNode[], edges: FlowEdge[]): string {
  const nodeIds = nodes.map(n => n.id).sort().join(',')
  const edgeIds = edges.map(e => `${e.source}->${e.target}`).sort().join(',')
  return `${nodeIds}|${edgeIds}`
}

// Module-level callbacks — set by useStore to avoid circular dependency
let _getServices: (() => import('../types').Service[]) | null = null
let _deleteService: ((serviceId: string) => void) | null = null
let _getRepoPath: (() => string | null) | null = null
let _recalculateScore: (() => void) | null = null

export function registerServiceGetter(getter: () => import('../types').Service[]) {
  _getServices = getter
}

export function registerServiceDeleter(deleter: (serviceId: string) => void) {
  _deleteService = deleter
}

export function registerRepoPathGetter(getter: () => string | null) {
  _getRepoPath = getter
}

export function registerScoreRecalculator(fn: () => void) {
  _recalculateScore = fn
}

function getCurrentServices(): import('../types').Service[] {
  return _getServices?.() ?? []
}

// ── helpers ──

function buildNodeStyle(nodeType: FlowNode['type'], confidence?: 'high' | 'medium' | 'low', layerColor?: string) {
  if (nodeType === 'layer') {
    const color = layerColor || '#e2b04a'
    return {
      width: LAYER_NODE_WIDTH,
      height: LAYER_NODE_HEIGHT,
      background: 'transparent',
      border: `1px dashed ${color}`,
      borderRadius: '20px',
      color,
      fontSize: '10px',
      fontWeight: 700,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.12em',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4px 12px',
    }
  }
  return {
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    background: getConfidenceBackground(confidence),
    border: `2px solid ${getNodeColor(nodeType)}`,
    borderRadius: '12px',
    color: 'var(--color-text-primary)',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px',
  }
}

function buildEdgeStyle(flowType: FlowEdge['flowType']) {
  return {
    stroke: getEdgeColor(flowType),
    strokeWidth: 2,
  }
}

function flowNodesToRFNodes(
  flowNodes: FlowNode[],
  savedPositions: Map<string, { x: number; y: number }>,
  flowEdges: FlowEdge[],
): Node[] {
  // If ALL nodes have saved positions, use them directly
  const allSaved = flowNodes.every((n) => savedPositions.has(n.id))

  let positionMap: Map<string, { x: number; y: number }>

  if (allSaved) {
    positionMap = savedPositions
  } else {
    // Check dagre cache — skip recalculation if structure unchanged
    const structureHash = hashStructure(flowNodes, flowEdges)
    if (structureHash === lastLayoutHash && lastLayoutPositions.size > 0) {
      positionMap = lastLayoutPositions
    } else {
      // Any new nodes → recalculate full layout with dagre to avoid overlaps
      const g = new dagre.graphlib.Graph()
      g.setDefaultEdgeLabel(() => ({}))
      g.setGraph({ rankdir: 'TB', ranksep: 120, nodesep: 80, marginx: 20, marginy: 20 })

      for (const node of flowNodes) {
        const dim = getNodeDimensions(node)
        g.setNode(node.id, { width: dim.width, height: dim.height })
      }
      for (const edge of flowEdges) {
        g.setEdge(edge.source, edge.target)
      }
      dagre.layout(g)

      positionMap = new Map()
      for (const node of flowNodes) {
        const dim = getNodeDimensions(node)
        const pos = g.node(node.id)
        positionMap.set(node.id, {
          x: (pos?.x ?? 0) - dim.width / 2,
          y: (pos?.y ?? 0) - dim.height / 2,
        })
      }

      // Cache the result
      lastLayoutHash = structureHash
      lastLayoutPositions = positionMap
    }
  }

  return flowNodes.map((node) => ({
    id: node.id,
    position: positionMap.get(node.id) ?? { x: 0, y: 0 },
    data: {
      label: node.label,
      nodeType: node.type,
      serviceId: node.serviceId,
      category: undefined as ServiceCategory | undefined,
      plan: 'unknown' as string,
      confidence: undefined as 'high' | 'medium' | 'low' | undefined,
      url: undefined as string | undefined,
      note: undefined as string | undefined,
      source: (node.serviceId ? 'inferred' : 'manual') as 'inferred' | 'manual',
      layerColor: node.layerColor,
    },
    style: buildNodeStyle(node.type, undefined, node.layerColor),
  }))
}

function flowEdgesToRFEdges(flowEdges: FlowEdge[]): Edge[] {
  return flowEdges.map((edge, i) => ({
    id: `e-${edge.source}-${edge.target}-${i}`,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    animated: true,
    data: { flowType: edge.flowType },
    style: buildEdgeStyle(edge.flowType),
    labelStyle: { fill: 'var(--color-text-muted)', fontSize: 11 },
  }))
}

// ── Store ──

interface GraphStoreState {
  nodes: Node[]
  edges: Edge[]
  excludedServices: string[]

  // Initialization
  initFromAnalysis: (
    flowNodes: FlowNode[],
    flowEdges: FlowEdge[],
    graphConfig: GraphConfig | undefined,
    services: import('../types').Service[],
  ) => void

  // React Flow change handlers
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void

  // Node operations
  addNode: (id: string, position: { x: number; y: number }, data: GraphNodeData) => void
  updateNode: (id: string, data: Partial<GraphNodeData>) => void
  deleteNode: (id: string) => void

  // Edge operations
  addEdge: (source: string, target: string, flowType: FlowEdge['flowType']) => void
  deleteEdge: (edgeId: string) => void
  updateEdgeType: (edgeId: string, flowType: FlowEdge['flowType']) => void

  // Exclusion
  excludeService: (serviceId: string) => void

  // Layout
  resetLayout: () => void

  // Position persistence (called on drag stop)
  saveNodePosition: (nodeId: string, position: { x: number; y: number }) => void

  // Persist to config
  persistToConfig: () => Promise<void>
}

export const useGraphStore = create<GraphStoreState>((set, get) => ({
  nodes: [],
  edges: [],
  excludedServices: [],

  initFromAnalysis: (flowNodes, flowEdges, graphConfig, services) => {
    const savedPositions = new Map<string, { x: number; y: number }>()
    const savedNodeData = new Map<string, GraphNodeData>()

    if (graphConfig) {
      for (const n of graphConfig.nodes) {
        savedPositions.set(n.id, n.position)
        savedNodeData.set(n.id, n.data)
      }
    }

    // All services appear in the graph — no filtering.
    let rfNodes = flowNodesToRFNodes(flowNodes, savedPositions, flowEdges)

    // Apply saved data overrides (edited labels, categories, etc.)
    rfNodes = rfNodes.map((n) => {
      const saved = savedNodeData.get(n.id)
      const svc = services.find((s) => s.id === n.data.serviceId)
      const svcConfidence = svc?.confidence ?? 'high'
      if (saved) {
        // Layer nodes from analysis always keep type: 'layer' — saved config may have stale old types
        const isAnalysisLayer = n.data.nodeType === 'layer'
        const nodeType = isAnalysisLayer ? 'layer' : (saved.nodeType ?? n.data.nodeType)
        const confidence = saved.confidence ?? svcConfidence
        const layerColor = isAnalysisLayer ? (n.data.layerColor ?? saved.layerColor) : (saved.layerColor ?? n.data.layerColor)
        return {
          ...n,
          data: {
            ...n.data,
            label: saved.label ?? n.data.label,
            nodeType,
            category: saved.category ?? n.data.category,
            plan: saved.plan ?? n.data.plan,
            confidence,
            url: saved.url ?? n.data.url,
            note: saved.note ?? n.data.note,
            source: saved.source ?? n.data.source,
            layerColor,
          },
          style: buildNodeStyle(nodeType, confidence, layerColor),
        }
      }
      // Enrich with service data
      if (svc) {
        return {
          ...n,
          data: {
            ...n.data,
            category: svc.category,
            plan: svc.plan,
            confidence: svcConfidence,
            url: svc.url,
            note: svc.notes,
            source: svc.source,
          },
          style: buildNodeStyle(n.data.nodeType, svcConfidence),
        }
      }
      return n
    })

    // Add manual nodes from graph config that aren't in the analysis
    if (graphConfig) {
      for (const gn of graphConfig.nodes) {
        if (!rfNodes.find((n) => n.id === gn.id)) {
          const nodeType = gn.data.nodeType ?? 'external'
          const layerColor = gn.data.layerColor
          rfNodes.push({
            id: gn.id,
            position: gn.position,
            data: {
              label: gn.data.label,
              nodeType,
              serviceId: undefined,
              category: gn.data.category,
              plan: gn.data.plan ?? 'unknown',
              confidence: gn.data.confidence ?? 'high',
              url: gn.data.url,
              note: gn.data.note,
              source: gn.data.source ?? 'manual',
              layerColor,
            },
            style: buildNodeStyle(nodeType, gn.data.confidence, layerColor),
          })
        }
      }
    }

    // Build edges: merge inferred with saved
    let rfEdges = flowEdgesToRFEdges(flowEdges)

    // Add saved edges that aren't in the analysis
    if (graphConfig) {
      const existingEdgeKeys = new Set(rfEdges.map((e) => `${e.source}-${e.target}`))
      const allNodeIds = new Set(rfNodes.map((n) => n.id))
      for (const ge of graphConfig.edges) {
        const key = `${ge.source}-${ge.target}`
        if (!existingEdgeKeys.has(key) && allNodeIds.has(ge.source) && allNodeIds.has(ge.target)) {
          rfEdges.push({
            id: ge.id,
            source: ge.source,
            target: ge.target,
            animated: true,
            data: { flowType: ge.type },
            style: buildEdgeStyle(ge.type),
            labelStyle: { fill: 'var(--color-text-muted)', fontSize: 11 },
          })
        }
      }
    }

    set({
      nodes: rfNodes,
      edges: rfEdges,
      excludedServices: graphConfig?.excludedServices ?? [],
    })
  },

  onNodesChange: (changes) => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
    }))
  },

  onEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    }))
  },

  onConnect: (connection) => {
    if (connection.source === connection.target) return
    useHistoryStore.getState().pushSnapshot('Connect nodes', {
      nodes: get().nodes, edges: get().edges, services: getCurrentServices(),
    })
    const newEdge = {
      ...connection,
      animated: true,
      data: { flowType: 'data' as FlowEdge['flowType'] },
      style: buildEdgeStyle('data'),
      labelStyle: { fill: 'var(--color-text-muted)', fontSize: 11 },
    }
    set((state) => ({
      edges: rfAddEdge(newEdge, state.edges),
    }))
    // Auto-persist
    setTimeout(() => get().persistToConfig(), 0)
  },

  addNode: (id, position, data) => {
    useHistoryStore.getState().pushSnapshot('Add node', {
      nodes: get().nodes, edges: get().edges, services: getCurrentServices(),
    })
    const nodeType = data.nodeType ?? 'external'
    const newNode: Node = {
      id,
      position,
      data: {
        label: data.label,
        nodeType,
        serviceId: undefined,
        category: data.category,
        plan: data.plan ?? 'unknown',
        confidence: data.confidence ?? 'high',
        url: data.url,
        note: data.note,
        source: data.source ?? 'manual',
        layerColor: data.layerColor,
      },
      style: buildNodeStyle(nodeType, data.confidence, data.layerColor),
    }
    set((state) => ({ nodes: [...state.nodes, newNode] }))
    get().persistToConfig()
  },

  updateNode: (id, data) => {
    useHistoryStore.getState().pushSnapshot('Update node', {
      nodes: get().nodes, edges: get().edges, services: getCurrentServices(),
    })
    set((state) => ({
      nodes: state.nodes.map((n) => {
        if (n.id !== id) return n
        const newData = { ...n.data, ...data }
        const nodeType = data.nodeType ?? n.data.nodeType
        const confidence = data.confidence ?? n.data.confidence
        const layerColor = data.layerColor ?? n.data.layerColor
        return {
          ...n,
          data: newData,
          style: buildNodeStyle(nodeType, confidence, layerColor),
        }
      }),
    }))
    get().persistToConfig()
  },

  deleteNode: (id) => {
    // Find the node before removing it so we can check for a linked service
    const node = get().nodes.find((n) => n.id === id)

    useHistoryStore.getState().pushSnapshot('Delete node', {
      nodes: get().nodes, edges: get().edges, services: getCurrentServices(),
    })

    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
    }))

    // If this node was linked to a service, remove the service from the main store
    if (node?.data?.serviceId && _deleteService) {
      _deleteService(node.data.serviceId as string)
    }

    get().persistToConfig()
  },

  addEdge: (source, target, flowType) => {
    const id = `e-${source}-${target}-${Date.now()}`
    const newEdge: Edge = {
      id,
      source,
      target,
      animated: true,
      data: { flowType },
      style: buildEdgeStyle(flowType),
      labelStyle: { fill: 'var(--color-text-muted)', fontSize: 11 },
    }
    set((state) => ({ edges: [...state.edges, newEdge] }))
    get().persistToConfig()
  },

  deleteEdge: (edgeId) => {
    useHistoryStore.getState().pushSnapshot('Delete edge', {
      nodes: get().nodes, edges: get().edges, services: getCurrentServices(),
    })
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== edgeId),
    }))
    get().persistToConfig()
  },

  updateEdgeType: (edgeId, flowType) => {
    useHistoryStore.getState().pushSnapshot('Change edge type', {
      nodes: get().nodes, edges: get().edges, services: getCurrentServices(),
    })
    set((state) => ({
      edges: state.edges.map((e) => {
        if (e.id !== edgeId) return e
        return {
          ...e,
          data: { ...e.data, flowType },
          style: buildEdgeStyle(flowType),
        }
      }),
    }))
    get().persistToConfig()
  },

  excludeService: (serviceId) => {
    set((state) => ({
      excludedServices: [...state.excludedServices, serviceId],
    }))
    get().persistToConfig()
  },

  resetLayout: () => {
    useHistoryStore.getState().pushSnapshot('Reset layout', {
      nodes: get().nodes, edges: get().edges, services: getCurrentServices(),
    })
    const { nodes, edges } = get()

    const g = new dagre.graphlib.Graph()
    g.setDefaultEdgeLabel(() => ({}))
    g.setGraph({ rankdir: 'TB', ranksep: 120, nodesep: 80, marginx: 20, marginy: 20 })

    for (const node of nodes) {
      const dim = getNodeDimensions(node)
      g.setNode(node.id, { width: dim.width, height: dim.height })
    }
    for (const edge of edges) {
      g.setEdge(edge.source, edge.target)
    }
    dagre.layout(g)

    set({
      nodes: nodes.map((node) => {
        const dim = getNodeDimensions(node)
        const pos = g.node(node.id)
        return {
          ...node,
          position: {
            x: (pos?.x ?? 0) - dim.width / 2,
            y: (pos?.y ?? 0) - dim.height / 2,
          },
        }
      }),
    })
    get().persistToConfig()
  },

  saveNodePosition: (nodeId, position) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, position } : n,
      ),
    }))
    get().persistToConfig()
  },

  persistToConfig: async () => {
    if (!window.stackwatch) return
    if (persistTimer) clearTimeout(persistTimer)
    await new Promise<void>(resolve => {
      persistTimer = setTimeout(resolve, DEBOUNCE_PERSIST_MS)
    })

    // Serialize writes: if already writing, queue a re-persist with latest state
    if (persistLock) {
      persistQueued = true
      return
    }
    persistLock = true

    try {
      const { nodes, edges, excludedServices } = get()

      const graphConfig: GraphConfig = {
        nodes: nodes.map((n) => ({
          id: n.id,
          position: n.position,
          data: {
            label: n.data.label,
            category: n.data.category,
            nodeType: n.data.nodeType,
            plan: n.data.plan,
            confidence: n.data.confidence,
            url: n.data.url,
            note: n.data.note,
            source: n.data.source,
            layerColor: n.data.layerColor,
          },
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          type: e.data?.flowType ?? 'data',
        })),
        excludedServices,
      }

      // Use the main store's repoPath via registered getter (avoids circular dependency)
      const repoPath = _getRepoPath?.()
      if (!repoPath) return

      let config = await window.stackwatch.loadConfig(repoPath)
      if (!config) {
        config = {
          version: '1',
          project: { name: '', description: '' },
          services: [],
          accounts: [],
        }
      }
      config.graph = graphConfig
      await window.stackwatch.saveConfig(repoPath, config)
    } catch (err) {
      console.error('[GraphStore] Failed to persist config:', err)
    } finally {
      persistLock = false
      if (persistQueued) {
        persistQueued = false
        get().persistToConfig()
      }
    }
  },
}))

// Recalculate score when graph structure changes (node/edge add/remove)
useGraphStore.subscribe(
  (state, prev) => {
    if (state.nodes.length !== prev.nodes.length || state.edges.length !== prev.edges.length) {
      _recalculateScore?.()
    }
  }
)
