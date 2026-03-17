import { useEffect, useRef, useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { useGraphStore } from '../../store/graphStore';
import { calculateHealthScore } from '../../utils/healthScore';
import type { FlowNode, FlowEdge, DepVulnResult } from '../../types';

type CheckStatus = 'pass' | 'fail' | 'warn';

interface CheckItem {
  label: string;
  status: CheckStatus;
  detail?: string;
}

interface CheckSection {
  title: string;
  items: CheckItem[];
}

const StatusIcon: React.FC<{ status: CheckStatus }> = ({ status }) => {
  if (status === 'pass') {
    return (
      <svg className="w-3.5 h-3.5 text-[#3d8c5e] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (status === 'fail') {
    return (
      <svg className="w-3.5 h-3.5 text-[#c05050] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  return (
    <svg className="w-3.5 h-3.5 text-[#c8a040] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  );
};

export const DoctorModal: React.FC = () => {
  const { services, dependencies, config, closeDoctor } = useStore();
  const graphNodes = useGraphStore(s => s.nodes);
  const graphEdges = useGraphStore(s => s.edges);
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const [vulnResults, setVulnResults] = useState<DepVulnResult[] | null>(null);
  const [vulnLoading, setVulnLoading] = useState(true);
  const [vulnError, setVulnError] = useState<string | null>(null);

  // Run vuln scan on mount
  useEffect(() => {
    let cancelled = false;
    const runScan = async () => {
      if (!window.stackwatch?.scanVulnerabilities || dependencies.length === 0) {
        setVulnResults([]);
        setVulnLoading(false);
        return;
      }
      try {
        const results = await window.stackwatch.scanVulnerabilities(dependencies);
        if (!cancelled) {
          setVulnResults(results);
          setVulnLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setVulnError(err instanceof Error ? err.message : String(err));
          setVulnResults([]);
          setVulnLoading(false);
        }
      }
    };
    runScan();
    return () => { cancelled = true; };
  }, [dependencies]);

  // Focus management
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });
    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

  // Keyboard handling
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDoctor();
        return;
      }
      if (e.key === 'Tab') {
        const focusable = overlayRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [closeDoctor]);

  // Build health score
  const breakdown = useMemo(() => {
    const fNodes: FlowNode[] = graphNodes.map(n => ({
      id: n.id,
      label: n.data.label,
      type: n.data.nodeType ?? 'external',
      serviceId: n.data.serviceId,
    }));
    const fEdges: FlowEdge[] = graphEdges.map(e => ({
      source: e.source,
      target: e.target,
      flowType: e.data?.flowType ?? 'data',
    }));
    return calculateHealthScore(services, fNodes, fEdges);
  }, [services, graphNodes, graphEdges]);

  // Build check sections
  const sections: CheckSection[] = useMemo(() => {
    const configSection: CheckSection = {
      title: 'Configuration',
      items: [
        {
          label: 'Config exists',
          status: config !== null ? 'pass' : 'fail',
          detail: config !== null ? 'stackwatch.config.json found' : 'No config file found',
        },
        {
          label: 'Project name',
          status: config?.project?.name ? 'pass' : 'fail',
          detail: config?.project?.name || 'Not set',
        },
      ],
    };

    const noOwner = services.filter(s => !s.owner);
    const paidNoRenewal = services.filter(s => s.plan === 'paid' && !s.renewalDate);
    const needReview = services.filter(s => s.needsReview);
    const lowConf = services.filter(s => s.confidence === 'low');

    const servicesSection: CheckSection = {
      title: 'Services',
      items: [
        {
          label: 'Services without owner',
          status: noOwner.length === 0 ? 'pass' : 'warn',
          detail: noOwner.length === 0
            ? 'All services have an owner'
            : `${noOwner.length} service${noOwner.length !== 1 ? 's' : ''} missing owner`,
        },
        {
          label: 'Services need review',
          status: needReview.length === 0 ? 'pass' : 'warn',
          detail: needReview.length === 0
            ? 'No services flagged for review'
            : `${needReview.length} service${needReview.length !== 1 ? 's' : ''} need review`,
        },
        {
          label: 'Low confidence services',
          status: lowConf.length === 0 ? 'pass' : 'warn',
          detail: lowConf.length === 0
            ? 'No low confidence services'
            : `${lowConf.length} service${lowConf.length !== 1 ? 's' : ''} with low confidence`,
        },
      ],
    };

    const paidNoCost = services.filter(s => s.plan === 'paid' && (!s.cost || !s.cost.amount));

    const costsSection: CheckSection = {
      title: 'Costs',
      items: [
        {
          label: 'Paid without renewal date',
          status: paidNoRenewal.length === 0 ? 'pass' : 'fail',
          detail: paidNoRenewal.length === 0
            ? 'All paid services have renewal dates'
            : `${paidNoRenewal.length} paid service${paidNoRenewal.length !== 1 ? 's' : ''} missing renewal date`,
        },
        {
          label: 'Paid without cost',
          status: paidNoCost.length === 0 ? 'pass' : 'fail',
          detail: paidNoCost.length === 0
            ? 'All paid services have costs'
            : `${paidNoCost.length} paid service${paidNoCost.length !== 1 ? 's' : ''} missing cost data`,
        },
      ],
    };

    const vulnCount = vulnResults
      ? vulnResults.reduce((acc, r) => acc + r.vulnerabilities.length, 0)
      : 0;

    const securitySection: CheckSection = {
      title: 'Security',
      items: [
        {
          label: 'Vulnerabilities',
          status: vulnLoading ? 'warn' : vulnCount === 0 ? 'pass' : 'fail',
          detail: vulnLoading
            ? 'Scanning...'
            : vulnError
              ? `Scan error: ${vulnError}`
              : vulnCount === 0
                ? 'No known vulnerabilities'
                : `${vulnCount} vulnerabilit${vulnCount !== 1 ? 'ies' : 'y'} found`,
        },
      ],
    };

    const scoreSection: CheckSection = {
      title: 'Stack Score',
      items: [
        {
          label: `Score: ${breakdown.score}/100`,
          status: breakdown.score >= 80 ? 'pass' : breakdown.score >= 50 ? 'warn' : 'fail',
          detail: `Cost: ${breakdown.servicesWithCost}% | Owner: ${breakdown.servicesWithOwner}% | Reviewed: ${breakdown.servicesReviewed}% | Graph: ${breakdown.graphCompleteness}%`,
        },
      ],
    };

    return [configSection, servicesSection, costsSection, securitySection, scoreSection];
  }, [config, services, vulnResults, vulnLoading, vulnError, breakdown]);

  // Summary counts
  const summary = useMemo(() => {
    let errors = 0;
    let warnings = 0;
    let passed = 0;
    for (const section of sections) {
      for (const item of section.items) {
        if (item.status === 'fail') errors++;
        else if (item.status === 'warn') warnings++;
        else passed++;
      }
    }
    return { errors, warnings, passed };
  }, [sections]);

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="doctor-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === overlayRef.current) closeDoctor();
      }}
    >
      <div
        className="w-full max-w-xl shadow-2xl max-h-[80vh] flex flex-col"
        style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-3 flex items-center justify-between shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <h3
            id="doctor-title"
            className="font-mono text-[11px] uppercase tracking-widest"
            style={{ color: 'var(--color-accent)' }}
          >
            stackwatch doctor
          </h3>
          <button
            ref={closeButtonRef}
            onClick={closeDoctor}
            className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
            title="Close"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-auto flex-1 space-y-4">
          {sections.map((section) => (
            <div key={section.title}>
              <div
                className="font-mono text-[10px] uppercase tracking-widest mb-2"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {section.title}
              </div>
              <div
                className="space-y-px"
                style={{ border: '1px solid var(--color-border)' }}
              >
                {section.items.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 px-3 py-2"
                    style={{ background: 'var(--color-bg-primary)' }}
                  >
                    <StatusIcon status={item.status} />
                    <div className="min-w-0 flex-1">
                      <div
                        className="font-mono text-[11px] font-medium"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {item.label}
                      </div>
                      {item.detail && (
                        <div
                          className="font-mono text-[10px] mt-0.5"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          {item.detail}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-3 shrink-0"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <div className="font-mono text-[10px] tracking-wide flex items-center gap-3">
            {summary.errors > 0 && (
              <span className="text-[#c05050]">
                {summary.errors} error{summary.errors !== 1 ? 's' : ''}
              </span>
            )}
            {summary.warnings > 0 && (
              <span className="text-[#c8a040]">
                {summary.warnings} warning{summary.warnings !== 1 ? 's' : ''}
              </span>
            )}
            <span className="text-[#3d8c5e]">
              {summary.passed} passed
            </span>
          </div>
          <button
            onClick={closeDoctor}
            className="px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest transition-colors border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
