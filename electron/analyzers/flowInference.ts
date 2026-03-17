import type { Service, Dependency, FlowNode, FlowEdge } from '../types'

// Categories routed through the frontend virtual node
const FRONTEND_CATEGORIES = new Set<string>([
  'hosting', 'cdn', 'auth', 'analytics', 'support',
])

// Categories routed through the backend virtual node
const BACKEND_CATEGORIES = new Set<string>([
  'database', 'storage', 'payments', 'email', 'monitoring',
  'messaging', 'cicd', 'infra',
])

// Category groups that merge into a single intermediate layer node
const CATEGORY_GROUPS: Record<string, { categories: string[]; label: string }> = {
  auth: { categories: ['auth'], label: 'Auth Layer' },
  data: { categories: ['database', 'storage'], label: 'Data Layer' },
}

function categoryToNodeType(cat: Service['category']): FlowNode['type'] {
  if (cat === 'cdn') return 'cdn'
  if (cat === 'database') return 'database'
  return 'external'
}

function getFlowType(svc: Service): FlowEdge['flowType'] {
  if (svc.category === 'payments') return 'payment'
  if (svc.category === 'auth') return 'auth'
  return 'data'
}

function findGroupKey(category: string): string {
  for (const [key, group] of Object.entries(CATEGORY_GROUPS)) {
    if (group.categories.includes(category)) return key
  }
  return category
}

export function inferFlowGraph(
  services: Service[],
  _dependencies: Dependency[],
  _projectName: string = 'App',
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const nodes: FlowNode[] = []
  const edges: FlowEdge[] = []

  // Layer 1: User node — always present
  nodes.push({ id: 'user', label: 'User', type: 'user' })

  // Classify services by parent
  const frontendServices: Service[] = []
  const backendServices: Service[] = []

  for (const svc of services) {
    if (FRONTEND_CATEGORIES.has(svc.category)) {
      frontendServices.push(svc)
    } else if (BACKEND_CATEGORIES.has(svc.category)) {
      backendServices.push(svc)
    } else {
      // 'other' / uncategorized: with url → backend, else → frontend
      if (svc.url) {
        backendServices.push(svc)
      } else {
        frontendServices.push(svc)
      }
    }
  }

  // Layer 2: Virtual nodes
  const hasHostingOrCdn = services.some(
    (s) => s.category === 'hosting' || s.category === 'cdn',
  )
  const createFrontend = hasHostingOrCdn && frontendServices.length > 0
  const createBackend = backendServices.length > 0

  if (createFrontend) {
    nodes.push({ id: 'frontend', label: 'Frontend', type: 'frontend' })
    edges.push({ source: 'user', target: 'frontend', flowType: 'data' })
  }

  if (createBackend) {
    nodes.push({ id: 'api', label: 'Backend', type: 'api' })
    edges.push({ source: 'user', target: 'api', flowType: 'data' })
    if (createFrontend) {
      edges.push({ source: 'frontend', target: 'api', flowType: 'data' })
    }
  }

  // Parent for each service group
  const frontendParent = createFrontend ? 'frontend' : createBackend ? 'api' : 'user'
  const backendParent = createBackend ? 'api' : 'user'

  // Layer 3 + 4: Group services and create intermediate nodes where needed
  function connectServices(svcs: Service[], parentId: string) {
    const groupMap = new Map<string, Service[]>()

    for (const svc of svcs) {
      const groupKey = findGroupKey(svc.category)
      if (!groupMap.has(groupKey)) groupMap.set(groupKey, [])
      groupMap.get(groupKey)!.push(svc)
    }

    for (const [groupKey, groupSvcs] of groupMap) {
      const groupDef = CATEGORY_GROUPS[groupKey]

      // Create intermediate node only if group is defined AND has 2+ services
      if (groupDef && groupSvcs.length >= 2) {
        const layerId = `layer-${groupKey}`
        nodes.push({ id: layerId, label: groupDef.label, type: 'external' })
        edges.push({ source: parentId, target: layerId, flowType: 'data' })

        for (const svc of groupSvcs) {
          const nodeId = `svc-${svc.id}`
          nodes.push({
            id: nodeId,
            label: svc.name,
            type: categoryToNodeType(svc.category),
            serviceId: svc.id,
          })
          edges.push({ source: layerId, target: nodeId, flowType: getFlowType(svc) })
        }
      } else {
        // Connect directly to parent
        for (const svc of groupSvcs) {
          const nodeId = `svc-${svc.id}`
          nodes.push({
            id: nodeId,
            label: svc.name,
            type: categoryToNodeType(svc.category),
            serviceId: svc.id,
          })
          edges.push({ source: parentId, target: nodeId, flowType: getFlowType(svc) })
        }
      }
    }
  }

  connectServices(frontendServices, frontendParent)
  connectServices(backendServices, backendParent)

  return { nodes, edges }
}
