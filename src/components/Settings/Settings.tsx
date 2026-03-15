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

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h2 className="text-lg font-semibold text-gray-100 mb-1">Settings</h2>
          <p className="text-sm text-gray-500">Configure optional AI enhancement for service detection.</p>
        </div>

        {/* AI Enhancement Toggle */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-200">Enhance analysis with AI</h3>
              <p className="text-xs text-gray-500 mt-1">
                Improves detection of ambiguous services. Disabled by default.
              </p>
            </div>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                enabled ? 'bg-blue-600' : 'bg-gray-700'
              }`}
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
                <label className="block text-xs text-gray-400 mb-2">Provider</label>
                <div className="space-y-2">
                  {presets.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => handlePresetChange(p.name)}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                        selectedPreset === p.name
                          ? 'bg-gray-800 border-blue-600'
                          : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-200">{p.name}</span>
                        {p.recommended && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/40 text-green-400 border border-green-800 font-medium">
                            Recommended
                          </span>
                        )}
                        {p.localOnly && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-400 border border-blue-800 font-medium">
                            Local
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
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
                      <label className="text-xs text-gray-400">API Key</label>
                      {currentPreset?.setupUrl && (
                        <a
                          href={currentPreset.setupUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
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
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                {/* Custom: API key + Base URL + Model all editable */}
                {isCustom && (
                  <>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">API Key (optional)</label>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Base URL</label>
                      <input
                        type="text"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        placeholder="http://localhost:11434/v1"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Model</label>
                      <input
                        type="text"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        placeholder="llama3.2"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </>
                )}

                {/* Local providers: Base URL + Model editable for fine-tuning */}
                {isLocal && (
                  <>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Base URL</label>
                      <input
                        type="text"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        placeholder="http://localhost:11434/v1"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Model</label>
                      <input
                        type="text"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        placeholder="llama3.2"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    {/* Inline setup instructions */}
                    {selectedPreset === 'Ollama' && (
                      <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg px-4 py-3 text-xs text-blue-300 space-y-1">
                        <p className="font-medium">Setup:</p>
                        <p>1. Install Ollama from <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-200">ollama.com</a></p>
                        <p>2. Run: <code className="bg-blue-900/40 px-1 rounded">ollama pull llama3.2</code></p>
                        <p>3. Ollama runs automatically on port 11434</p>
                      </div>
                    )}
                    {selectedPreset === 'LM Studio' && (
                      <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg px-4 py-3 text-xs text-blue-300 space-y-1">
                        <p className="font-medium">Setup:</p>
                        <p>1. Download from <a href="https://lmstudio.ai" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-200">lmstudio.ai</a></p>
                        <p>2. Load any GGUF model</p>
                        <p>3. Start the local server (port 1234)</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Privacy note */}
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-4 py-2.5 text-[11px] text-gray-500">
                Groq is free and requires no credit card. Ollama and LM Studio process your code locally without sending data to third parties.
              </div>

              {/* Test Connection + Save */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleTest}
                  disabled={testStatus === 'testing' || !baseUrl || !model}
                  className="px-4 py-2 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 rounded-lg border border-gray-700 transition-colors"
                >
                  {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
                </button>

                <button
                  onClick={handleSave}
                  className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  {saved ? 'Saved!' : 'Save'}
                </button>

                {testStatus === 'ok' && (
                  <span className="text-xs text-green-400">Connection OK</span>
                )}
                {testStatus === 'error' && (
                  <span className="text-xs text-red-400 truncate max-w-64" title={testError}>
                    {testError}
                  </span>
                )}
              </div>
            </>
          )}

          {!enabled && (
            <button
              onClick={handleSave}
              className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              {saved ? 'Saved!' : 'Save'}
            </button>
          )}
        </div>

        {/* Info section */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 text-xs text-gray-500 space-y-2">
          <p>
            <strong className="text-gray-400">Without AI:</strong> StackWatch uses semantic heuristics to detect
            services from your codebase. This covers ~80% of cases with zero configuration.
          </p>
          <p>
            <strong className="text-gray-400">With AI:</strong> Ambiguous evidences are sent to your chosen
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
