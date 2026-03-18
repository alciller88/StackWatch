import React, { useState } from 'react';
import { useStylesStore } from '../../store/stylesStore';
import { DEFAULT_GRAPH_STYLES, DEFAULT_THEME_OVERRIDES } from '../../styles/defaults';
import { useStore } from '../../store/useStore';
import { themes } from '../../themes';
import type { GraphStyles, ThemeOverrides } from '../../../shared/types';

// Helper to validate hex color
function isValidHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

interface ColorRowProps {
  label: string;
  color: string;
  defaultColor: string;
  onChange: (color: string) => void;
  onReset: () => void;
}

const ColorRow: React.FC<ColorRowProps> = ({ label, color, defaultColor, onChange, onReset }) => {
  const [hexInput, setHexInput] = useState(color);

  // Sync input when color changes externally (e.g. reset)
  React.useEffect(() => { setHexInput(color); }, [color]);

  const handleHexChange = (value: string) => {
    setHexInput(value);
    if (isValidHex(value)) {
      onChange(value);
    }
  };

  const isDefault = color === defaultColor;

  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="font-mono text-[11px] text-[var(--color-text-secondary)] w-32 shrink-0">{label}</span>
      <div
        className="w-4 h-4 shrink-0 border border-[var(--color-border)]"
        style={{ background: color }}
      />
      <input
        type="color"
        value={color}
        onChange={(e) => { onChange(e.target.value); setHexInput(e.target.value); }}
        className="w-6 h-6 cursor-pointer border-none bg-transparent shrink-0"
        style={{ padding: 0 }}
      />
      <input
        type="text"
        value={hexInput}
        onChange={(e) => handleHexChange(e.target.value)}
        className="w-20 font-mono text-[11px] px-2 py-1 border rounded-none text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
        style={{ background: 'var(--color-bg-primary)', borderColor: 'var(--color-border)' }}
        maxLength={7}
        spellCheck={false}
      />
      <button
        onClick={onReset}
        disabled={isDefault}
        className={`font-mono text-[11px] px-1 transition-colors ${
          isDefault
            ? 'text-[var(--color-text-muted)] opacity-30 cursor-default'
            : 'text-[var(--color-text-muted)] hover:text-[var(--color-accent)] cursor-pointer'
        }`}
        title="Reset to default"
        aria-label={`Reset ${label} to default`}
      >
        ↺
      </button>
    </div>
  );
};

// Collapsible section
interface SectionProps {
  title: string;
  children: React.ReactNode;
  onReset: () => void;
  defaultOpen?: boolean;
}

