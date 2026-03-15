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

  // Filter out services whose name matches the project (defense in depth)
  const normalizedProjectName = projectName.toLowerCase().replace(/[^a-z0-9]/g, '')
  services = services.filter((s) => {
    const normalizedServiceName = s.name.toLowerCase().replace(/[^a-z0-9]/g, '')
    return normalizedServiceName !== normalizedProjectName
  })

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

  // CDN services
  const cdnServices = services.filter((s) => s.category === 'cdn')
  for (const svc of cdnServices) {
    const nodeId = `svc-${svc.id}`
    nodes.push({ id: nodeId, label: svc.name, type: 'cdn', serviceId: svc.id })
    edges.push({ source: 'user', target: nodeId, flowType: 'data' })
    if (hasFrontend) {
      edges.push({ source: nodeId, target: 'frontend', flowType: 'data' })
    }
  }

  // Database services
  const dbServices = services.filter((s) => s.category === 'database')
  for (const svc of dbServices) {
    const nodeId = `svc-${svc.id}`
    nodes.push({
      id: nodeId,
      label: svc.name,
      type: 'database',
      serviceId: svc.id,
    })
    edges.push({ source: apiNodeId, target: nodeId, flowType: 'data' })
  }

  // External services (payments, email, analytics, monitoring, auth, etc.)
  const externalCategories: Service['category'][] = [
    'payments',
    'email',
    'analytics',
    'monitoring',
    'auth',
    'storage',
    'hosting',
    'cicd',
    'infra',
    'ai',
    'messaging',
    'domain',
    'mobile',
    'gaming',
    'data',
    'support',
    'other',
  ]
  const externalServices = services.filter((s) =>
    externalCategories.includes(s.category)
  )
  for (const svc of externalServices) {
    const nodeId = `svc-${svc.id}`
    nodes.push({
      id: nodeId,
      label: svc.name,
      type: 'external',
      serviceId: svc.id,
    })

    let flowType: FlowEdge['flowType'] = 'data'
    if (svc.category === 'payments') flowType = 'payment'
    if (svc.category === 'auth') flowType = 'auth'

    edges.push({ source: apiNodeId, target: nodeId, flowType })
  }

  return { nodes, edges }
}
