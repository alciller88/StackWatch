import { create } from 'zustand';
import type { GraphStyles, ThemeOverrides } from '../../shared/types';
import { DEFAULT_GRAPH_STYLES, DEFAULT_THEME_OVERRIDES } from '../styles/defaults';
import { DEBOUNCE_PERSIST_MS } from '../constants';

let persistTimer: ReturnType<typeof setTimeout> | null = null;

// Module-level callback to avoid circular dependency with graphStore
let _rebuildGraph: (() => void) | null = null;
export function registerGraphRebuilder(fn: () => void) {
  _rebuildGraph = fn;
}

// Module-level callback for config persistence
let _saveGraphStyles: ((styles: GraphStyles) => Promise<void>) | null = null;
export function registerGraphStylesSaver(fn: (styles: GraphStyles) => Promise<void>) {
  _saveGraphStyles = fn;
}

interface StylesStoreState {
  graphStyles: GraphStyles;
  themeOverrides: { dark: ThemeOverrides; light: ThemeOverrides };

  setEdgeColor: (type: keyof GraphStyles['edgeColors'], color: string) => void;
  setNodeColor: (type: keyof GraphStyles['nodeColors'], color: string) => void;
  setLayerColor: (type: keyof GraphStyles['layerColors'], color: string) => void;
  setThemeOverride: (theme: 'dark' | 'light', key: keyof ThemeOverrides, value: string) => void;
  removeThemeOverride: (theme: 'dark' | 'light', key: keyof ThemeOverrides) => void;

  resetGraphStyles: () => void;
  resetEdgeColors: () => void;
  resetNodeColors: () => void;
  resetLayerColors: () => void;
  resetThemeOverrides: (theme: 'dark' | 'light') => void;

  loadGraphStyles: (styles: GraphStyles) => void;
  loadThemeOverrides: (overrides: { dark: ThemeOverrides; light: ThemeOverrides }) => void;

  applyStyles: (theme: 'dark' | 'light') => void;
}

function debouncedPersistGraphStyles(styles: GraphStyles) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    _saveGraphStyles?.(styles);
  }, DEBOUNCE_PERSIST_MS);
}

function persistThemeOverrides(overrides: { dark: ThemeOverrides; light: ThemeOverrides }) {
  localStorage.setItem('stackwatch-theme-overrides', JSON.stringify(overrides));
}

export const useStylesStore = create<StylesStoreState>((set, get) => ({
  graphStyles: { ...DEFAULT_GRAPH_STYLES },
  themeOverrides: { dark: { ...DEFAULT_THEME_OVERRIDES }, light: { ...DEFAULT_THEME_OVERRIDES } },

  setEdgeColor: (type, color) => {
    set((state) => {
      const graphStyles = {
        ...state.graphStyles,
        edgeColors: { ...state.graphStyles.edgeColors, [type]: color },
      };
      debouncedPersistGraphStyles(graphStyles);
      return { graphStyles };
    });
    get().applyStyles(getCurrentTheme());
    _rebuildGraph?.();
  },

  setNodeColor: (type, color) => {
    set((state) => {
      const graphStyles = {
        ...state.graphStyles,
        nodeColors: { ...state.graphStyles.nodeColors, [type]: color },
      };
      debouncedPersistGraphStyles(graphStyles);
      return { graphStyles };
    });
    get().applyStyles(getCurrentTheme());
    _rebuildGraph?.();
  },

  setLayerColor: (type, color) => {
    set((state) => {
      const graphStyles = {
        ...state.graphStyles,
        layerColors: { ...state.graphStyles.layerColors, [type]: color },
      };
      debouncedPersistGraphStyles(graphStyles);
      return { graphStyles };
    });
    get().applyStyles(getCurrentTheme());
    _rebuildGraph?.();
  },

  setThemeOverride: (theme, key, value) => {
    set((state) => {
      const themeOverrides = {
        ...state.themeOverrides,
        [theme]: { ...state.themeOverrides[theme], [key]: value },
      };
      persistThemeOverrides(themeOverrides);
      return { themeOverrides };
    });
    get().applyStyles(getCurrentTheme());
  },

  removeThemeOverride: (theme, key) => {
    set((state) => {
      const updated = { ...state.themeOverrides[theme] };
      delete updated[key];
      const themeOverrides = { ...state.themeOverrides, [theme]: updated };
      persistThemeOverrides(themeOverrides);
      return { themeOverrides };
    });
    get().applyStyles(getCurrentTheme());
  },

  resetGraphStyles: () => {
    const graphStyles = { ...DEFAULT_GRAPH_STYLES };
    set({ graphStyles });
    debouncedPersistGraphStyles(graphStyles);
    get().applyStyles(getCurrentTheme());
    _rebuildGraph?.();
  },

  resetEdgeColors: () => {
    set((state) => {
      const graphStyles = { ...state.graphStyles, edgeColors: { ...DEFAULT_GRAPH_STYLES.edgeColors } };
      debouncedPersistGraphStyles(graphStyles);
      return { graphStyles };
    });
    get().applyStyles(getCurrentTheme());
    _rebuildGraph?.();
  },

  resetNodeColors: () => {
    set((state) => {
      const graphStyles = { ...state.graphStyles, nodeColors: { ...DEFAULT_GRAPH_STYLES.nodeColors } };
      debouncedPersistGraphStyles(graphStyles);
      return { graphStyles };
    });
    get().applyStyles(getCurrentTheme());
    _rebuildGraph?.();
  },

  resetLayerColors: () => {
    set((state) => {
      const graphStyles = { ...state.graphStyles, layerColors: { ...DEFAULT_GRAPH_STYLES.layerColors } };
      debouncedPersistGraphStyles(graphStyles);
      return { graphStyles };
    });
    get().applyStyles(getCurrentTheme());
    _rebuildGraph?.();
  },

  resetThemeOverrides: (theme) => {
    set((state) => {
      const themeOverrides = { ...state.themeOverrides, [theme]: {} };
      persistThemeOverrides(themeOverrides);
      return { themeOverrides };
    });
    get().applyStyles(getCurrentTheme());
  },

  loadGraphStyles: (styles) => {
    set({ graphStyles: styles });
  },

  loadThemeOverrides: (overrides) => {
    set({ themeOverrides: overrides });
  },

  applyStyles: (theme) => {
    const root = document.documentElement;
    const { graphStyles, themeOverrides } = get();

    // Graph edge colors
    for (const [key, value] of Object.entries(graphStyles.edgeColors)) {
      root.style.setProperty(`--edge-${key}`, value);
    }

    // Graph node colors
    for (const [key, value] of Object.entries(graphStyles.nodeColors)) {
      root.style.setProperty(`--node-${key}`, value);
    }

    // Layer colors
    for (const [key, value] of Object.entries(graphStyles.layerColors)) {
      root.style.setProperty(`--layer-${key}`, value);
    }

    // Theme overrides
    const overrides = themeOverrides[theme];
    const overrideMap: Record<keyof ThemeOverrides, string> = {
      accent: '--color-accent',
      bgPrimary: '--color-bg-primary',
      bgSecondary: '--color-bg-secondary',
      textPrimary: '--color-text-primary',
      textSecondary: '--color-text-secondary',
    };

    for (const [key, cssVar] of Object.entries(overrideMap)) {
      const value = overrides[key as keyof ThemeOverrides];
      if (value) {
        root.style.setProperty(cssVar, value);
      }
      // If no override, the theme system handles it via setTheme()
    }
  },
}));

function getCurrentTheme(): 'dark' | 'light' {
  return (localStorage.getItem('stackwatch-theme') as 'dark' | 'light') || 'dark';
}
