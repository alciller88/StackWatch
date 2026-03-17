import React, { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { useGraphStore } from '../../store/graphStore';
import { APP_VERSION } from '../../constants';
import { calculateHealthScore } from '../../utils/healthScore';
import type { FlowNode, FlowEdge } from '../../types';

import type { ActivePanel } from '../../store/useStore';

interface NavItem {
  id: ActivePanel;
  label: string;
  icon: React.ReactNode;
  section: 'views' | 'system';
}

const navItems: NavItem[] = [
  {
    id: 'services',
    label: 'Services',
    section: 'views',
    icon: (
      <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
        />
      </svg>
    ),
  },
  {
    id: 'dependencies',
    label: 'Dependencies',
    section: 'views',
    icon: (
      <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4 6h16M4 10h16M4 14h16M4 18h16"
        />
      </svg>
    ),
  },
  {
    id: 'discarded',
    label: 'Discarded',
    section: 'views',
    icon: (
      <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
      </svg>
    ),
  },
  {
    id: 'flow',
    label: 'Flow Graph',
    section: 'views',
    icon: (
      <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
    ),
  },
  {
    id: 'costs',
    label: 'Costs',
    section: 'views',
    icon: (
      <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V6m0 8v2m0-10c1.657 0 3 .895 3 2m-6 4c0 1.105 1.343 2 3 2"
        />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    section: 'system',
    icon: (
      <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },
];

const sectionLabel = (text: string, collapsed: boolean) =>
  !collapsed ? (
    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', letterSpacing: '0.2em', color: 'var(--color-text-muted)', padding: '0 12px', marginBottom: '4px', marginTop: '8px' }}>
      {text}
    </div>
  ) : null;

export const Sidebar: React.FC = () => {
  const { activePanel, setActivePanel, services, openScoreHistory, openDoctor, theme, toggleTheme } = useStore();
  const graphNodes = useGraphStore(s => s.nodes);
  const graphEdges = useGraphStore(s => s.edges);
  const [collapsed, setCollapsed] = useState(false);

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

  const viewItems = navItems.filter(i => i.section === 'views');
  const systemItems = navItems.filter(i => i.section === 'system');

  return (
    <div
      className={`border-r flex flex-col shrink-0 transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-52'
      }`}
      style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}
    >
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
        {!collapsed && (
          <span className="font-mono tracking-widest uppercase text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            <span style={{ color: 'var(--color-accent)' }}>STACK</span>WATCH
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] rounded-none transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg
            className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`}
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      {/* Stack Health Score */}
      {services.length > 0 && (
        <button
          onClick={openScoreHistory}
          className="w-full flex flex-col items-center py-3 border-b cursor-pointer transition-colors hover:bg-[var(--color-bg-hover)]"
          style={{ borderColor: 'var(--color-border)' }}
          title={collapsed ? `Score: ${breakdown.score} — Click for history` : `Cost: ${breakdown.servicesWithCost}% | Owner: ${breakdown.servicesWithOwner}% | Reviewed: ${breakdown.servicesReviewed}% | Graph: ${breakdown.graphCompleteness}% — Click for history`}
        >
          <span
            className={`font-mono font-bold ${collapsed ? 'text-sm' : 'text-lg'} ${
              breakdown.score >= 80
                ? 'text-green-400'
                : breakdown.score >= 50
                  ? 'text-[var(--color-accent)]'
                  : 'text-red-400'
            }`}
          >
            {breakdown.score}
          </span>
          {!collapsed && (
            <span className="font-mono text-[10px] tracking-widest uppercase flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
              Stack Score
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </span>
          )}
        </button>
      )}

      {/* Doctor */}
      {services.length > 0 && (
        <button
          onClick={openDoctor}
          className={`w-full flex items-center gap-3 px-4 py-2 border-b transition-colors text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] ${
            collapsed ? 'justify-center' : ''
          }`}
          style={{ borderColor: 'var(--color-border)' }}
          title={collapsed ? 'Doctor' : 'Run health checks'}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          {!collapsed && (
            <span className="font-mono text-[11px] uppercase tracking-widest">Doctor</span>
          )}
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-2 px-2 space-y-0.5">
        {sectionLabel('VIEWS', collapsed)}
        {viewItems.map((item) => {
          const isActive = activePanel === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActivePanel(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
              }`}
              style={isActive ? { borderLeft: '2px solid var(--color-accent)', background: 'var(--color-bg-hover)' } : { borderLeft: '2px solid transparent' }}
              title={collapsed ? item.label : undefined}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}

        {sectionLabel('SYSTEM', collapsed)}
        {systemItems.map((item) => {
          const isActive = activePanel === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActivePanel(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
              }`}
              style={isActive ? { borderLeft: '2px solid var(--color-accent)', background: 'var(--color-bg-hover)' } : { borderLeft: '2px solid transparent' }}
              title={collapsed ? item.label : undefined}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
        {!collapsed && (
          <span className="font-mono text-[10px] tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>v{APP_VERSION}</span>
        )}
        <button
          onClick={toggleTheme}
          className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-bg-hover)] rounded-none transition-colors"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};
