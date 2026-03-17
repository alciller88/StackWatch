export const themes = {
  dark: {
    '--color-bg-primary': '#0a0c0f',
    '--color-bg-secondary': '#0d1017',
    '--color-bg-tertiary': '#111620',
    '--color-bg-hover': '#141a24',
    '--color-text-primary': '#dce1e8',
    '--color-text-secondary': '#7a8da6',
    '--color-text-muted': '#8090a6',
    '--color-accent': '#e2b04a',
    '--color-accent-hover': '#f0c060',
    '--color-border': '#1e2430',
    '--color-border-light': '#1a2130',
    '--color-grid': '#1a2130',
  },
  light: {
    '--color-bg-primary': '#f5f6f8',
    '--color-bg-secondary': '#ffffff',
    '--color-bg-tertiary': '#ebedf0',
    '--color-bg-hover': '#e4e6ea',
    '--color-text-primary': '#1a1e2e',
    '--color-text-secondary': '#4a5568',
    '--color-text-muted': '#718096',
    '--color-accent': '#c4962e',
    '--color-accent-hover': '#a87d25',
    '--color-border': '#d4d8e0',
    '--color-border-light': '#c8ccd4',
    '--color-grid': '#d4d8e0',
  },
} as const;

export type ThemeName = keyof typeof themes;
