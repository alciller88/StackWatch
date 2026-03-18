import type { Service, FlowNode, FlowEdge, DepVulnResult, StackCheck, HealthScore } from '../../shared/types';
import { getRenewalThreshold, requiresRenewalTracking, calculateNextDate } from './billing';
import { daysUntil } from './dates';

function getEffectiveNextDate(service: Service): string | undefined {
  if (!service.billing) return undefined;
  return calculateNextDate(service.billing);
}

export function calculateHealthScore(
  services: Service[],
  _flowNodes: FlowNode[],
  _flowEdges: FlowEdge[],
  vulnResults?: DepVulnResult[],
): HealthScore {
  const checks: StackCheck[] = [];

  // --- SECURITY CHECKS ---

  // NO_CRITICAL_VULNS
  if (vulnResults) {
    const criticalCount = vulnResults.reduce(
      (sum, d) => sum + d.vulnerabilities.filter(v => v.severity === 'critical').length, 0,
    );
    checks.push({
      id: 'NO_CRITICAL_VULNS',
      category: 'security',
      status: criticalCount === 0 ? 'pass' : 'fail',
      label: criticalCount === 0 ? 'No critical vulnerabilities' : `${criticalCount} critical vulnerabilit${criticalCount === 1 ? 'y' : 'ies'} found`,
      affectedCount: criticalCount > 0 ? criticalCount : undefined,
      actionPanel: 'dependencies',
    });
  } else {
    checks.push({
      id: 'NO_CRITICAL_VULNS',
      category: 'security',
      status: 'unchecked',
      label: 'Vulnerability scan not run',
      actionLabel: 'Run scan',
      actionPanel: 'dependencies',
    });
  }

  // NO_HIGH_VULNS
  if (vulnResults) {
    const highCount = vulnResults.reduce(
      (sum, d) => sum + d.vulnerabilities.filter(v => v.severity === 'high').length, 0,
    );
    checks.push({
      id: 'NO_HIGH_VULNS',
      category: 'security',
      status: highCount === 0 ? 'pass' : 'fail',
      label: highCount === 0 ? 'No high-severity vulnerabilities' : `${highCount} high-severity vulnerabilit${highCount === 1 ? 'y' : 'ies'} found`,
      affectedCount: highCount > 0 ? highCount : undefined,
      actionPanel: 'dependencies',
    });
  } else {
    checks.push({
      id: 'NO_HIGH_VULNS',
      category: 'security',
      status: 'unchecked',
      label: 'Vulnerability scan not run',
      actionLabel: 'Run scan',
      actionPanel: 'dependencies',
    });
  }

  // NO_ZOMBIE_SERVICES
  const hasZombieData = services.some(s => s.zombieStatus !== undefined);
  if (hasZombieData) {
    const zombieCount = services.filter(s => s.zombieStatus === 'zombie').length;
    checks.push({
      id: 'NO_ZOMBIE_SERVICES',
      category: 'security',
      status: zombieCount === 0 ? 'pass' : 'fail',
      label: zombieCount === 0 ? 'No zombie services' : `${zombieCount} zombie service${zombieCount === 1 ? '' : 's'} detected`,
      affectedCount: zombieCount > 0 ? zombieCount : undefined,
      actionPanel: 'services',
    });
  } else {
    checks.push({
      id: 'NO_ZOMBIE_SERVICES',
      category: 'security',
      status: 'unchecked',
      label: 'Zombie detection not available',
      actionPanel: 'services',
    });
  }

  // Renewal checks — gather services with active renewal tracking
  const renewalServices = services.filter(s => {
    if (!s.billing) return false;
    return requiresRenewalTracking(s.billing);
  });

  // NO_OVERDUE_RENEWALS
  if (renewalServices.length > 0) {
    const overdueCount = renewalServices.filter(s => {
      const nextDate = getEffectiveNextDate(s);
      if (!nextDate) return false;
      return daysUntil(nextDate) < 0;
    }).length;
    checks.push({
      id: 'NO_OVERDUE_RENEWALS',
      category: 'security',
      status: overdueCount === 0 ? 'pass' : 'fail',
      label: overdueCount === 0 ? 'No overdue renewals' : `${overdueCount} renewal${overdueCount === 1 ? '' : 's'} overdue`,
      affectedCount: overdueCount > 0 ? overdueCount : undefined,
      actionPanel: 'costs',
      actionLabel: overdueCount > 0 ? 'Mark as renewed' : undefined,
    });
  } else {
    checks.push({
      id: 'NO_OVERDUE_RENEWALS',
      category: 'security',
      status: 'unchecked',
      label: 'No services with manual renewal tracking',
      actionPanel: 'costs',
    });
  }

  // NO_UPCOMING_RENEWALS
  if (renewalServices.length > 0) {
    const upcomingCount = renewalServices.filter(s => {
      const nextDate = getEffectiveNextDate(s);
      if (!nextDate) return false;
      const days = daysUntil(nextDate);
      if (days < 0) return false; // already overdue, handled above
      const threshold = getRenewalThreshold(s.billing!);
      return threshold !== undefined && days <= threshold;
    }).length;
    checks.push({
      id: 'NO_UPCOMING_RENEWALS',
      category: 'security',
      status: upcomingCount === 0 ? 'pass' : 'fail',
      label: upcomingCount === 0 ? 'No upcoming renewals within threshold' : `${upcomingCount} renewal${upcomingCount === 1 ? '' : 's'} coming up soon`,
      affectedCount: upcomingCount > 0 ? upcomingCount : undefined,
      actionPanel: 'costs',
    });
  } else {
    checks.push({
      id: 'NO_UPCOMING_RENEWALS',
      category: 'security',
      status: 'unchecked',
      label: 'No services with manual renewal tracking',
      actionPanel: 'costs',
    });
  }

  // --- COMPLETENESS CHECKS ---

  const paidServices = services.filter(s => s.plan === 'paid' || s.plan === 'trial');

  // ALL_PAID_HAVE_OWNER
  if (paidServices.length > 0) {
    const missingOwner = paidServices.filter(s => !s.owner?.trim()).length;
    checks.push({
      id: 'ALL_PAID_HAVE_OWNER',
      category: 'completeness',
      status: missingOwner === 0 ? 'pass' : 'fail',
      label: missingOwner === 0 ? 'All paid services have an owner' : `${missingOwner} paid service${missingOwner === 1 ? '' : 's'} missing owner`,
      affectedCount: missingOwner > 0 ? missingOwner : undefined,
      actionPanel: 'services',
      actionFilter: missingOwner > 0 ? { missingField: 'owner' } : undefined,
    });
  } else {
    checks.push({
      id: 'ALL_PAID_HAVE_OWNER',
      category: 'completeness',
      status: 'unchecked',
      label: 'No paid/trial services to check',
      actionPanel: 'services',
    });
  }

  // ALL_PAID_HAVE_BILLING
  if (paidServices.length > 0) {
    const missingBilling = paidServices.filter(s => !s.billing?.amount || s.billing.amount <= 0).length;
    checks.push({
      id: 'ALL_PAID_HAVE_BILLING',
      category: 'completeness',
      status: missingBilling === 0 ? 'pass' : 'fail',
      label: missingBilling === 0 ? 'All paid services have billing info' : `${missingBilling} paid service${missingBilling === 1 ? '' : 's'} missing cost info`,
      affectedCount: missingBilling > 0 ? missingBilling : undefined,
      actionPanel: 'services',
      actionFilter: missingBilling > 0 ? { missingField: 'billing' } : undefined,
    });
  } else {
    checks.push({
      id: 'ALL_PAID_HAVE_BILLING',
      category: 'completeness',
      status: 'unchecked',
      label: 'No paid/trial services to check',
      actionPanel: 'services',
    });
  }

  // ALL_PAID_HAVE_RENEWAL
  const paidWithRecurring = paidServices.filter(s => {
    if (!s.billing) return true; // no billing at all = needs renewal info
    if (s.billing.type === 'free') return false;
    if (s.billing.period === 'usage-based' || s.billing.period === 'one-time') return false;
    return true;
  });
  if (paidWithRecurring.length > 0) {
    const missingRenewal = paidWithRecurring.filter(s => {
      const nextDate = getEffectiveNextDate(s);
      return !nextDate;
    }).length;
    checks.push({
      id: 'ALL_PAID_HAVE_RENEWAL',
      category: 'completeness',
      status: missingRenewal === 0 ? 'pass' : 'fail',
      label: missingRenewal === 0 ? 'All recurring services have renewal dates' : `${missingRenewal} service${missingRenewal === 1 ? '' : 's'} missing renewal date`,
      affectedCount: missingRenewal > 0 ? missingRenewal : undefined,
      actionPanel: 'costs',
      actionFilter: missingRenewal > 0 ? { missingField: 'renewal' } : undefined,
    });
  } else {
    checks.push({
      id: 'ALL_PAID_HAVE_RENEWAL',
      category: 'completeness',
      status: 'unchecked',
      label: 'No recurring paid services to check',
      actionPanel: 'costs',
    });
  }

  // --- SCORE CALCULATION ---
  const applicable = checks.filter(c => c.status !== 'unchecked');
  const passing = applicable.filter(c => c.status === 'pass');
  const score = applicable.length === 0
    ? 0
    : Math.round((passing.length / applicable.length) * 100);

  return {
    score,
    totalChecks: applicable.length,
    passingChecks: passing.length,
    checks,
  };
}