const Section: React.FC<SectionProps> = ({ title, children, onReset, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border rounded-none" style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--color-bg-hover)] transition-colors"
      >
        <span className="font-mono text-[11px] uppercase tracking-widest text-[var(--color-text-primary)] font-medium">{title}</span>
        <span className="font-mono text-[11px] text-[var(--color-text-muted)]">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-1">
          {children}
          <div className="pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <button
              onClick={onReset}
              className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
            >
              Reset to defaults
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const StyleEditor: React.FC = () => {
  const theme = useStore(s => s.theme);
  const {
    graphStyles,
    themeOverrides,
    setEdgeColor,
    setNodeColor,
    setLayerColor,
    setThemeOverride,
    removeThemeOverride,
    resetEdgeColors,
    resetNodeColors,
    resetLayerColors,
    resetThemeOverrides,
  } = useStylesStore();

  const currentOverrides = themeOverrides[theme];

  // Theme override entries with CSS var mapping
  const themeOverrideEntries: Array<{ key: keyof ThemeOverrides; label: string; cssVar: string }> = [
    { key: 'accent', label: 'Accent', cssVar: '--color-accent' },
    { key: 'bgPrimary', label: 'Background', cssVar: '--color-bg-primary' },
    { key: 'bgSecondary', label: 'Card background', cssVar: '--color-bg-secondary' },
    { key: 'textPrimary', label: 'Text primary', cssVar: '--color-text-primary' },
    { key: 'textSecondary', label: 'Text secondary', cssVar: '--color-text-secondary' },
  ];

  // Get the base theme color for an override key (to show when no override set)
  const getBaseThemeColor = (key: keyof ThemeOverrides): string => {
    const themeVars = themes[theme];
    const varMap: Record<keyof ThemeOverrides, string> = {
      accent: '--color-accent',
      bgPrimary: '--color-bg-primary',
      bgSecondary: '--color-bg-secondary',
      textPrimary: '--color-text-primary',
      textSecondary: '--color-text-secondary',
    };
    return themeVars[varMap[key] as keyof typeof themeVars] ?? '#000000';
  };

  // Edge type labels
  const edgeEntries: Array<{ key: keyof GraphStyles['edgeColors']; label: string }> = [
    { key: 'data', label: 'Data connection' },
    { key: 'auth', label: 'Auth connection' },
    { key: 'payment', label: 'Payment' },
    { key: 'webhook', label: 'Webhook' },
  ];

  // Node type labels
  const nodeEntries: Array<{ key: keyof GraphStyles['nodeColors']; label: string }> = [
    { key: 'user', label: 'User node' },
    { key: 'cdn', label: 'CDN node' },
    { key: 'frontend', label: 'Frontend node' },
    { key: 'api', label: 'API node' },
    { key: 'database', label: 'Database node' },
    { key: 'external', label: 'External node' },
  ];

  // Layer labels
  const layerEntries: Array<{ key: keyof GraphStyles['layerColors']; label: string }> = [
    { key: 'user', label: 'User layer' },
    { key: 'frontend', label: 'Frontend layer' },
    { key: 'backend', label: 'Backend layer' },
    { key: 'custom', label: 'Custom layer' },
  ];

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-sans text-[13px] font-medium text-[var(--color-text-primary)]">Style Editor</h3>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Customize graph colors. Changes apply in real time.
        </p>
      </div>

      {/* Theme Overrides */}
      <Section
        title={`Theme Overrides (${theme})`}
        onReset={() => resetThemeOverrides(theme)}
      >
        {themeOverrideEntries.map(({ key, label }) => (
          <ColorRow
            key={key as string}
            label={label}
            color={currentOverrides[key] ?? getBaseThemeColor(key)}
            defaultColor={getBaseThemeColor(key)}
            onChange={(color) => setThemeOverride(theme, key, color)}
            onReset={() => removeThemeOverride(theme, key)}
          />
        ))}
      </Section>

      {/* Connection Types */}
      <Section
        title="Connection Types"
        onReset={resetEdgeColors}
        defaultOpen
      >
        {edgeEntries.map(({ key, label }) => (
          <ColorRow
            key={key as string}
            label={label}
            color={graphStyles.edgeColors[key]}
            defaultColor={DEFAULT_GRAPH_STYLES.edgeColors[key]}
            onChange={(color) => setEdgeColor(key, color)}
            onReset={() => setEdgeColor(key, DEFAULT_GRAPH_STYLES.edgeColors[key])}
          />
        ))}
      </Section>

      {/* Node Types */}
      <Section
        title="Node Types"
        onReset={resetNodeColors}
      >
        {nodeEntries.map(({ key, label }) => (
          <ColorRow
            key={key as string}
            label={label}
            color={graphStyles.nodeColors[key]}
            defaultColor={DEFAULT_GRAPH_STYLES.nodeColors[key]}
            onChange={(color) => setNodeColor(key, color)}
            onReset={() => setNodeColor(key, DEFAULT_GRAPH_STYLES.nodeColors[key])}
          />
        ))}
      </Section>

      {/* Layer Nodes */}
      <Section
        title="Layer Nodes"
        onReset={resetLayerColors}
      >
        {layerEntries.map(({ key, label }) => (
          <ColorRow
            key={key as string}
            label={label}
            color={graphStyles.layerColors[key]}
            defaultColor={DEFAULT_GRAPH_STYLES.layerColors[key]}
            onChange={(color) => setLayerColor(key, color)}
            onReset={() => setLayerColor(key, DEFAULT_GRAPH_STYLES.layerColors[key])}
          />
        ))}
      </Section>
    </div>
  );
};
