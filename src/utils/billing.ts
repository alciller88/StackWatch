import type { ServiceBilling } from '../../shared/types';

/**
 * Calculate the next billing/renewal date based on billing config.
 */
export function calculateNextDate(billing: ServiceBilling): string | undefined {
  if (billing.type === 'free') return undefined;
  if (billing.period === 'one-time') return undefined;
  if (billing.period === 'usage-based') return undefined;

  if (billing.lastRenewed) {
    const last = new Date(billing.lastRenewed);
    if (billing.period === 'monthly') {
      last.setMonth(last.getMonth() + 1);
    } else if (billing.period === 'yearly') {
      last.setFullYear(last.getFullYear() + 1);
    } else {
      return undefined;
    }
    return last.toISOString().split('T')[0];
  }

  if (billing.nextDate) return billing.nextDate;

  return undefined;
}

/**
 * Mark a service as renewed today and recalculate nextDate.
 */
export function renewService(billing: ServiceBilling): ServiceBilling {
  const today = new Date().toISOString().split('T')[0];
  const updated: ServiceBilling = {
    ...billing,
    lastRenewed: today,
  };
  updated.nextDate = calculateNextDate(updated);
  return updated;
}

/**
 * Get the renewal check threshold in days based on billing type/period.
 * Returns undefined if this billing type does not apply to renewal checks.
 */
export function getRenewalThreshold(billing: ServiceBilling): number | undefined {
  if (billing.type === 'free') return undefined;
  if (billing.period === 'one-time') return undefined;
  if (billing.period === 'usage-based') return undefined;
  if (billing.type === 'automatic' && billing.period === 'monthly') return undefined;

  if (billing.type === 'automatic' && billing.period === 'yearly') return 60;
  if (billing.type === 'manual' && billing.period === 'monthly') return 7;
  if (billing.type === 'manual' && billing.period === 'yearly') return 30;

  return undefined;
}

/**
 * Check if a billing config requires renewal tracking (applies to renewal checks).
 */
export function requiresRenewalTracking(billing: ServiceBilling): boolean {
  return getRenewalThreshold(billing) !== undefined;
}

/**
 * Get the effective monthly cost from billing config.
 */
export function getMonthlyAmount(billing: ServiceBilling): number {
  if (!billing.amount) return 0;
  if (billing.period === 'yearly') return billing.amount / 12;
  if (billing.period === 'monthly') return billing.amount;
  return 0;
}
