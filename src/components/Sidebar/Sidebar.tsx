import React, { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { useGraphStore } from '../../store/graphStore';
import { APP_VERSION } from '../../constants';
import { calculateHealthScore } from '../../utils/healthScore';
import type { FlowNode, FlowEdge } from '../../types';

type ActivePanel = 'services' | 'dependencies' | 'flow' | 'costs' | 'settings';

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
  const { activePanel, setActivePanel, services } = useStore();
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
        <div
          className="flex flex-col items-center py-3 border-b"
          style={{ borderColor: 'var(--color-border)' }}
          title={`Cost: ${breakdown.servicesWithCost}% | Owner: ${breakdown.servicesWithOwner}% | Reviewed: ${breakdown.servicesReviewed}% | Graph: ${breakdown.graphCompleteness}%`}
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
            <span className="font-mono text-[9px] tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
              Stack Score
            </span>
          )}
        </div>
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
      <div className="px-3 py-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
        {!collapsed && (
          <span className="font-mono text-[9px] tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>v{APP_VERSION}</span>
        )}
      </div>
    </div>
  );
};
