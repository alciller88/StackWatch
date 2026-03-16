import type { Service, Dependency, FlowNode, FlowEdge } from '../types'

const FRONTEND_DEPS = ['react', 'vue', 'svelte', '@angular/core', 'next', 'nuxt', 'gatsby']
const BACKEND_DEPS = ['express', 'fastify', 'koa', '@nestjs/core', 'hapi', 'restify']

export function inferFlowGraph(
  services: Service[],
  dependencies: Dependency[],
  projectName: string = 'App',
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const nodes: FlowNode[] = []
  const edges: FlowEdge[] = []
  const depNames = new Set(dependencies.map((d) => d.name))

  // User node — always present
  nodes.push({ id: 'user', label: 'User', type: 'user' })

  // Frontend
  const hasFrontend = FRONTEND_DEPS.some((d) => depNames.has(d))
  if (hasFrontend) {
    nodes.push({ id: 'frontend', label: projectName, type: 'frontend' })
    edges.push({ source: 'user', target: 'frontend', flowType: 'data' })
  }

  // Backend / API
  const hasBackend = BACKEND_DEPS.some((d) => depNames.has(d))
  if (hasBackend) {
    const label = hasFrontend
      ? (BACKEND_DEPS.find((d) => depNames.has(d)) ?? 'API')
      : projectName
    nodes.push({ id: 'api', label, type: 'api' })
    if (hasFrontend) {
      edges.push({ source: 'frontend', target: 'api', flowType: 'data' })
    } else {
      edges.push({ source: 'user', target: 'api', flowType: 'data' })
    }
  }

  const apiNodeId = hasBackend ? 'api' : hasFrontend ? 'frontend' : 'user'

  // Map category → node type
  const categoryToNodeType = (cat: Service['category']): FlowNode['type'] => {
    if (cat === 'cdn') return 'cdn'
    if (cat === 'database') return 'database'
    return 'external'
  }

  // Create a node for EVERY service — no filtering, no exceptions
  for (const svc of services) {
    const nodeId = `svc-${svc.id}`
    const nodeType = categoryToNodeType(svc.category)

    nodes.push({
      id: nodeId,
      label: svc.name,
      type: nodeType,
      serviceId: svc.id,
    })

    // Determine edge type and source based on category
    let flowType: FlowEdge['flowType'] = 'data'
    if (svc.category === 'payments') flowType = 'payment'
    if (svc.category === 'auth') flowType = 'auth'

    if (svc.category === 'cdn') {
      edges.push({ source: 'user', target: nodeId, flowType: 'data' })
      if (hasFrontend) {
        edges.push({ source: nodeId, target: 'frontend', flowType: 'data' })
      }
    } else {
      edges.push({ source: apiNodeId, target: nodeId, flowType })
    }
  }

  return { nodes, edges }
}
