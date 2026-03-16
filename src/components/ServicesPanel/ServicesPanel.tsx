import React, { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { ServiceCard } from './ServiceCard';
import type { Service, ServiceCategory, ServiceContext } from '../../types';

const categories: ServiceCategory[] = [
  'domain', 'hosting', 'cicd', 'database', 'auth', 'payments',
  'email', 'analytics', 'monitoring', 'cdn', 'storage', 'infra',
  'ai', 'mobile', 'gaming', 'data', 'messaging', 'support', 'other',
];

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
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const needsReview = useMemo(() => {
    return services.filter(s => s.needsReview || s.confidence === 'low');
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
      return true;
    });
  }, [services, search, activeCategory, activePlan]);

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setShowAddForm(true);
  };

  const handleCloseForm = () => {
    setShowAddForm(false);
    setEditingService(null);
  };

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
            className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest bg-transparent border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)] rounded-none transition-colors"
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border rounded-sm pl-10 pr-4 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
            style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}
          />
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest rounded-sm transition-colors ${
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
              className={`px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest rounded-sm capitalize transition-colors ${
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
            className={`px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest rounded-sm transition-colors ${
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
              className={`px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest rounded-sm capitalize transition-colors ${
                activePlan === plan
                  ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
                  : 'bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'
              }`}
            >
              {plan}
            </button>
          ))}
        </div>
      </div>

      {/* Add/Edit Service Form */}
      {showAddForm && (
        <ServiceForm
          editingService={editingService}
          onClose={handleCloseForm}
        />
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Needs Review Section */}
        {needsReview.length > 0 && !search && activeCategory === 'all' && activePlan === 'all' && (
          <div className="bg-[#2a1e0a] border border-[#6b3d0a] rounded-sm p-4">
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
                <ServiceCard
                  key={service.id}
                  service={service}
                  context={contextMap.get(service.id)}
                  onEdit={service.source === 'manual' ? handleEdit : undefined}
                />
              ))}
            </div>
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#6b3d0a]/30">
              <button
                onClick={() => { setEditingService(null); setShowAddForm(true); }}
                className="text-xs text-[var(--color-accent)] hover:opacity-80 transition-colors"
              >
                Complete in form &rarr;
              </button>
              <span className="text-xs text-[var(--color-text-muted)]">or</span>
              <span className="text-xs text-[var(--color-text-muted)]">
                Edit stackwatch.config.json directly
              </span>
            </div>
          </div>
        )}

        {/* Grid */}
        {filtered.length === 0 ? (
          services.length === 0 && repoPath ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
              <svg className="w-12 h-12 text-[var(--color-text-muted)] opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <div>
                <p className="font-mono text-sm text-[var(--color-text-secondary)] uppercase tracking-widest mb-2">No services detected</p>
                <p className="font-mono text-[11px] text-[var(--color-text-muted)] max-w-md leading-relaxed">
                  This could mean the project uses only local dependencies, or services are configured in ways StackWatch doesn't recognize yet.
                </p>
              </div>
              <button
                onClick={() => { setEditingService(null); setShowAddForm(true); }}
                className="mt-2 px-4 py-2 font-mono text-[10px] uppercase tracking-widest bg-transparent border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)] rounded-none transition-colors"
              >
                + Add service manually
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-sm">
              {services.length === 0
                ? 'No services detected. Analyze a repository to get started.'
                : 'No services match your filters.'}
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                context={contextMap.get(service.id)}
                onEdit={service.source === 'manual' ? handleEdit : undefined}
              />
            ))}
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
  const [costAmount, setCostAmount] = useState(editingService?.cost?.amount?.toString() ?? '');
  const [costCurrency, setCostCurrency] = useState(editingService?.cost?.currency ?? 'USD');
  const [costPeriod, setCostPeriod] = useState<'monthly' | 'yearly'>(editingService?.cost?.period ?? 'monthly');
  const [renewalDate, setRenewalDate] = useState(editingService?.renewalDate ?? '');
  const [accountEmail, setAccountEmail] = useState(editingService?.accountEmail ?? '');
  const [notes, setNotes] = useState(editingService?.notes ?? '');
  const [confidence, setConfidence] = useState<NonNullable<Service['confidence']>>(editingService?.confidence ?? 'high');
  const [owner, setOwner] = useState(editingService?.owner ?? '');
  const [comment, setComment] = useState(editingService?.comment ?? '');

  const handleSubmit = async () => {
    if (!name.trim()) return;

    const service: Service = {
      id: editingService?.id ?? name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
      name: name.trim(),
      category,
      plan,
      source: 'manual',
      confidence,
      ...(url && { url }),
      ...(costAmount && {
        cost: { amount: parseFloat(costAmount), currency: costCurrency, period: costPeriod },
      }),
      ...(renewalDate && { renewalDate }),
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
    await deleteManualService(editingService.id);
    onClose();
  };

  const inputClass = "w-full rounded-sm px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]";
  const inputStyle = { background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' };

  return (
    <div className="px-6 py-4 border-b space-y-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-primary)' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
          {isEditing ? 'Edit Service' : 'Add Service'}
        </span>
        {isEditing && (
          <button
            onClick={handleDelete}
            className="text-xs text-[#a35050] hover:opacity-80 transition-colors"
          >
            Delete
          </button>
        )}
      </div>

      {/* Row 1: Name, Category, Plan, Confidence */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[160px]">
          <label className="block font-mono text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Service name"
            className={`${inputClass} border`}
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Category *</label>
          <select
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
          <label className="block font-mono text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Plan *</label>
          <select
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
          <label className="block font-mono text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Confidence</label>
          <select
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

      {/* Row 2: URL, Cost, Renewal */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block font-mono text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">URL</label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className={`${inputClass} border`}
            style={inputStyle}
          />
        </div>
        <div className="w-20">
          <label className="block font-mono text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Cost</label>
          <input
            type="number"
            value={costAmount}
            onChange={(e) => setCostAmount(e.target.value)}
            placeholder="0"
            min="0"
            step="0.01"
            className={`${inputClass} border`}
            style={inputStyle}
          />
        </div>
        <div className="w-16">
          <select
            value={costCurrency}
            onChange={(e) => setCostCurrency(e.target.value)}
            className="rounded-sm px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] border"
            style={inputStyle}
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
        <div className="w-16">
          <select
            value={costPeriod}
            onChange={(e) => setCostPeriod(e.target.value as 'monthly' | 'yearly')}
            className="rounded-sm px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] border"
            style={inputStyle}
          >
            <option value="monthly">/mo</option>
            <option value="yearly">/yr</option>
          </select>
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Renewal</label>
          <input
            type="date"
            value={renewalDate}
            onChange={(e) => setRenewalDate(e.target.value)}
            className={`${inputClass} border`}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Row 3: Email, Notes, Actions */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block font-mono text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Account Email</label>
          <input
            type="email"
            value={accountEmail}
            onChange={(e) => setAccountEmail(e.target.value)}
            placeholder="admin@example.com"
            className={`${inputClass} border`}
            style={inputStyle}
          />
        </div>
        <div className="flex-1">
          <label className="block font-mono text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional details..."
            className={`${inputClass} border`}
            style={inputStyle}
          />
        </div>
        <div className="flex-1">
          <label className="block font-mono text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Owner</label>
          <input
            type="text"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="Team or person responsible"
            className={`${inputClass} border`}
            style={inputStyle}
          />
        </div>
        <div className="flex-1">
          <label className="block font-mono text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Comment</label>
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Quick note about this service"
            className={`${inputClass} border`}
            style={inputStyle}
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!name.trim()}
          className="px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest bg-transparent border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)] disabled:opacity-50 rounded-none transition-colors"
        >
          {isEditing ? 'Update' : 'Add'}
        </button>
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs text-[var(--color-text-secondary)] rounded-none transition-colors"
          style={{ background: 'var(--color-bg-hover)' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
