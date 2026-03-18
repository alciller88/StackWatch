import React, { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import type { StackCheck } from '../../types';

const statusIcon: Record<StackCheck['status'], { icon: string; color: string }> = {
  pass: { icon: '\u2713', color: 'var(--color-success)' },
  fail: { icon: '\u2717', color: 'var(--color-danger)' },
  unchecked: { icon: '\u26AA', color: 'var(--color-text-muted)' },
};

export const ScoreBreakdown: React.FC = () => {
  const {
    stackScore,
    healthChecks,
    services,
    closeScoreBreakdown,
    openScoreHistory,
    setActivePanel,
  } = useStore();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus management: trap focus and restore on close
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    closeButtonRef.current?.focus();
    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

  const handleClose = useCallback(() => {
    closeScoreBreakdown();
  }, [closeScoreBreakdown]);

  // Close on Escape (stop propagation to prevent closing other overlays)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleClose();
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [handleClose]);

  // Close on click outside (delayed to avoid conflict with trigger button)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    // Use setTimeout to skip the click event that opened the panel
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [handleClose]);

  const applicable = healthChecks.filter(c => c.status !== 'unchecked');
  const passing = applicable.filter(c => c.status === 'pass').length;
  const total = applicable.length;

  const securityChecks = healthChecks.filter(c => c.category === 'security');
  const completenessChecks = healthChecks.filter(c => c.category === 'completeness');

  // Informational counts
  const freeCount = services.filter(s => s.plan === 'free').length;
  const unknownCount = services.filter(s => s.plan === 'unknown').length;
  const autoMonthlyCount = services.filter(
    s => s.billing?.type === 'automatic' && s.billing?.period === 'monthly',
  ).length;

  const handleAction = (check: StackCheck) => {
    if (check.actionPanel) {
      setActivePanel(check.actionPanel);
      handleClose();
    }
  };

  const renderCheck = (check: StackCheck) => {
    const { icon, color } = statusIcon[check.status];
    return (
      <div
        key={check.id}
        className="flex items-start gap-2 py-1.5"
      >
        <span
          className="font-mono text-sm shrink-0 w-4 text-center"
          style={{ color }}
          aria-hidden="true"
        >
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <span
            className="font-mono text-[11px] block"
            style={{ color: check.status === 'unchecked' ? 'var(--color-text-muted)' : 'var(--color-text-primary)' }}
          >
            {check.label}
          </span>
          {check.detail && (
            <span className="font-mono text-[10px] block" style={{ color: 'var(--color-text-muted)' }}>
              {check.detail}
            </span>
          )}
        </div>
        {check.actionPanel && check.status !== 'pass' && (
          <button
            onClick={() => handleAction(check)}
            className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors shrink-0"
          >
            {check.actionLabel ?? 'View'}
          </button>
        )}
      </div>
    );
  };

  const scoreColor = stackScore >= 80
    ? 'var(--color-success)'
    : stackScore >= 50
      ? 'var(--color-accent)'
      : 'var(--color-danger)';

  return (
    <div
      ref={panelRef}
      className="fixed top-0 right-0 h-full w-80 z-[100] border-l flex flex-col animate-in"
      style={{
        background: 'var(--color-bg-secondary)',
        borderColor: 'var(--color-border)',
        boxShadow: '-4px 0 16px rgba(0,0,0,0.3)',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Stack Score Breakdown"
    >
      {/* Header */}
      <div className="px-4 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-2xl font-bold" style={{ color: scoreColor }}>
              {stackScore}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
              Stack Score
            </span>
          </div>
          <span className="font-mono text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
            {total > 0 ? `${passing}/${total} checks passing` : 'No checks applicable'}
          </span>
        </div>
        <button
          ref={closeButtonRef}
          onClick={handleClose}
          className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          aria-label="Close score breakdown"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Checks */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Security */}
        <div>
          <div
            className="font-mono text-[10px] uppercase tracking-widest mb-2"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Security
          </div>
          <div className="space-y-0.5">
            {securityChecks.map(renderCheck)}
          </div>
        </div>

        {/* Completeness */}
        <div>
          <div
            className="font-mono text-[10px] uppercase tracking-widest mb-2"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Completeness
          </div>
          <div className="space-y-0.5">
            {completenessChecks.map(renderCheck)}
          </div>
        </div>

        {/* Informational */}
        <div className="border-t pt-3 space-y-1" style={{ borderColor: 'var(--color-border)' }}>
          {autoMonthlyCount > 0 && (
            <div className="flex items-center gap-2 font-mono text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>i</span>
              {autoMonthlyCount} monthly auto-renewing service{autoMonthlyCount !== 1 ? 's' : ''}
            </div>
          )}
          {freeCount > 0 && (
            <div className="flex items-center gap-2 font-mono text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>i</span>
              {freeCount} free service{freeCount !== 1 ? 's' : ''} (not scored)
            </div>
          )}
          {unknownCount > 0 && (
            <div className="flex items-center gap-2 font-mono text-[10px]" style={{ color: 'var(--color-accent)' }}>
              <span>!</span>
              {unknownCount} unknown plan — set plan to include in checks
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <button
          onClick={() => { openScoreHistory(); handleClose(); }}
          className="w-full font-mono text-[11px] uppercase tracking-widest py-2 text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors"
        >
          View Score History
        </button>
      </div>
    </div>
  );
};
