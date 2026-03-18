import React, { useState, useRef, useEffect } from 'react';
import type { Service, ServiceContext, AlternativeSuggestion, EvidenceSummary } from '../../types';
import { useStore } from '../../store/useStore';
import { daysUntil } from '../../utils/dates';

const categoryIcons: Record<Service['category'], string> = {
  domain: '\uD83C\uDF10',
  hosting: '\u2601\uFE0F',
  cicd: '\uD83D\uDD04',
  database: '\uD83D\uDDC4\uFE0F',
  auth: '\uD83D\uDD10',
  payments: '\uD83D\uDCB3',
  email: '\u2709\uFE0F',
  analytics: '\uD83D\uDCCA',
  monitoring: '\uD83D\uDCE1',
  cdn: '\u26A1',
  storage: '\uD83D\uDCC1',
  infra: '\uD83C\uDFD7\uFE0F',
  ai: '\uD83E\uDD16',
  mobile: '\uD83D\uDCF1',
  gaming: '\uD83C\uDFAE',
  data: '\uD83D\uDCC0',
  messaging: '\uD83D\uDCE8',
  support: '\uD83C\uDFE7',
  other: '\uD83D\uDD27',
};

const planColors: Record<Service['plan'], string> = {
  free: 'bg-[var(--color-badge-bg-success)] text-[var(--color-success)] border-[var(--color-badge-border-success)]',
  paid: 'bg-[var(--color-badge-bg-warning)] text-[var(--color-accent)] border-[var(--color-badge-border-warning)]',
  trial: 'bg-[#1a2a3a] text-[#4a8ab0] border-[#2a4a6a]',
  unknown: 'bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] border-[var(--color-border)]',
};

const confidenceBadge: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: '', text: '', label: '' },
  medium: { bg: 'bg-[#2a2010]', text: 'text-[#c8a040]', label: 'review' },
  low: { bg: 'bg-[var(--color-badge-bg-warning)]', text: 'text-[var(--color-accent)]', label: 'incomplete' },
};

const criticalityColors: Record<string, string> = {
  critical: 'text-[var(--color-danger)]',
  important: 'text-[var(--color-accent)]',
  optional: 'text-[var(--color-text-muted)]',
};

const confidenceBorder: Record<string, string> = {
  high:    'border-[var(--color-badge-border-success)]',
  medium:  'border-[#6b5520]',
  low:     'border-[var(--color-accent)] border-dashed',
  default: 'border-[var(--color-border)]',
};

const criticalityIcons: Record<string, string> = {
  critical: '\u{1F534}',
  important: '\u{1F7E1}',
  optional: '\u{26AA}',
};

const zombieBadgeStyles: Record<string, { bg: string; text: string; border: string }> = {
  zombie: { bg: 'bg-[#2a1010]', text: 'text-[var(--color-danger)]', border: 'border-[#6b2020]' },
  stale: { bg: 'bg-[#2a2010]', text: 'text-[#c8a040]', border: 'border-[#6b5520]' },
};

const zombieBorderStyles: Record<string, string> = {
  zombie: 'border-l-2 border-l-[var(--color-danger)]/50',
  stale: 'border-l-2 border-l-[#c8a040]/50',
};

