import React, { useState, useRef, useEffect } from 'react';
import type { Service, ServiceContext } from '../../types';
import { useStore } from '../../store/useStore';

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
  free: 'bg-[#1a3a1a] text-[#3d8c5e] border-[#2a5a2a]',
  paid: 'bg-[#2a1e0a] text-[#e2b04a] border-[#6b3d0a]',
  trial: 'bg-[#1a2a3a] text-[#4a8ab0] border-[#2a4a6a]',
  unknown: 'bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] border-[var(--color-border)]',
};

const confidenceBadge: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: '', text: '', label: '' },
  medium: { bg: 'bg-[#2a2010]', text: 'text-[#c8a040]', label: 'review' },
  low: { bg: 'bg-[#2a1e0a]', text: 'text-[var(--color-accent)]', label: 'incomplete' },
};

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const criticalityColors: Record<string, string> = {
  critical: 'text-[#c05050]',
  important: 'text-[var(--color-accent)]',
  optional: 'text-[var(--color-text-muted)]',
};

const confidenceBorder: Record<string, string> = {
  high:    'border-[#2a5a2a]',
  medium:  'border-[#6b5520]',
  low:     'border-[var(--color-accent)] border-dashed',
  default: 'border-[var(--color-border)]',
};

const criticalityIcons: Record<string, string> = {
  critical: '\u{1F534}',
  important: '\u{1F7E1}',
  optional: '\u{26AA}',
};

interface ServiceCardProps {
  service: Service;
  context?: ServiceContext;
  onEdit?: (service: Service) => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({ service, context, onEdit }) => {
  const days = service.renewalDate ? daysUntil(service.renewalDate) : null;
  const confidence = service.confidence ?? 'high';
  const badge = confidenceBadge[confidence];
  const updateServiceConfidence = useStore(s => s.updateServiceConfidence);
  const [showConfDropdown, setShowConfDropdown] = useState(false);
  const confRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showConfDropdown) return;
    const handler = (e: MouseEvent) => {
      if (confRef.current && !confRef.current.contains(e.target as Node)) {
        setShowConfDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showConfDropdown]);

  let renewalColor = 'text-[var(--color-text-secondary)]';
  if (days !== null) {
    if (days < 7) renewalColor = 'text-[#c05050]';
    else if (days < 30) renewalColor = 'text-[var(--color-accent)]';
  }

  const isClickable = !!onEdit;

  return (
    <div
      className={`border rounded-none p-4 transition-colors overflow-hidden ${
        confidenceBorder[service.confidence ?? 'default']
      } ${isClickable ? 'cursor-pointer hover:border-[var(--color-accent)]' : 'hover:border-[var(--color-border-light)]'} focus:ring-1 focus:ring-[var(--color-accent)] focus:outline-none`}
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
            <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">
              {service.category}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Confidence badge — clickable */}
          <div className="relative" ref={confRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowConfDropdown(v => !v); }}
              className={`font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-none font-medium border cursor-pointer transition-colors ${
                confidence === 'high'
                  ? 'bg-[#1a3a1a] text-[#3d8c5e] border-[#2a5a2a] hover:bg-[#203a20]'
                  : confidence === 'medium'
                  ? `${badge.bg} ${badge.text} border-[#6b5520] hover:bg-[#302510]`
                  : `${badge.bg} ${badge.text} border-[#6b3d0a] hover:bg-[#301e08]`
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
                    className={`w-full text-left font-mono text-[10px] px-3 py-1.5 hover:bg-[var(--color-bg-hover)] transition-colors ${
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

      {/* Plan badge */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-none font-medium border ${planColors[service.plan]}`}
        >
          {service.plan}
        </span>
      </div>

      {/* Owner */}
      {service.owner && (
        <div className="font-mono text-[10px] text-[var(--color-text-secondary)] mb-2 flex items-center gap-1 truncate" title={service.owner}>
          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="truncate">{service.owner}</span>
        </div>
      )}

      {/* Cost */}
      {service.cost && (
        <div className="font-mono text-[11px] text-[var(--color-text-secondary)] mb-2">
          <span className="text-[var(--color-text-primary)] font-medium">
            {service.cost.currency} {service.cost.amount}
          </span>
          <span className="text-[var(--color-text-muted)]"> / {service.cost.period}</span>
        </div>
      )}

      {/* Renewal date */}
      {service.renewalDate && (
        <div className={`font-mono text-[10px] mb-2 ${renewalColor}`}>
          Renews: {new Date(service.renewalDate).toLocaleDateString()}
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
          <div className="font-mono text-[10px] text-[var(--color-text-secondary)] leading-relaxed line-clamp-3">
            — {context.usage}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]">{criticalityIcons[context.criticalityLevel] ?? '\u{26AA}'}</span>
            <span className={`font-mono text-[9px] uppercase tracking-widest font-medium ${criticalityColors[context.criticalityLevel] ?? 'text-[var(--color-text-muted)]'}`}>
              {context.criticalityLevel}
            </span>
          </div>
          {context.warnings && context.warnings.length > 0 && (
            <div className="space-y-0.5">
              {context.warnings.map((w, i) => (
                <div key={i} className="font-mono text-[9px] text-[var(--color-accent)] flex items-start gap-1">
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
        <div className="font-mono text-[9px] text-[var(--color-text-muted)] mt-2 truncate" title={service.inferredFrom}>
          Inferred from: {service.inferredFrom}
        </div>
      )}

      {/* Notes */}
      {service.notes && (
        <div className="font-mono text-[10px] text-[var(--color-text-muted)] mt-2 line-clamp-2">
          {service.notes}
        </div>
      )}

      {/* Comment */}
      {service.comment && (
        <div className="font-mono text-[10px] text-[var(--color-text-muted)] mt-2 italic line-clamp-2">
          {service.comment}
        </div>
      )}

      {/* Edit hint for manual services */}
      {isClickable && (
        <div className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-accent)] opacity-40 mt-2">
          Click to edit
        </div>
      )}
    </div>
  );
};
