import type { Service, FlowNode, FlowEdge } from '../types';

export interface HealthBreakdown {
  score: number;
  servicesWithCost: number;
  servicesWithOwner: number;
  servicesReviewed: number;
  graphCompleteness: number;
}

export function calculateHealthScore(
  services: Service[],
  flowNodes: FlowNode[],
  flowEdges: FlowEdge[],
): HealthBreakdown {
  if (services.length === 0) {
    return { score: 0, servicesWithCost: 0, servicesWithOwner: 0, servicesReviewed: 0, graphCompleteness: 0 };
  }

  const servicesWithCost = services.filter(s => s.cost && s.cost.amount >= 0).length / services.length;
  const servicesWithOwner = services.filter(s => s.owner && s.owner.trim()).length / services.length;
  const servicesReviewed = services.filter(s => !s.needsReview).length / services.length;

  // Graph completeness: % of non-user nodes that have at least one edge (source or target)
  const nonUserNodes = flowNodes.filter(n => n.type !== 'user');
  const connectedNodeIds = new Set([
    ...flowEdges.map(e => e.source),
    ...flowEdges.map(e => e.target),
  ]);
  const graphCompleteness = nonUserNodes.length > 0
    ? nonUserNodes.filter(n => connectedNodeIds.has(n.id)).length / nonUserNodes.length
    : 0;

  const score = Math.round(
    servicesWithCost * 30 +
    servicesWithOwner * 25 +
    servicesReviewed * 25 +
    graphCompleteness * 20
  );

  return {
    score,
    servicesWithCost: Math.round(servicesWithCost * 100),
    servicesWithOwner: Math.round(servicesWithOwner * 100),
    servicesReviewed: Math.round(servicesReviewed * 100),
    graphCompleteness: Math.round(graphCompleteness * 100),
  };
}
