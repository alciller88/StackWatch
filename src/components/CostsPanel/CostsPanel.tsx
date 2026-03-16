import React, { useMemo } from 'react';
import { useStore } from '../../store/useStore';
import type { Service } from '../../types';

function getMonthlyCost(service: Service): number {
  if (!service.cost) return 0;
  if (service.cost.period === 'monthly') return service.cost.amount;
  if (service.cost.period === 'yearly') return service.cost.amount / 12;
  return 0;
}

function getYearlyCost(service: Service): number {
  if (!service.cost) return 0;
  if (service.cost.period === 'yearly') return service.cost.amount;
  if (service.cost.period === 'monthly') return service.cost.amount * 12;
  return 0;
}

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.floor((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export const CostsPanel: React.FC = () => {
  const { services } = useStore();

  const paidServices = useMemo(
    () => services.filter((s) => s.cost && s.cost.amount > 0),
    [services],
  );

  const totalMonthly = useMemo(
    () => paidServices.reduce((sum, s) => sum + getMonthlyCost(s), 0),
    [paidServices],
  );

  const totalYearly = useMemo(
    () => paidServices.reduce((sum, s) => sum + getYearlyCost(s), 0),
    [paidServices],
  );

  const costByCategory = useMemo(() => {
    const map: Record<string, { category: string; total: number; count: number }> = {};
    for (const s of paidServices) {
      if (!map[s.category]) {
        map[s.category] = { category: s.category, total: 0, count: 0 };
      }
      map[s.category].total += getMonthlyCost(s);
      map[s.category].count += 1;
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [paidServices]);

  const renewals = useMemo(() => {
    return services
      .filter((s) => s.renewalDate)
      .map((s) => ({ service: s, days: daysUntil(s.renewalDate!) }))
      .sort((a, b) => a.days - b.days);
  }, [services]);

  const hasCostData = paidServices.length > 0;

  if (!hasCostData && renewals.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <p
            className="font-mono text-[11px] tracking-wide"
            style={{ color: 'var(--color-text-muted)' }}
          >
            No cost data yet — edit services to add pricing information
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--color-bg-primary)' }}>
      {/* Header */}
      <h1
        className="font-mono text-xs font-medium tracking-widest uppercase mb-6"
        style={{ color: 'var(--color-text-primary)' }}
      >
        Costs Overview
      </h1>

      {/* Summary Cards */}
      <div
        className="grid grid-cols-3 gap-px mb-6"
        style={{ background: 'var(--color-border)' }}
      >
        <div className="p-4" style={{ background: 'var(--color-bg-secondary)' }}>
          <div
            className="font-mono text-[9px] uppercase tracking-widest mb-1"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Monthly
          </div>
          <div
            className="font-mono text-lg font-medium"
            style={{ color: 'var(--color-accent)' }}
          >
            {formatCurrency(totalMonthly)}
          </div>
        </div>
        <div className="p-4" style={{ background: 'var(--color-bg-secondary)' }}>
          <div
            className="font-mono text-[9px] uppercase tracking-widest mb-1"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Yearly
          </div>
          <div
            className="font-mono text-lg font-medium"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {formatCurrency(totalYearly)}
          </div>
        </div>
        <div className="p-4" style={{ background: 'var(--color-bg-secondary)' }}>
          <div
            className="font-mono text-[9px] uppercase tracking-widest mb-1"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Paid Services
          </div>
          <div
            className="font-mono text-lg font-medium"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {paidServices.length}
          </div>
        </div>
      </div>

      {/* Cost by Category */}
      {costByCategory.length > 0 && (
        <div className="mb-6">
          <h2
            className="font-mono text-[9px] uppercase tracking-widest mb-3"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Cost by Category
          </h2>
          <div
            className="border"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}
          >
            {/* Table header */}
            <div
              className="grid grid-cols-3 px-4 py-2 border-b"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <span
                className="font-mono text-[9px] uppercase tracking-widest"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Category
              </span>
              <span
                className="font-mono text-[9px] uppercase tracking-widest text-right"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Services
              </span>
              <span
                className="font-mono text-[9px] uppercase tracking-widest text-right"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Monthly
              </span>
            </div>
            {/* Table rows */}
            {costByCategory.map((row) => (
              <div
                key={row.category}
                className="grid grid-cols-3 px-4 py-2 border-b last:border-b-0"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <span
                  className="font-mono text-[11px] uppercase"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {row.category}
                </span>
                <span
                  className="font-mono text-[11px] text-right"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {row.count}
                </span>
                <span
                  className="font-mono text-[11px] text-right"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {formatCurrency(row.total)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Renewal Alerts */}
      {renewals.length > 0 && (
        <div>
          <h2
            className="font-mono text-[9px] uppercase tracking-widest mb-3"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Renewal Alerts
          </h2>
          <div
            className="border"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}
          >
            {renewals.map(({ service, days }) => {
              let badge: { text: string; color: string } | null = null;
              if (days < 0) {
                badge = { text: 'OVERDUE', color: '#ef4444' };
              } else if (days < 7) {
                badge = { text: 'URGENT', color: '#ef4444' };
              } else if (days < 30) {
                badge = { text: 'SOON', color: '#eab308' };
              }

              return (
                <div
                  key={service.id}
                  className="flex items-center justify-between px-4 py-2 border-b last:border-b-0"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="font-mono text-[11px]"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {service.name}
                    </span>
                    {badge && (
                      <span
                        className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5"
                        style={{
                          color: badge.color,
                          border: `1px solid ${badge.color}`,
                        }}
                      >
                        {badge.text}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className="font-mono text-[10px]"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {service.renewalDate}
                    </span>
                    <span
                      className="font-mono text-[10px]"
                      style={{ color: days < 0 ? '#ef4444' : 'var(--color-text-muted)' }}
                    >
                      {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
