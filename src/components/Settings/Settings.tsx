import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import type { AIProvider, AISettings, ScanMode } from '../../types';
import { APP_VERSION } from '../../constants';

const LEGACY_PRESET_MAP: Record<string, string> = {
  'Groq': 'Cloud (Groq)',
  'Ollama': 'Local',
  'LM Studio': 'Local',
  'OpenAI': 'Custom',
  'Mistral': 'Custom',
  'Anthropic': 'Custom',
};

export const Settings: React.FC = () => {
  const { aiSettings, loadAISettings, saveAISettings, testAIConnection } = useStore();
  const [presets, setPresets] = useState<AIProvider[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('Cloud (Groq)');

  const getPreset = (name: string): AIProvider | undefined => {
    return presets.find(p => p.name === name);
  };
  const [baseUrl, setBaseUrl] = useState('https://api.groq.com/openai/v1');
  const [model, setModel] = useState('llama-3.1-8b-instant');
  const [apiKey, setApiKey] = useState('');
  const [scanMode, setScanMode] = useState<ScanMode>('heuristic');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [testError, setTestError] = useState('');
  const [saved, setSaved] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [badgeCopied, setBadgeCopied] = useState(false);

  useEffect(() => {
    loadAISettings();
    if (window.stackwatch?.getAIPresets) {
      window.stackwatch.getAIPresets().then(setPresets);
    }
  }, [loadAISettings]);

  useEffect(() => {
    if (aiSettings) {
      setEnabled(aiSettings.enabled);
      const savedName = aiSettings.provider.name;
      const mappedName = LEGACY_PRESET_MAP[savedName] ?? savedName;
      setSelectedPreset(mappedName);
      setBaseUrl(aiSettings.provider.baseUrl);
      setModel(aiSettings.provider.model);
      setApiKey(aiSettings.provider.apiKey ?? '');
      setScanMode(aiSettings.scanMode ?? 'heuristic');
    }
  }, [aiSettings]);

  const handlePresetChange = (name: string) => {
    setSelectedPreset(name);
    const preset = getPreset(name);
    if (preset) {
      setBaseUrl(preset.baseUrl);
      setModel(preset.model);
      if (preset.localOnly) {
        setApiKey('');
      }
    }
    setTestStatus('idle');
  };

  const handleSave = async () => {
    const settings: AISettings = {
      enabled,
      provider: {
        name: selectedPreset,
        baseUrl,
        model,
        apiKey: apiKey || undefined,
      },
      scanMode: enabled ? scanMode : 'heuristic',
    };
    await saveAISettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    setTestStatus('testing');
    setTestError('');
    const result = await testAIConnection({ name: selectedPreset, baseUrl, model, apiKey: apiKey || undefined });
    if (result.ok) {
      setTestStatus('ok');
    } else {
      setTestStatus('error');
      setTestError(result.error ?? 'Unknown error');
    }
  };

  const currentPreset = getPreset(selectedPreset);
  const isLocal = currentPreset?.localOnly ?? false;
  const isCustom = selectedPreset === 'Custom';
  const isCloud = selectedPreset === 'Cloud (Groq)';

  const inputClass = "w-full border rounded-sm px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]";
  const inputStyle = { background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h2 className="font-mono uppercase tracking-widest text-sm font-medium text-[var(--color-text-primary)] mb-1">Settings</h2>
          <p className="font-mono text-[11px] text-[var(--color-text-muted)]">Configure optional AI enhancement for service detection.</p>
        </div>

        {/* AI Enhancement Toggle */}
        <div className="border rounded-sm p-5 space-y-5" style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-sans text-[13px] font-medium text-[var(--color-text-primary)]">Enhance analysis with AI</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Improves detection of ambiguous services. Disabled by default.
              </p>
            </div>
            <button
              onClick={() => setEnabled(!enabled)}
              className="relative w-11 h-6 rounded-full transition-colors"
              style={{ background: enabled ? 'var(--color-accent)' : 'var(--color-bg-hover)' }}
              role="switch"
              aria-checked={enabled}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  enabled ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>

          {enabled && (
            <>
              {/* Provider Selection */}
              <div>
                <label className="block font-mono text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-2">Provider</label>
                <div className="space-y-2">
                  {presets.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => handlePresetChange(p.name)}
                      className={`w-full text-left px-4 py-3 rounded-none border transition-colors ${
                        selectedPreset === p.name
                          ? 'border-[var(--color-accent)]'
                          : 'border-[var(--color-border)] hover:border-[var(--color-border-light)]'
                      }`}
                      style={{ background: selectedPreset === p.name ? 'var(--color-bg-secondary)' : 'var(--color-bg-primary)' }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[12px] font-medium text-[var(--color-text-primary)]">{p.name}</span>
                        {p.recommended && p.localOnly && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-[#1a2a3a] text-[#4a8ab0] border border-[#2a4a6a] font-mono tracking-widest">
                            Local
                          </span>
                        )}
                        {p.recommended && !p.localOnly && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-[#1a3a1a] text-[#3d8c5e] border border-[#2a5a2a] font-mono tracking-widest">
                            Free
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-[11px] text-[var(--color-text-muted)] mt-0.5">{p.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Provider-specific fields */}
              <div className="space-y-4 pt-1">
                {/* Cloud (Groq): API Key */}
                {isCloud && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="font-mono text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">API Key</label>
                      <button
                        type="button"
                        onClick={() => window.stackwatch.openExternalUrl('https://console.groq.com/keys')}
                        className="text-[11px] text-[var(--color-accent)] hover:opacity-80 transition-colors bg-transparent border-none cursor-pointer p-0"
                      >
                        Get free API key &rarr;
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="gsk_..."
                        className={inputClass}
                        style={{ ...inputStyle, paddingRight: '2.5rem' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                        aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                      >
                        {showApiKey ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Local: Base URL + Model + setup instructions */}
                {isLocal && (
                  <>
                    <div>
                      <label className="block font-mono text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1.5">Base URL</label>
                      <input
                        type="text"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        placeholder="http://localhost:11434/v1"
                        className={inputClass}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1.5">Model</label>
                      <input
                        type="text"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        placeholder="llama3.2"
                        className={inputClass}
                        style={inputStyle}
                      />
                    </div>
                    <div className="bg-[#0d1a24] border border-[#1e3a4e] rounded-none px-4 py-3 font-mono text-[11px] text-[#4a8ab0] space-y-2">
                      <div>
                        <p className="font-medium">Ollama (default, port 11434):</p>
                        <p>1. Install from <button type="button" onClick={() => window.stackwatch.openExternalUrl('https://ollama.com')} className="underline hover:opacity-80 bg-transparent border-none text-inherit cursor-pointer p-0 font-inherit text-[inherit]">ollama.com</button></p>
                        <p>2. Run: <code className="bg-[#1a2a3a] px-1">ollama pull llama3.2</code></p>
                        <p>3. Ollama runs automatically on port 11434</p>
                      </div>
                      <div className="border-t border-[#1e3a4e] pt-2">
                        <p className="font-medium">LM Studio (port 1234):</p>
                        <p>1. Download from <button type="button" onClick={() => window.stackwatch.openExternalUrl('https://lmstudio.ai')} className="underline hover:opacity-80 bg-transparent border-none text-inherit cursor-pointer p-0 font-inherit text-[inherit]">lmstudio.ai</button></p>
                        <p>2. Load any GGUF model and start the local server</p>
                        <p>3. Change Base URL above to <code className="bg-[#1a2a3a] px-1">http://localhost:1234/v1</code></p>
                      </div>
                    </div>
                  </>
                )}

                {/* Custom: API key + Base URL + Model */}
                {isCustom && (
                  <>
                    <div>
                      <label className="block font-mono text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1.5">API Key (optional)</label>
                      <div className="relative">
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="sk-..."
                          className={inputClass}
                          style={{ ...inputStyle, paddingRight: '2.5rem' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                          aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                        >
                          {showApiKey ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block font-mono text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1.5">Base URL</label>
                      <input
                        type="text"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        placeholder="https://api.openai.com/v1"
                        className={inputClass}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1.5">Model</label>
                      <input
                        type="text"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        placeholder="gpt-4o-mini"
                        className={inputClass}
                        style={inputStyle}
                      />
                    </div>
                    <div className="bg-[#0d1a24] border border-[#1e3a4e] rounded-none px-4 py-3 font-mono text-[11px] text-[#4a8ab0]">
                      <p>Works with any OpenAI-compatible API: OpenAI, Mistral, Anthropic, Together, and others.</p>
                    </div>
                  </>
                )}
              </div>

              {/* Scan Mode */}
              <div>
                <label className="block font-mono text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-2">Scan Mode</label>
                <div className="space-y-2">
                  {([
                    {
                      value: 'heuristic' as ScanMode,
                      label: 'Heuristic only',
                      desc: 'Fast pattern-based detection. No AI calls.',
                      alwaysAvailable: true,
                    },
                    {
                      value: 'hybrid' as ScanMode,
                      label: 'Heuristic + AI',
                      desc: 'AI validates findings, removes false positives, fixes categories, and discovers hidden services.',
                      alwaysAvailable: false,
                    },
                  ]).map((opt) => {
                    const available = opt.alwaysAvailable || enabled;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => available && setScanMode(opt.value)}
                        disabled={!available}
                        className={`w-full text-left px-4 py-3 rounded-none border transition-colors ${
                          scanMode === opt.value
                            ? 'border-[var(--color-accent)]'
                            : available
                              ? 'border-[var(--color-border)] hover:border-[var(--color-border-light)]'
                              : 'border-[var(--color-border)] opacity-40 cursor-not-allowed'
                        }`}
                        style={{ background: scanMode === opt.value ? 'var(--color-bg-secondary)' : 'var(--color-bg-primary)' }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[12px] font-medium text-[var(--color-text-primary)]">{opt.label}</span>
                          {!opt.alwaysAvailable && !enabled && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] border border-[var(--color-border)] font-mono tracking-widest">
                              Requires AI
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-[11px] text-[var(--color-text-muted)] mt-0.5">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Privacy note */}
              <div className="rounded-none px-4 py-2.5 text-[11px] text-[var(--color-text-muted)]" style={{ background: 'var(--color-bg-hover)', borderColor: 'var(--color-border)', borderWidth: '1px', borderStyle: 'solid' }}>
                Local models process your code entirely on your machine. Groq is free and requires no credit card.
              </div>

              {/* Test Connection + Save */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleTest}
                  disabled={testStatus === 'testing' || !baseUrl || !model}
                  className="px-4 py-2 font-mono text-[11px] uppercase tracking-widest bg-transparent border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-50 rounded-none transition-colors"
                >
                  {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
                </button>

                <button
                  onClick={handleSave}
                  className="px-4 py-2 font-mono text-[11px] uppercase tracking-widest bg-transparent border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)] rounded-none transition-colors"
                >
                  {saved ? 'Saved!' : 'Save'}
                </button>

                {testStatus === 'ok' && (
                  <span className="font-mono text-[11px] text-[#3d8c5e]">Connection OK</span>
                )}
                {testStatus === 'error' && (
                  <span className="font-mono text-[11px] text-[#c05050] truncate max-w-64" title={testError}>
                    {testError}
                  </span>
                )}
              </div>
            </>
          )}

          {!enabled && (
            <button
              onClick={handleSave}
              className="px-4 py-2 font-mono text-[11px] uppercase tracking-widest bg-transparent border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)] rounded-none transition-colors"
            >
              {saved ? 'Saved!' : 'Save'}
            </button>
          )}
        </div>

        {/* Info section */}
        <div className="border rounded-sm p-5 font-mono text-[11px] text-[var(--color-text-muted)] space-y-2 leading-relaxed" style={{ background: 'var(--color-bg-primary)', borderColor: 'var(--color-border)' }}>
          <p>
            <strong className="font-mono text-[var(--color-text-secondary)]">Without AI:</strong> StackWatch uses semantic heuristics to detect
            services from your codebase. This covers ~80% of cases with zero configuration.
          </p>
          <p>
            <strong className="font-mono text-[var(--color-text-secondary)]">With AI:</strong> Ambiguous evidences are sent to your chosen
            AI provider for better classification. This improves coverage to ~95%.
          </p>
          <p>
            Any OpenAI-compatible provider works, including free local models via Ollama or LM Studio.
          </p>
        </div>

        {/* Share section */}
        <div className="border rounded-sm p-5 space-y-4" style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
          <h3 className="font-mono uppercase tracking-widest text-[11px] text-[var(--color-text-muted)]">Share</h3>
          <div>
            <span
              className="inline-block font-mono text-[11px] px-3 py-1 rounded-full border border-[var(--color-accent)] text-[var(--color-accent)]"
              style={{ background: 'var(--color-bg-primary)' }}
            >
              Analyzed with StackWatch
            </span>
          </div>
          <div className="flex gap-2">
            <textarea
              readOnly
              rows={2}
              value="[![Analyzed with StackWatch](https://img.shields.io/badge/Analyzed_with-StackWatch-e2b04a?style=flat)](https://github.com/alciller88/StackWatch)"
              className="flex-1 border rounded-sm px-3 py-2 font-mono text-[11px] text-[var(--color-text-secondary)] resize-none focus:outline-none"
              style={{ background: 'var(--color-bg-primary)', borderColor: 'var(--color-border)' }}
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  '[![Analyzed with StackWatch](https://img.shields.io/badge/Analyzed_with-StackWatch-e2b04a?style=flat)](https://github.com/alciller88/StackWatch)'
                );
                setBadgeCopied(true);
                setTimeout(() => setBadgeCopied(false), 2000);
              }}
              className="px-4 py-2 font-mono text-[11px] uppercase tracking-widest bg-transparent border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] rounded-none transition-colors self-start"
            >
              {badgeCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* About section */}
        <div className="border rounded-sm p-5 space-y-3" style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
          <h3 className="font-mono uppercase tracking-widest text-[11px] text-[var(--color-text-muted)]">About</h3>
          <p className="font-mono text-[13px] text-[var(--color-accent)]">StackWatch v{APP_VERSION}</p>
          <p className="font-mono text-[11px] text-[var(--color-text-muted)]">Know your stack, own your stack.</p>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => window.stackwatch.openExternalUrl('https://github.com/alciller88/StackWatch')}
              className="block font-mono text-[11px] text-[var(--color-accent)] hover:opacity-80 transition-opacity bg-transparent border-none cursor-pointer p-0 text-left"
            >
              GitHub
            </button>
            <button
              type="button"
              onClick={() => window.stackwatch.openExternalUrl('https://github.com/alciller88/StackWatch/issues')}
              className="block font-mono text-[11px] text-[var(--color-accent)] hover:opacity-80 transition-opacity bg-transparent border-none cursor-pointer p-0 text-left"
            >
              Report an issue
            </button>
            <span className="block font-mono text-[11px] text-[var(--color-text-muted)]">MIT License</span>
          </div>
        </div>
      </div>
    </div>
  );
};
