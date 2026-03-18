import type { GraphStyles, ThemeOverrides } from '../../shared/types';

export const DEFAULT_GRAPH_STYLES: GraphStyles = {
  edgeColors: {
    data: '#3b82f6',
    auth: '#22c55e',
    payment: '#f59e0b',
    webhook: '#ef4444',
  },
  nodeColors: {
    user: '#3b82f6',
    cdn: '#14b8a6',
    frontend: '#22c55e',
    api: '#a855f7',
    database: '#f97316',
    external: '#ec4899',
    layer: '#e2b04a',
    fallback: '#6b7280',
  },
  layerColors: {
    user: '#e2b04a',
    frontend: '#4a8ab0',
    backend: '#6b4ab0',
    custom: '#8090a6',
  },
};

export const DEFAULT_THEME_OVERRIDES: ThemeOverrides = {};
