import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { themes } from '../themes';

/**
 * Returns resolved hex values for the current theme.
 * Needed for libraries like Recharts that don't support CSS variables in SVG attributes.
 */
export function useThemeColors() {
  const theme = useStore(s => s.theme);
  return useMemo(() => {
    const t = themes[theme];
    return {
      bgPrimary: t['--color-bg-primary'],
      bgSecondary: t['--color-bg-secondary'],
      bgTertiary: t['--color-bg-tertiary'],
      textPrimary: t['--color-text-primary'],
      textSecondary: t['--color-text-secondary'],
      textMuted: t['--color-text-muted'],
      accent: t['--color-accent'],
      border: t['--color-border'],
      danger: t['--color-danger'],
      success: t['--color-success'],
      warning: t['--color-warning'],
      info: t['--color-info'],
    };
  }, [theme]);
}