interface ServiceCardProps {
  service: Service;
  context?: ServiceContext;
  onEdit?: (service: Service) => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = React.memo(function ServiceCard({ service, context, onEdit }) {
  const nextDate = service.billing?.nextDate;
  const days = nextDate ? daysUntil(nextDate) : null;
  const confidence = service.confidence ?? 'high';
  const badge = confidenceBadge[confidence];
  const updateServiceConfidence = useStore(s => s.updateServiceConfidence);
  const alternativeSuggestion = useStore(s => {
    const suggestions = s.deepAnalysis?.alternativeSuggestions;
    if (!suggestions) return undefined;
    return suggestions.find(a => a.serviceId === service.id);
  });
  const [showConfDropdown, setShowConfDropdown] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const confRef = useRef<HTMLDivElement>(null);
  const evidenceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showConfDropdown && !showEvidence) return;
    const handler = (e: MouseEvent) => {
      if (showConfDropdown && confRef.current && !confRef.current.contains(e.target as Node)) {
        setShowConfDropdown(false);
      }
      if (showEvidence && evidenceRef.current && !evidenceRef.current.contains(e.target as Node)) {
        setShowEvidence(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showConfDropdown, showEvidence]);

  let renewalColor = 'text-[var(--color-text-secondary)]';
  if (days !== null) {
    if (days < 7) renewalColor = 'text-[var(--color-danger)]';
    else if (days < 30) renewalColor = 'text-[var(--color-accent)]';
  }

  const isClickable = !!onEdit;
  const zombieStyle = service.zombieStatus && service.zombieStatus !== 'active'
    ? zombieBorderStyles[service.zombieStatus]
    : '';
  const inactiveMonths = service.daysSinceActivity != null
    ? Math.floor(service.daysSinceActivity / 30)
    : null;

  return (
    <div
      className={`border rounded-none p-4 transition-colors overflow-hidden ${
        confidenceBorder[service.confidence ?? 'default']
      } ${zombieStyle} ${isClickable ? 'cursor-pointer hover:border-[var(--color-accent)]' : 'hover:border-[var(--color-border-light)]'} focus:ring-1 focus:ring-[var(--color-accent)] focus:outline-none`}
      style={{ background: 'var(--color-bg-secondary)' }}
      onClick={onEdit ? () => onEdit(service) : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable && onEdit ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(service); } } : undefined}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl" role="img" aria-label={service.category}>
            {categoryIcons[service.category]}
          </span>
          <div>
            <h3 className="font-mono text-[12px] font-medium text-[var(--color-text-primary)] truncate max-w-[140px]" title={service.name}>{service.name}</h3>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
              {service.category}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Evidence info button */}
          {service.source === 'inferred' && service.evidenceSummary && service.evidenceSummary.length > 0 && (
            <div className="relative" ref={evidenceRef}>
              <button
                onClick={(e) => { e.stopPropagation(); setShowEvidence(v => !v); }}
                className="font-mono text-[10px] w-5 h-5 flex items-center justify-center rounded-none border transition-colors border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                aria-label="Evidence details"
                title="Why was this detected?"
              >
                ?
              </button>
              {showEvidence && (
                <div
                  className="absolute right-0 top-full mt-1 z-50 min-w-[260px] max-w-[340px]"
                  style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 0 }}
                >
                  <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--color-accent)' }}>
                      Evidence breakdown
                    </span>
                  </div>
                  <div className="px-3 py-2 space-y-1">
                    {service.evidenceSummary!.map((ev, i) => (
                      <div key={i} className="flex items-center gap-2 font-mono text-[10px]">
                        <span className="text-[var(--color-text-muted)] w-16 shrink-0 uppercase">{ev.type.replace('_', ' ')}</span>
                        <span className="text-[var(--color-text-secondary)] truncate flex-1" title={ev.value}>{ev.value}</span>
                        <span className="text-[var(--color-success)] shrink-0">+{ev.score}</span>
                      </div>
                    ))}
                  </div>
                  <div className="px-3 py-2 border-t flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
                    <span className="font-mono text-[10px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
                      Total: {service.evidenceSummary!.reduce((sum, e) => sum + e.score, 0)}
                    </span>
                    <span className={`font-mono text-[10px] uppercase ${confidence === 'high' ? 'text-[var(--color-success)]' : 'text-[var(--color-accent)]'}`}>
                      {confidence}
                    </span>
                  </div>
                  {service.source === 'manual' && (
                    <div className="px-3 py-1 text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                      \u21A9 Manually restored
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Confidence badge — clickable */}
          <div className="relative" ref={confRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowConfDropdown(v => !v); }}
              className={`font-mono text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded-none font-medium border cursor-pointer transition-colors ${
                confidence === 'high'
                  ? 'bg-[var(--color-badge-bg-success)] text-[var(--color-success)] border-[var(--color-badge-border-success)] hover:opacity-80'
                  : confidence === 'medium'
                  ? `${badge.bg} ${badge.text} border-[#6b5520] hover:opacity-80`
                  : `${badge.bg} ${badge.text} border-[var(--color-badge-border-warning)] hover:opacity-80`
              }`}
              title={service.confidenceReasons?.join('\n') ?? 'Click to change confidence'}
            >
              {confidence === 'low' && '\u26A0 '}
              {confidence === 'high' ? 'confirmed' : badge.label}
            </button>
            {showConfDropdown && (
              <div className="absolute right-0 top-full mt-1 z-50 py-1 min-w-[140px]" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 0 }}>
                {(['high', 'medium', 'low'] as const).map(level => (
                  <button
                    key={level}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateServiceConfidence(service.id, level);
                      setShowConfDropdown(false);
                    }}
                    className={`w-full text-left font-mono text-[11px] px-3 py-1.5 hover:bg-[var(--color-bg-hover)] transition-colors ${
                      level === confidence ? 'text-[var(--color-accent)] font-medium' : 'text-[var(--color-text-secondary)]'
                    }`}
                  >
                    {level === 'high' ? 'High — confirmed' : level === 'medium' ? 'Medium — review' : 'Low — uncertain'}
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Plan badge + Zombie badge */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-none font-medium border ${planColors[service.plan]}`}
        >
          {service.plan}
        </span>
        {service.zombieStatus && service.zombieStatus !== 'active' && (() => {
          const zStyle = zombieBadgeStyles[service.zombieStatus];
          const label = inactiveMonths != null && inactiveMonths > 0
            ? `Inactive ${inactiveMonths}mo`
            : service.zombieStatus === 'zombie' ? 'Zombie' : 'Stale';
          return (
            <span
              className={`font-mono text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded-none font-medium border ${zStyle.bg} ${zStyle.text} ${zStyle.border}`}
            >
              {label}
            </span>
          );
        })()}
      </div>

      {/* Owner */}
      {service.owner && (
        <div className="font-mono text-[11px] text-[var(--color-text-secondary)] mb-2 flex items-center gap-1 truncate" title={service.owner}>
          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="truncate">{service.owner}</span>
        </div>
      )}

      {/* Billing */}
      {service.billing && service.billing.type === 'free' && (
        <div className="font-mono text-[11px] text-[var(--color-success)] mb-2">
          Free plan
        </div>
      )}
      {service.billing && service.billing.type !== 'free' && service.billing.period === 'usage-based' && (
        <div className="font-mono text-[11px] text-[var(--color-text-secondary)] mb-2">
          Cost varies by usage
        </div>
      )}
      {service.billing && service.billing.type !== 'free' && service.billing.period !== 'usage-based' && service.billing.amount != null && (
        <div className="font-mono text-[11px] text-[var(--color-text-secondary)] mb-2">
          <span className="text-[var(--color-text-primary)] font-medium">
            {service.billing.currency ?? 'USD'} {service.billing.amount}
          </span>
          <span className="text-[var(--color-text-muted)]"> / {service.billing.period ?? 'monthly'}</span>
        </div>
      )}

      {/* Renewal date */}
      {nextDate && (
        <div className={`font-mono text-[11px] mb-2 ${renewalColor}`}>
          Renews: {new Date(nextDate).toLocaleDateString()}
          {days !== null && days < 30 && (
            <span className="ml-1 font-medium">
              ({days < 0 ? 'overdue' : `${days}d left`})
            </span>
          )}
        </div>
      )}

      {/* AI Context */}
      {context && (
        <div className="mt-2 space-y-1">
          <div className="font-mono text-[11px] text-[var(--color-text-secondary)] leading-relaxed line-clamp-3">
            — {context.usage}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px]">{criticalityIcons[context.criticalityLevel] ?? '\u{26AA}'}</span>
            <span className={`font-mono text-[10px] uppercase tracking-widest font-medium ${criticalityColors[context.criticalityLevel] ?? 'text-[var(--color-text-muted)]'}`}>
              {context.criticalityLevel}
            </span>
          </div>
          {context.warnings && context.warnings.length > 0 && (
            <div className="space-y-0.5">
              {context.warnings.map((w, i) => (
                <div key={i} className="font-mono text-[10px] text-[var(--color-accent)] flex items-start gap-1">
                  <span className="shrink-0">{'\u26A0'}</span>
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Inferred from */}
      {service.source === 'inferred' && service.inferredFrom && (
        <div className="font-mono text-[10px] text-[var(--color-text-muted)] mt-2 truncate" title={service.inferredFrom}>
          Inferred from: {service.inferredFrom}
        </div>
      )}

      {/* Notes */}
      {service.notes && (
        <div className="font-mono text-[11px] text-[var(--color-text-muted)] mt-2 line-clamp-2">
          {service.notes}
        </div>
      )}

      {/* Comment */}
      {service.comment && (
        <div className="font-mono text-[11px] text-[var(--color-text-muted)] mt-2 italic line-clamp-2">
          {service.comment}
        </div>
      )}

      {/* Alternatives */}
      {alternativeSuggestion && alternativeSuggestion.alternatives.length > 0 && (
        <details className="mt-2 border-t border-[var(--color-border)] pt-2" onClick={(e) => e.stopPropagation()}>
          <summary className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-accent)]">
            Alternatives ({alternativeSuggestion.alternatives.length})
          </summary>
          <div className="mt-1 space-y-1">
            {alternativeSuggestion.alternatives.map((alt, i) => (
              <div key={i} className="font-mono text-[11px]">
                <span className="text-[var(--color-accent)]">{alt.name}</span>
                <span className="ml-1 text-[var(--color-text-muted)]">
                  [{alt.type}]
                </span>
                {alt.estimatedSavings && (
                  <span className="ml-1 text-emerald-400">{alt.estimatedSavings}</span>
                )}
                <p className="text-[var(--color-text-muted)] text-[10px]">{alt.reason}</p>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Edit hint for manual services */}
      {isClickable && (
        <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-accent)] opacity-40 mt-2">
          Click to edit
        </div>
      )}
    </div>
  );
}, (prev, next) => {
  return (
    prev.service.id === next.service.id &&
    prev.service.name === next.service.name &&
    prev.service.plan === next.service.plan &&
    prev.service.confidence === next.service.confidence &&
    prev.service.needsReview === next.service.needsReview &&
    prev.service.zombieStatus === next.service.zombieStatus &&
    prev.service.billing?.nextDate === next.service.billing?.nextDate &&
    prev.service.owner === next.service.owner &&
    prev.service.notes === next.service.notes &&
    prev.context === next.context &&
    prev.onEdit === next.onEdit
  )
});
