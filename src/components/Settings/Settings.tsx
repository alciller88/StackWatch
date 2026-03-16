import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import type { AIProvider, AISettings } from '../../types';

export const Settings: React.FC = () => {
  const { aiSettings, loadAISettings, saveAISettings, testAIConnection } = useStore();
  const [presets, setPresets] = useState<AIProvider[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('Groq');

  const getPreset = (name: string): AIProvider | undefined => {
    return presets.find(p => p.name === name);
  };
  const [baseUrl, setBaseUrl] = useState('https://api.groq.com/openai/v1');
  const [model, setModel] = useState('llama-3.1-8b-instant');
  const [apiKey, setApiKey] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [testError, setTestError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadAISettings();
    if (window.stackwatch?.getAIPresets) {
      window.stackwatch.getAIPresets().then(setPresets);
    }
  }, [loadAISettings]);

  useEffect(() => {
    if (aiSettings) {
      setEnabled(aiSettings.enabled);
      setSelectedPreset(aiSettings.provider.name);
      setBaseUrl(aiSettings.provider.baseUrl);
      setModel(aiSettings.provider.model);
      setApiKey(aiSettings.provider.apiKey ?? '');
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
              {/* Provider Selection — card list */}
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-2">Provider</label>
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
                        {p.recommended && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-[#1a3a1a] text-[#3d8c5e] border border-[#2a5a2a] font-mono tracking-widest">
                            Recommended
                          </span>
                        )}
                        {p.localOnly && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-[#1a2a3a] text-[#4a8ab0] border border-[#2a4a6a] font-mono tracking-widest">
                            Local
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-[10px] text-[var(--color-text-muted)] mt-0.5">{p.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Provider-specific fields */}
              <div className="space-y-4 pt-1">
                {/* API Key — hidden for local providers */}
                {!isLocal && !isCustom && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="font-mono text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">API Key</label>
                      {currentPreset?.setupUrl && (
                        <a
                          href={currentPreset.setupUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-[var(--color-accent)] hover:opacity-80 transition-colors"
                        >
                          {selectedPreset === 'Groq' ? 'Get free API key' : 'Get API key'} &rarr;
                        </a>
                      )}
                    </div>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-..."
                      className={inputClass}
                      style={inputStyle}
                    />
                  </div>
                )}

                {/* Custom: API key + Base URL + Model all editable */}
                {isCustom && (
                  <>
                    <div>
                      <label className="block font-mono text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1.5">API Key (optional)</label>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-..."
                        className={inputClass}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1.5">Base URL</label>
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
                      <label className="block font-mono text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1.5">Model</label>
                      <input
                        type="text"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        placeholder="llama3.2"
                        className={inputClass}
                        style={inputStyle}
                      />
                    </div>
                  </>
                )}

                {/* Local providers: Base URL + Model editable for fine-tuning */}
                {isLocal && (
                  <>
                    <div>
                      <label className="block font-mono text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1.5">Base URL</label>
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
                      <label className="block font-mono text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1.5">Model</label>
                      <input
                        type="text"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        placeholder="llama3.2"
                        className={inputClass}
                        style={inputStyle}
                      />
                    </div>
                    {/* Inline setup instructions */}
                    {selectedPreset === 'Ollama' && (
                      <div className="bg-[#0d1a24] border border-[#1e3a4e] rounded-none px-4 py-3 font-mono text-[10px] text-[#4a8ab0] space-y-1">
                        <p className="font-medium">Setup:</p>
                        <p>1. Install Ollama from <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80">ollama.com</a></p>
                        <p>2. Run: <code className="bg-[#1a2a3a] px-1">ollama pull llama3.2</code></p>
                        <p>3. Ollama runs automatically on port 11434</p>
                      </div>
                    )}
                    {selectedPreset === 'LM Studio' && (
                      <div className="bg-[#0d1a24] border border-[#1e3a4e] rounded-none px-4 py-3 font-mono text-[10px] text-[#4a8ab0] space-y-1">
                        <p className="font-medium">Setup:</p>
                        <p>1. Download from <a href="https://lmstudio.ai" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80">lmstudio.ai</a></p>
                        <p>2. Load any GGUF model</p>
                        <p>3. Start the local server (port 1234)</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Privacy note */}
              <div className="rounded-none px-4 py-2.5 text-[11px] text-[var(--color-text-muted)]" style={{ background: 'var(--color-bg-hover)', borderColor: 'var(--color-border)', borderWidth: '1px', borderStyle: 'solid' }}>
                Groq is free and requires no credit card. Ollama and LM Studio process your code locally without sending data to third parties.
              </div>

              {/* Test Connection + Save */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleTest}
                  disabled={testStatus === 'testing' || !baseUrl || !model}
                  className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest bg-transparent border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-50 rounded-none transition-colors"
                >
                  {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
                </button>

                <button
                  onClick={handleSave}
                  className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest bg-transparent border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)] rounded-none transition-colors"
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
              className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest bg-transparent border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)] rounded-none transition-colors"
            >
              {saved ? 'Saved!' : 'Save'}
            </button>
          )}
        </div>

        {/* Info section */}
        <div className="border rounded-sm p-5 font-mono text-[10px] text-[var(--color-text-muted)] space-y-2 leading-relaxed" style={{ background: 'var(--color-bg-primary)', borderColor: 'var(--color-border)' }}>
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
      </div>
    </div>
  );
};
