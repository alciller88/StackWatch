import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import { useDialogStore } from '../../store/dialogStore';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ServiceCard } from './ServiceCard';
import { SERVICE_CATEGORIES } from '../../types';
import type { Service, ServiceCategory, ServiceContext, ServiceBilling } from '../../types';
import { renewService } from '../../utils/billing';

const categories = SERVICE_CATEGORIES;

const planTypes: Service['plan'][] = ['free', 'paid', 'trial', 'unknown'];

export const ServicesPanel: React.FC = () => {
  const { services, deepAnalysis, repoPath } = useStore();

  // Build context map from deep analysis
  const contextMap = useMemo(() => {
    const map = new Map<string, ServiceContext>();
    if (deepAnalysis?.serviceContexts) {
      for (const ctx of deepAnalysis.serviceContexts) {
        map.set(ctx.serviceId, ctx);
      }
    }
    return map;
  }, [deepAnalysis]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<ServiceCategory | 'all'>('all');
  const [activePlan, setActivePlan] = useState<Service['plan'] | 'all'>('all');
  const [activeActivity, setActiveActivity] = useState<'all' | 'active' | 'stale' | 'zombie'>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const needsReview = useMemo(() => {
    return services.filter(s => s.needsReview || s.confidence === 'low');
  }, [services]);

  const zombieCounts = useMemo(() => {
    const zombie = services.filter(s => s.zombieStatus === 'zombie').length;
    const stale = services.filter(s => s.zombieStatus === 'stale').length;
    const hasAny = zombie > 0 || stale > 0;
    return { zombie, stale, hasAny };
  }, [services]);

  const filtered = useMemo(() => {
    return services.filter((s) => {
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (activeCategory !== 'all' && s.category !== activeCategory) {
        return false;
      }
      if (activePlan !== 'all' && s.plan !== activePlan) {
        return false;
      }
      if (activeActivity !== 'all') {
        const status = s.zombieStatus ?? 'active';
        if (activeActivity !== status) return false;
      }
      return true;
    });
  }, [services, search, activeCategory, activePlan, activeActivity]);

  const handleEdit = useCallback((service: Service) => {
    setEditingService(service);
    setShowAddForm(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setShowAddForm(false);
    setEditingService(null);
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-6 py-4 border-b space-y-3" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between">
          <h2 className="font-mono uppercase tracking-widest text-sm font-medium text-[var(--color-text-primary)]">
            Services
            <span className="ml-2 font-mono text-[11px] text-[var(--color-text-muted)] font-normal">
              ({filtered.length})
            </span>
          </h2>
          <button
            onClick={() => { setEditingService(null); setShowAddForm(!showAddForm); }}
            className="px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest bg-transparent border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)] rounded-none transition-colors"
          >
            + Add Service
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search services..."
            aria-label="Search services"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border rounded-sm pl-10 pr-4 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
            style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}
          />
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
          <button
            onClick={() => setActiveCategory('all')}
            aria-pressed={activeCategory === 'all'}
            className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest rounded-sm transition-colors ${
              activeCategory === 'all'
                ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
                : 'bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              aria-pressed={activeCategory === cat}
              className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest rounded-sm capitalize transition-colors ${
                activeCategory === cat
                  ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
                  : 'bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Plan filters */}
        <div className="flex gap-1.5">
          <button
            onClick={() => setActivePlan('all')}
            className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest rounded-sm transition-colors ${
              activePlan === 'all'
                ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
                : 'bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'
            }`}
          >
            All Plans
          </button>
          {planTypes.map((plan) => (
            <button
              key={plan}
              onClick={() => setActivePlan(plan)}
              className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest rounded-sm capitalize transition-colors ${
                activePlan === plan
                  ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
                  : 'bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'
              }`}
            >
              {plan}
            </button>
          ))}
        </div>

        {/* Activity status filter — only if any services have zombie/stale status */}
        {zombieCounts.hasAny ? (
          <div className="flex gap-1.5">
            {(['all', 'active', 'stale', 'zombie'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setActiveActivity(status)}
                className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest rounded-sm capitalize transition-colors ${
                  activeActivity === status
                    ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
                    : 'bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'
                }`}
              >
                {status === 'all' ? 'All Activity' : status}
              </button>
            ))}
          </div>
        ) : repoPath?.startsWith('github:') && services.length > 0 ? (
          <div className="font-mono text-[10px] text-[var(--color-text-muted)] flex items-center gap-1.5">
            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Zombie detection not available for remote repos — clone locally to enable
          </div>
        ) : null}
      </div>

      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        Showing {filtered.length} of {services.length} services
      </span>

      {/* Add/Edit Service Form */}
      {showAddForm && (
        <ServiceForm
          editingService={editingService}
          onClose={handleCloseForm}
        />
      )}

      {/* Content */}
      <VirtualizedServiceGrid
        filtered={filtered}
        services={services}
        repoPath={repoPath}
        contextMap={contextMap}
        needsReview={needsReview}
        zombieCounts={zombieCounts}
        search={search}
        activeCategory={activeCategory}
        activePlan={activePlan}
        activeActivity={activeActivity}
        onEdit={handleEdit}
        onShowAddForm={() => { setEditingService(null); setShowAddForm(true); }}
      />
    </div>
  );
};

/** Virtualized service grid — only renders visible rows */
const CARD_HEIGHT = 140;
const CARD_GAP = 16;
const COLS_BY_WIDTH = { xl: 4, lg: 3, md: 2, sm: 1 };

const VirtualizedServiceGrid: React.FC<{
  filtered: Service[];
  services: Service[];
  repoPath: string | null;
  contextMap: Map<string, ServiceContext>;
  needsReview: Service[];
  zombieCounts: { zombie: number; stale: number; hasAny: boolean };
  search: string;
  activeCategory: ServiceCategory | 'all';
  activePlan: Service['plan'] | 'all';
  activeActivity: string;
  onEdit: (service: Service) => void;
  onShowAddForm: () => void;
}> = ({ filtered, services, repoPath, contextMap, needsReview, zombieCounts, search, activeCategory, activePlan, activeActivity, onEdit, onShowAddForm }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Use 4 columns as default — responsive would require ResizeObserver
  const cols = 4;
  const rowCount = Math.ceil(filtered.length / cols);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => CARD_HEIGHT + CARD_GAP,
    overscan: 3,
  });

  // Banner sections above the grid
  const showZombieBanner = zombieCounts.hasAny && !search && activeCategory === 'all' && activePlan === 'all' && activeActivity === 'all';
  const showReviewSection = needsReview.length > 0 && !search && activeCategory === 'all' && activePlan === 'all';

  return (
    <div ref={scrollRef} className="flex-1 overflow-auto p-6">
      <div className="space-y-6">
        {/* Zombie summary banner */}
        {showZombieBanner && (
          <div className="bg-[var(--color-badge-bg-danger)] border border-[var(--color-badge-border-danger)] rounded-sm px-4 py-2.5 flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--color-danger)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="font-mono text-[11px] text-[var(--color-text-secondary)]">
              {zombieCounts.zombie > 0 && <span className="text-[var(--color-danger)]">{zombieCounts.zombie} zombie service{zombieCounts.zombie !== 1 ? 's' : ''}</span>}
              {zombieCounts.zombie > 0 && zombieCounts.stale > 0 && ', '}
              {zombieCounts.stale > 0 && <span className="text-[var(--color-warning)]">{zombieCounts.stale} stale service{zombieCounts.stale !== 1 ? 's' : ''}</span>}
              <span className="text-[var(--color-text-muted)]"> detected</span>
            </span>
          </div>
        )}

        {/* Needs Review Section */}
        {showReviewSection && (
          <div className="bg-[var(--color-badge-bg-warning)] border border-[var(--color-badge-border-warning)] rounded-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[var(--color-accent)]">&#9888;</span>
                <span className="text-[var(--color-accent)] text-sm font-medium">
                  {needsReview.length} service{needsReview.length !== 1 ? 's' : ''} need{needsReview.length === 1 ? 's' : ''} review
                </span>
              </div>
              <span className="text-xs text-[var(--color-accent)] opacity-60">
                These were detected with low confidence. Add details to confirm them.
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {needsReview.map((service) => (
                <ServiceCard key={service.id} service={service} context={contextMap.get(service.id)} onEdit={onEdit} />
              ))}
            </div>
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[var(--color-badge-border-warning)]/30">
              <button onClick={onShowAddForm} className="text-xs text-[var(--color-accent)] hover:opacity-80 transition-colors">
                Complete in form &rarr;
              </button>
              <span className="text-xs text-[var(--color-text-muted)]">or</span>
              <span className="text-xs text-[var(--color-text-muted)]">Edit stackwatch.config.json directly</span>
            </div>
          </div>
        )}

        {/* Virtualized Grid */}
        {filtered.length === 0 ? (
          services.length === 0 && repoPath ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-8">
              <svg className="w-12 h-12 text-[var(--color-text-muted)] opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <div>
                <p className="font-mono text-sm text-[var(--color-text-secondary)] uppercase tracking-widest mb-2">No services detected</p>
                <p className="font-mono text-[11px] text-[var(--color-text-muted)] max-w-md leading-relaxed">
                  This could mean the project uses only local dependencies, or services are configured in ways StackWatch doesn't recognize yet.
                </p>
              </div>
              <button onClick={onShowAddForm} className="mt-2 px-4 py-2 font-mono text-[11px] uppercase tracking-widest bg-transparent border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)] rounded-none transition-colors">
                + Add service manually
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-[var(--color-text-muted)] text-sm">
              {services.length === 0 ? 'No services detected. Analyze a repository to get started.' : 'No services match your filters.'}
            </div>
          )
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const startIdx = virtualRow.index * cols;
              const rowServices = filtered.slice(startIdx, startIdx + cols);
              return (
                <div
                  key={virtualRow.key}
                  style={{
                    position: 'absolute',
                    top: virtualRow.start,
                    left: 0,
                    width: '100%',
                    height: virtualRow.size,
                  }}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {rowServices.map((service) => (
                      <ServiceCard key={service.id} service={service} context={contextMap.get(service.id)} onEdit={onEdit} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/** Service form — add or edit */
const ServiceForm: React.FC<{
  editingService: Service | null;
  onClose: () => void;
}> = ({ editingService, onClose }) => {
  const { addManualService, updateManualService, deleteManualService } = useStore();
  const isEditing = editingService !== null;

  const [name, setName] = useState(editingService?.name ?? '');
  const [category, setCategory] = useState<ServiceCategory>(editingService?.category ?? 'other');
  const [plan, setPlan] = useState<Service['plan']>(editingService?.plan ?? 'unknown');
  const [url, setUrl] = useState(editingService?.url ?? '');
  const [billingType, setBillingType] = useState<ServiceBilling['type']>(editingService?.billing?.type ?? 'manual');
  const [billingPeriod, setBillingPeriod] = useState<NonNullable<ServiceBilling['period']>>(editingService?.billing?.period ?? 'monthly');
  const [billingAmount, setBillingAmount] = useState(editingService?.billing?.amount?.toString() ?? '');
  const [billingCurrency, setBillingCurrency] = useState(editingService?.billing?.currency ?? 'USD');
  const [billingNextDate, setBillingNextDate] = useState(editingService?.billing?.nextDate ?? '');
  const [billingLastRenewed, setBillingLastRenewed] = useState(editingService?.billing?.lastRenewed ?? '');
  const [accountEmail, setAccountEmail] = useState(editingService?.accountEmail ?? '');
  const [notes, setNotes] = useState(editingService?.notes ?? '');
  const [confidence, setConfidence] = useState<NonNullable<Service['confidence']>>(editingService?.confidence ?? 'high');
  const [owner, setOwner] = useState(editingService?.owner ?? '');
  const [comment, setComment] = useState(editingService?.comment ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validateForm(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (billingAmount && parseFloat(billingAmount) < 0) errs.cost = 'Cost cannot be negative';
    if (url && url.trim()) {
      try { new URL(url); } catch { errs.url = 'Invalid URL format'; }
    }
    if (accountEmail && accountEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountEmail)) {
      errs.email = 'Invalid email format';
    }
    return errs;
  }

  const handleSubmit = async () => {
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const service: Service = {
      id: editingService?.id ?? name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
      name: name.trim(),
      category,
      plan,
      source: editingService?.source ?? 'manual',
      confidence,
      ...(url && { url }),
      ...(billingType && {
        billing: {
          type: billingType,
          ...(billingType !== 'free' && { period: billingPeriod }),
          ...(billingType !== 'free' && billingAmount && { amount: parseFloat(billingAmount) }),
          ...(billingType !== 'free' && { currency: billingCurrency }),
          ...(billingNextDate && { nextDate: billingNextDate }),
          ...(billingLastRenewed && { lastRenewed: billingLastRenewed }),
        } as ServiceBilling,
      }),
      ...(accountEmail && { accountEmail }),
      ...(notes && { notes }),
      ...(owner && { owner }),
      ...(comment && { comment }),
    };

    if (isEditing) {
      await updateManualService(service);
    } else {
      await addManualService(service);
    }
    onClose();
  };

  const handleDelete = async () => {
    if (!editingService) return;
    const confirmed = await useDialogStore.getState().confirm({
      title: 'Delete service',
      message: `Delete "${name}"?`,
      detail: 'This action cannot be undone.',
      buttons: [
        { label: 'Delete', value: 'delete', danger: true },
        { label: 'Cancel', value: 'cancel' },
      ],
    });
    if (confirmed !== 'delete') return;
    await deleteManualService(editingService.id);
    onClose();
  };

  const inputClass = "w-full rounded-sm px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]";
  const inputStyle = { background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' };

  return (
    <div className="px-6 py-4 border-b space-y-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-primary)' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
          {isEditing ? 'Edit Service' : 'Add Service'}
        </span>
        {isEditing && (
          <button
            onClick={handleDelete}
            className="text-xs text-[var(--color-danger)] hover:opacity-80 transition-colors"
          >
            Delete
          </button>
        )}
      </div>

      {/* Row 1: Name, Category, Plan, Confidence */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[160px]">
          <label htmlFor="sf-name" className="block font-mono text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Name *</label>
          <input
            type="text"
            id="sf-name"
            value={name}
            onChange={(e) => { setName(e.target.value); setErrors(prev => { const next = {...prev}; delete next.name; return next; }); }}
            placeholder="Service name"
            className={`${inputClass} border ${errors.name ? 'border-red-500' : ''}`}
            style={errors.name ? { ...inputStyle, borderColor: undefined } : inputStyle}
          />
          {errors.name && <p className="text-red-500 text-[11px] mt-1">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="sf-category" className="block font-mono text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Category *</label>
          <select
            id="sf-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ServiceCategory)}
            className={`${inputClass} border`}
            style={inputStyle}
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sf-plan" className="block font-mono text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Plan *</label>
          <select
            id="sf-plan"
            value={plan}
            onChange={(e) => setPlan(e.target.value as Service['plan'])}
            className={`${inputClass} border`}
            style={inputStyle}
          >
            {planTypes.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sf-confidence" className="block font-mono text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Confidence</label>
          <select
            id="sf-confidence"
            value={confidence}
            onChange={e => setConfidence(e.target.value as NonNullable<Service['confidence']>)}
            className={`${inputClass} border`}
            style={inputStyle}
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Row 2: URL, Billing */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label htmlFor="sf-url" className="block font-mono text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">URL</label>
          <input
            type="text"
            id="sf-url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setErrors(prev => { const next = {...prev}; delete next.url; return next; }); }}
            placeholder="https://..."
            className={`${inputClass} border ${errors.url ? 'border-red-500' : ''}`}
            style={errors.url ? { ...inputStyle, borderColor: undefined } : inputStyle}
          />
          {errors.url && <p className="text-red-500 text-[11px] mt-1">{errors.url}</p>}
        </div>
        <div className="w-24">
          <label htmlFor="sf-billing-type" className="block font-mono text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Billing Type</label>
          <select
            id="sf-billing-type"
            value={billingType}
            onChange={(e) => setBillingType(e.target.value as ServiceBilling['type'])}
            className={`${inputClass} border`}
            style={inputStyle}
          >
            <option value="manual">Manual</option>
            <option value="automatic">Automatic</option>
            <option value="free">Free</option>
          </select>
        </div>
        {billingType !== 'free' && (
          <>
            <div className="w-24">
              <label htmlFor="sf-billing-period" className="block font-mono text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Period</label>
              <select
                id="sf-billing-period"
                value={billingPeriod}
                onChange={(e) => setBillingPeriod(e.target.value as NonNullable<ServiceBilling['period']>)}
                className="rounded-sm px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] border"
                style={inputStyle}
              >
                <option value="monthly">/mo</option>
                <option value="yearly">/yr</option>
                <option value="one-time">One-time</option>
                <option value="usage-based">Usage</option>
              </select>
            </div>
            <div className="w-20">
              <label htmlFor="sf-billing-amount" className="block font-mono text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Amount</label>
              <input
                type="number"
                id="sf-billing-amount"
                value={billingAmount}
                onChange={(e) => { setBillingAmount(e.target.value); setErrors(prev => { const next = {...prev}; delete next.cost; return next; }); }}
                placeholder="0"
                min="0"
                step="0.01"
                className={`${inputClass} border ${errors.cost ? 'border-red-500' : ''}`}
                style={errors.cost ? { ...inputStyle, borderColor: undefined } : inputStyle}
              />
              {errors.cost && <p className="text-red-500 text-[11px] mt-1">{errors.cost}</p>}
            </div>
            <div className="w-16">
              <label htmlFor="sf-billing-currency" className="block font-mono text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Currency</label>
              <select
                id="sf-billing-currency"
                value={billingCurrency}
                onChange={(e) => setBillingCurrency(e.target.value)}
                className="rounded-sm px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] border"
                style={inputStyle}
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </>
        )}
      </div>

      {/* Row 2b: Billing dates + renew action */}
      {billingType === 'free' && (
        <div className="font-mono text-[11px] text-[var(--color-success)] px-1">
          Free plan — no billing needed
        </div>
      )}
      {billingType !== 'free' && billingPeriod === 'usage-based' && (
        <div className="font-mono text-[11px] text-[var(--color-text-muted)] px-1">
          Cost varies by usage
        </div>
      )}
      {billingType !== 'free' && billingPeriod !== 'usage-based' && billingPeriod !== 'one-time' && (
        <div className="flex items-end gap-3">
          <div>
            <label htmlFor="sf-next-date" className="block font-mono text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Next Renewal</label>
            <input
              type="date"
              id="sf-next-date"
              value={billingNextDate}
              onChange={(e) => setBillingNextDate(e.target.value)}
              className={`${inputClass} border`}
              style={inputStyle}
            />
          </div>
          {billingType === 'manual' && (
            <>
              <div>
                <label htmlFor="sf-last-renewed" className="block font-mono text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Last Renewed</label>
                <input
                  type="date"
                  id="sf-last-renewed"
                  value={billingLastRenewed}
                  onChange={(e) => setBillingLastRenewed(e.target.value)}
                  className={`${inputClass} border`}
                  style={inputStyle}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const updated = renewService({
                    type: billingType,
                    period: billingPeriod,
                    amount: billingAmount ? parseFloat(billingAmount) : undefined,
                    currency: billingCurrency,
                    nextDate: billingNextDate || undefined,
                    lastRenewed: billingLastRenewed || undefined,
                  });
                  setBillingLastRenewed(updated.lastRenewed ?? '');
                  setBillingNextDate(updated.nextDate ?? '');
                }}
                className="px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest bg-transparent border border-[var(--color-success)] text-[var(--color-success)] hover:bg-[var(--color-success)] hover:text-[var(--color-bg-primary)] rounded-none transition-colors whitespace-nowrap"
              >
                Mark as renewed today
              </button>
            </>
          )}
        </div>
      )}

      {/* Row 3: Email, Notes, Actions */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label htmlFor="sf-email" className="block font-mono text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Account Email</label>
          <input
            type="email"
            id="sf-email"
            value={accountEmail}
            onChange={(e) => { setAccountEmail(e.target.value); setErrors(prev => { const next = {...prev}; delete next.email; return next; }); }}
            placeholder="admin@example.com"
            className={`${inputClass} border ${errors.email ? 'border-red-500' : ''}`}
            style={errors.email ? { ...inputStyle, borderColor: undefined } : inputStyle}
          />
          {errors.email && <p className="text-red-500 text-[11px] mt-1">{errors.email}</p>}
        </div>
        <div className="flex-1">
          <label htmlFor="sf-notes" className="block font-mono text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Notes</label>
          <input
            type="text"
            id="sf-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional details..."
            className={`${inputClass} border`}
            style={inputStyle}
          />
        </div>
        <div className="flex-1">
          <label htmlFor="sf-owner" className="block font-mono text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Owner</label>
          <input
            type="text"
            id="sf-owner"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="Team or person responsible"
            className={`${inputClass} border`}
            style={inputStyle}
          />
        </div>
        <div className="flex-1">
          <label htmlFor="sf-comment" className="block font-mono text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Comment</label>
          <input
            type="text"
            id="sf-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Quick note about this service"
            className={`${inputClass} border`}
            style={inputStyle}
          />
        </div>
        <button
          onClick={handleSubmit}
          className="px-4 py-1.5 font-mono text-[11px] uppercase tracking-widest bg-transparent border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)] rounded-none transition-colors"
        >
          {isEditing ? 'Update' : 'Add'}
        </button>
        <button
          onClick={onClose}
          className="px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] rounded-none transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
