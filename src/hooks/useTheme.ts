import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { themes } from '../themes';

export function useTheme() {
  const theme = useStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    const vars = themes[theme];
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
    root.style.setProperty('color-scheme', theme);
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
  }, [theme]);

  return theme;
}
