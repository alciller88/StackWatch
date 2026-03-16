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
import { getNodeColor, getEdgeColor } from '../components/FlowGraph/flowUtils'

const NODE_WIDTH = 180
const NODE_HEIGHT = 60

// ── helpers ──

function buildNodeStyle(nodeType: FlowNode['type']) {
  return {
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    background: '#1f2937',
    border: `2px solid ${getNodeColor(nodeType)}`,
    borderRadius: '12px',
    color: '#f9fafb',
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
  // If ALL nodes have saved positions, skip dagre
  const allSaved = flowNodes.every((n) => savedPositions.has(n.id))

  let positionMap: Map<string, { x: number; y: number }>

  if (allSaved) {
    positionMap = savedPositions
  } else {
    // Run dagre for nodes without saved positions
    const g = new dagre.graphlib.Graph()
    g.setDefaultEdgeLabel(() => ({}))
    g.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 40, marginx: 20, marginy: 20 })

    for (const node of flowNodes) {
      g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
    }
    for (const edge of flowEdges) {
      g.setEdge(edge.source, edge.target)
    }
    dagre.layout(g)

    positionMap = new Map()
    for (const node of flowNodes) {
      const saved = savedPositions.get(node.id)
      if (saved) {
        positionMap.set(node.id, saved)
      } else {
        const pos = g.node(node.id)
        positionMap.set(node.id, {
          x: (pos?.x ?? 0) - NODE_WIDTH / 2,
          y: (pos?.y ?? 0) - NODE_HEIGHT / 2,
        })
      }
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
      url: undefined as string | undefined,
      note: undefined as string | undefined,
      source: (node.serviceId ? 'inferred' : 'manual') as 'inferred' | 'manual',
    },
    style: buildNodeStyle(node.type),
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
    labelStyle: { fill: '#9ca3af', fontSize: 11 },
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

    // Filter out excluded services
    const excluded = new Set(graphConfig?.excludedServices ?? [])
    const filteredFlowNodes = flowNodes.filter((n) => {
      if (!n.serviceId) return true
      return !excluded.has(n.serviceId)
    })
    const validNodeIds = new Set(filteredFlowNodes.map((n) => n.id))
    const filteredFlowEdges = flowEdges.filter(
      (e) => validNodeIds.has(e.source) && validNodeIds.has(e.target),
    )

    let rfNodes = flowNodesToRFNodes(filteredFlowNodes, savedPositions, filteredFlowEdges)

    // Apply saved data overrides (edited labels, categories, etc.)
    rfNodes = rfNodes.map((n) => {
      const saved = savedNodeData.get(n.id)
      if (saved) {
        return {
          ...n,
          data: {
            ...n.data,
            label: saved.label ?? n.data.label,
            nodeType: saved.nodeType ?? n.data.nodeType,
            category: saved.category ?? n.data.category,
            plan: saved.plan ?? n.data.plan,
            url: saved.url ?? n.data.url,
            note: saved.note ?? n.data.note,
            source: saved.source ?? n.data.source,
          },
          style: buildNodeStyle(saved.nodeType ?? n.data.nodeType),
        }
      }
      // Enrich with service data
      const svc = services.find((s) => s.id === n.data.serviceId)
      if (svc) {
        return {
          ...n,
          data: {
            ...n.data,
            category: svc.category,
            plan: svc.plan,
            url: svc.url,
            note: svc.notes,
            source: svc.source,
          },
        }
      }
      return n
    })

    // Add manual nodes from graph config that aren't in the analysis
    if (graphConfig) {
      for (const gn of graphConfig.nodes) {
        if (!rfNodes.find((n) => n.id === gn.id)) {
          rfNodes.push({
            id: gn.id,
            position: gn.position,
            data: {
              label: gn.data.label,
              nodeType: gn.data.nodeType ?? 'external',
              serviceId: undefined,
              category: gn.data.category,
              plan: gn.data.plan ?? 'unknown',
              url: gn.data.url,
              note: gn.data.note,
              source: gn.data.source ?? 'manual',
            },
            style: buildNodeStyle(gn.data.nodeType ?? 'external'),
          })
        }
      }
    }

    // Build edges: merge inferred with saved
    let rfEdges = flowEdgesToRFEdges(filteredFlowEdges)

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
            labelStyle: { fill: '#9ca3af', fontSize: 11 },
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
    const newEdge = {
      ...connection,
      animated: true,
      data: { flowType: 'data' as FlowEdge['flowType'] },
      style: buildEdgeStyle('data'),
      labelStyle: { fill: '#9ca3af', fontSize: 11 },
    }
    set((state) => ({
      edges: rfAddEdge(newEdge, state.edges),
    }))
    // Auto-persist
    setTimeout(() => get().persistToConfig(), 0)
  },

  addNode: (id, position, data) => {
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
        url: data.url,
        note: data.note,
        source: data.source ?? 'manual',
      },
      style: buildNodeStyle(nodeType),
    }
    set((state) => ({ nodes: [...state.nodes, newNode] }))
    get().persistToConfig()
  },

  updateNode: (id, data) => {
    set((state) => ({
      nodes: state.nodes.map((n) => {
        if (n.id !== id) return n
        const newData = { ...n.data, ...data }
        const nodeType = data.nodeType ?? n.data.nodeType
        return {
          ...n,
          data: newData,
          style: buildNodeStyle(nodeType),
        }
      }),
    }))
    get().persistToConfig()
  },

  deleteNode: (id) => {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
    }))
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
      labelStyle: { fill: '#9ca3af', fontSize: 11 },
    }
    set((state) => ({ edges: [...state.edges, newEdge] }))
    get().persistToConfig()
  },

  deleteEdge: (edgeId) => {
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== edgeId),
    }))
    get().persistToConfig()
  },

  updateEdgeType: (edgeId, flowType) => {
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
    const { nodes, edges } = get()

    const g = new dagre.graphlib.Graph()
    g.setDefaultEdgeLabel(() => ({}))
    g.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 40, marginx: 20, marginy: 20 })

    for (const node of nodes) {
      g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
    }
    for (const edge of edges) {
      g.setEdge(edge.source, edge.target)
    }
    dagre.layout(g)

    set({
      nodes: nodes.map((node) => {
        const pos = g.node(node.id)
        return {
          ...node,
          position: {
            x: (pos?.x ?? 0) - NODE_WIDTH / 2,
            y: (pos?.y ?? 0) - NODE_HEIGHT / 2,
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
          url: n.data.url,
          note: n.data.note,
          source: n.data.source,
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

    // We need to read the current config, merge graph, and save
    // Use the main store's repoPath
    const { useStore } = await import('./useStore')
    const repoPath = useStore.getState().repoPath
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
  },
}))
