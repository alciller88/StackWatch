import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useStore } from '../../store/useStore';
import type { Service } from '../../types';
import { daysUntil } from '../../utils/dates';
import { getMonthlyAmount } from '../../utils/billing';

function getMonthlyCost(service: Service): number {
  if (!service.billing) return 0;
  return getMonthlyAmount(service.billing);
}

function getYearlyCost(service: Service): number {
  if (!service.billing || !service.billing.amount) return 0;
  if (service.billing.period === 'yearly') return service.billing.amount;
  if (service.billing.period === 'monthly') return service.billing.amount * 12;
  return 0;
}

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

function getBudgetColor(percentage: number, threshold: number): string {
  if (percentage > 100) return '#ef4444';
  if (percentage >= threshold) return '#eab308';
  return '#10b981';
}

function getBudgetBgClass(percentage: number, threshold: number): string {
  if (percentage > 100) return 'bg-red-500';
  if (percentage >= threshold) return 'bg-yellow-500';
  return 'bg-emerald-500';
}

export const CostsPanel: React.FC = () => {
  const { services, config, setBudget } = useStore();

  const budget = config?.budget ?? null;
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState(budget?.monthly?.toString() ?? '');
  const [budgetCurrency, setBudgetCurrency] = useState(budget?.currency ?? 'USD');

  const paidServices = useMemo(
    () => services.filter((s) => s.billing && s.billing.amount && s.billing.amount > 0),
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
      .filter((s) => s.billing?.nextDate)
      .map((s) => ({ service: s, days: daysUntil(s.billing!.nextDate!), billingType: s.billing!.type }))
      .sort((a, b) => a.days - b.days);
  }, [services]);

  const hasCostData = paidServices.length > 0;

  const budgetPercentage = budget ? (totalMonthly / budget.monthly) * 100 : 0;
  const budgetThreshold = budget?.alertThreshold ?? 80;
  const budgetRemaining = budget ? budget.monthly - totalMonthly : 0;
  const budgetColor = budget ? getBudgetColor(budgetPercentage, budgetThreshold) : '#10b981';
  const budgetBgClass = budget ? getBudgetBgClass(budgetPercentage, budgetThreshold) : 'bg-emerald-500';

  const handleSetBudget = () => {
    const amount = parseFloat(budgetAmount);
    if (isNaN(amount) || amount <= 0) return;
    setBudget({ monthly: amount, currency: budgetCurrency, alertThreshold: 80 });
    setBudgetOpen(false);
  };

  const handleClearBudget = () => {
    setBudget(null);
    setBudgetAmount('');
    setBudgetCurrency('USD');
    setBudgetOpen(false);
  };

  if (!hasCostData && renewals.length === 0 && !budget) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <p
            className="font-mono text-[11px] tracking-wide"
            style={{ color: 'var(--color-text-muted)' }}
          >
            No cost data yet -- edit services to add pricing information
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--color-bg-primary)' }}>
      {/* Header */}
      <h2
        className="font-mono text-sm font-medium tracking-widest uppercase mb-6"
        style={{ color: 'var(--color-text-primary)' }}
      >
        Costs Overview
      </h2>

      {/* Summary Cards */}
      <div
        className="grid gap-px mb-6"
        style={{
          background: 'var(--color-border)',
          gridTemplateColumns: budget ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
        }}
      >
        <div className="p-4" style={{ background: 'var(--color-bg-secondary)' }}>
          <div
            className="font-mono text-[10px] uppercase tracking-widest mb-1"
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
            className="font-mono text-[10px] uppercase tracking-widest mb-1"
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
            className="font-mono text-[10px] uppercase tracking-widest mb-1"
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
        {budget && (
          <div
            className="p-4"
            style={{
              background: 'var(--color-bg-secondary)',
              borderLeft: `2px solid ${budgetColor}`,
            }}
          >
            <div
              className="font-mono text-[10px] uppercase tracking-widest mb-1"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {budgetRemaining >= 0 ? 'Remaining' : 'Over Budget'}
            </div>
            <div
              className="font-mono text-lg font-medium"
              style={{ color: budgetColor }}
            >
              {formatCurrency(Math.abs(budgetRemaining), budget.currency)}
            </div>
          </div>
        )}
      </div>

      {/* Budget Progress Bar */}
      {budget && (
        <div
          className="mb-6 p-4"
          style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className="font-mono text-[10px] uppercase tracking-widest"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Budget
            </span>
            <span
              className="font-mono text-[11px]"
              style={{ color: budgetColor }}
            >
              {budgetPercentage > 100
                ? `${formatCurrency(totalMonthly - budget.monthly, budget.currency)} over budget!`
                : `${formatCurrency(totalMonthly, budget.currency)} / ${formatCurrency(budget.monthly, budget.currency)} used (${Math.round(budgetPercentage)}%)`}
            </span>
          </div>
          <div
            className="w-full h-2 rounded-none"
            style={{ background: 'var(--color-border)' }}
          >
            <div
              className={`h-2 rounded-none transition-all ${budgetBgClass}`}
              style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span
              className="font-mono text-[10px]"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {budgetRemaining >= 0
                ? `${formatCurrency(budgetRemaining, budget.currency)} remaining`
                : `${formatCurrency(Math.abs(budgetRemaining), budget.currency)} over budget`}
            </span>
            <span
              className="font-mono text-[10px]"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Alert at {budgetThreshold}%
            </span>
          </div>
        </div>
      )}

      {/* Budget Setup / Edit */}
      {!budget && !budgetOpen && (
        <div className="mb-6">
          <button
            onClick={() => setBudgetOpen(true)}
            className="font-mono text-[11px] tracking-wide cursor-pointer hover:underline"
            style={{ color: 'var(--color-accent)', background: 'none', border: 'none', padding: 0 }}
          >
            Set monthly budget
          </button>
        </div>
      )}

      {budget && !budgetOpen && (
        <div className="mb-6">
          <button
            onClick={() => {
              setBudgetAmount(budget.monthly.toString());
              setBudgetCurrency(budget.currency);
              setBudgetOpen(true);
            }}
            className="font-mono text-[10px] tracking-wide cursor-pointer hover:underline"
            style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', padding: 0 }}
          >
            Edit budget
          </button>
        </div>
      )}

      {budgetOpen && (
        <div
          className="mb-6 p-4"
          style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
        >
          <div
            className="font-mono text-[10px] uppercase tracking-widest mb-3"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Monthly Budget
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="1"
              placeholder="Amount"
              value={budgetAmount}
              onChange={(e) => setBudgetAmount(e.target.value)}
              className="font-mono text-[11px] px-2 py-1.5 rounded-none w-32 outline-none"
              style={{
                background: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
            <input
              type="text"
              placeholder="USD"
              value={budgetCurrency}
              onChange={(e) => setBudgetCurrency(e.target.value.toUpperCase())}
              maxLength={3}
              className="font-mono text-[11px] px-2 py-1.5 rounded-none w-16 uppercase outline-none"
              style={{
                background: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
            <button
              onClick={handleSetBudget}
              className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-none cursor-pointer hover:opacity-80"
              style={{
                background: 'var(--color-accent)',
                color: 'var(--color-bg-primary)',
                border: 'none',
              }}
            >
              Set
            </button>
            {budget && (
              <button
                onClick={handleClearBudget}
                className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-none cursor-pointer hover:opacity-80"
                style={{
                  background: 'transparent',
                  color: '#ef4444',
                  border: '1px solid #ef4444',
                }}
              >
                Clear
              </button>
            )}
            <button
              onClick={() => setBudgetOpen(false)}
              className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-none cursor-pointer hover:opacity-80"
              style={{
                background: 'transparent',
                color: 'var(--color-text-muted)',
                border: '1px solid var(--color-border)',
              }}
            >
              Cancel
            </button>
          </div>
          <div
            className="font-mono text-[10px] mt-2"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Alert threshold: 80% of budget
          </div>
        </div>
      )}

      {/* Cost by Category Chart */}
      {costByCategory.length > 0 && (
        <div className="mb-6">
          <h2
            className="font-mono text-[10px] uppercase tracking-widest mb-3"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Cost by Category
          </h2>
          <div
            className="mb-4"
            style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
          >
            <ResponsiveContainer width="100%" height={costByCategory.length * 32 + 16}>
              <BarChart
                layout="vertical"
                data={costByCategory}
                margin={{ top: 8, right: 48, bottom: 8, left: 8 }}
              >
                <XAxis
                  type="number"
                  tick={{ fill: 'var(--color-text-secondary)', fontFamily: 'IBM Plex Mono', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="category"
                  tick={{ fill: 'var(--color-text-secondary)', fontFamily: 'IBM Plex Mono', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={80}
                />
                <Tooltip
                  cursor={false}
                  contentStyle={{
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border)',
                    fontFamily: 'IBM Plex Mono',
                    fontSize: 10,
                    color: 'var(--color-text-secondary)',
                  }}
                  formatter={(value) => [formatCurrency(Number(value)), 'Monthly']}
                />
                <Bar dataKey="total" radius={0}>
                  {costByCategory.map((row) => (
                    <Cell key={row.category} fill="#e2b04a" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
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
                className="font-mono text-[10px] uppercase tracking-widest"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Category
              </span>
              <span
                className="font-mono text-[10px] uppercase tracking-widest text-right"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Services
              </span>
              <span
                className="font-mono text-[10px] uppercase tracking-widest text-right"
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
      {renewals.length > 0 && (() => {
        const autoRenewals = renewals.filter(r => r.billingType === 'automatic');
        const manualRenewals = renewals.filter(r => r.billingType === 'manual');

        const renderRenewalRow = ({ service, days }: { service: Service; days: number }) => {
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
                    className="font-mono text-[10px] uppercase tracking-widest px-1.5 py-0.5"
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
                  className="font-mono text-[11px]"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {service.billing?.nextDate}
                </span>
                <span
                  className="font-mono text-[11px]"
                  style={{ color: days < 0 ? '#ef4444' : 'var(--color-text-muted)' }}
                >
                  {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}
                </span>
              </div>
            </div>
          );
        };

        return (
          <div className="space-y-4">
            {autoRenewals.length > 0 && (
              <div>
                <h2
                  className="font-mono text-[10px] uppercase tracking-widest mb-3"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Auto-renewing
                </h2>
                <div
                  className="border"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}
                >
                  {autoRenewals.map(renderRenewalRow)}
                </div>
              </div>
            )}
            {manualRenewals.length > 0 && (
              <div>
                <h2
                  className="font-mono text-[10px] uppercase tracking-widest mb-3"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Manual renewals
                </h2>
                <div
                  className="border"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}
                >
                  {manualRenewals.map(renderRenewalRow)}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};
