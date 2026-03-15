import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import type { AIProvider, AISettings } from '../../types';

const PRESET_PROVIDERS: AIProvider[] = [
  { name: 'Ollama (local, free)', baseUrl: 'http://localhost:11434/v1', model: 'llama3.2' },
  { name: 'LM Studio (local, free)', baseUrl: 'http://localhost:1234/v1', model: 'local-model' },
  { name: 'Groq (fast, free tier)', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.1-8b-instant' },
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { name: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', model: 'mistral-small-latest' },
  { name: 'Custom', baseUrl: '', model: '' },
];

const LOCAL_PROVIDERS = new Set(['Ollama (local, free)', 'LM Studio (local, free)']);

export const Settings: React.FC = () => {
  const { aiSettings, loadAISettings, saveAISettings, testAIConnection } = useStore();
  const [enabled, setEnabled] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('Ollama (local, free)');
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434/v1');
  const [model, setModel] = useState('llama3.2');
  const [apiKey, setApiKey] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [testError, setTestError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadAISettings();
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
    const preset = PRESET_PROVIDERS.find(p => p.name === name);
    if (preset) {
      setBaseUrl(preset.baseUrl);
      setModel(preset.model);
      if (LOCAL_PROVIDERS.has(name)) {
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

  const isLocal = LOCAL_PROVIDERS.has(selectedPreset);
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
              {/* Provider Selection */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Provider</label>
                <select
                  value={selectedPreset}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
                >
                  {PRESET_PROVIDERS.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* API Key (hidden for local providers) */}
              {!isLocal && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              {/* Base URL (editable for Custom, visible for fine-tuning) */}
              {(isCustom || isLocal) && (
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
              )}

              {/* Model */}
              {(isCustom || isLocal) && (
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
              )}

              {/* Local provider note */}
              {isLocal && (
                <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg px-4 py-3 text-xs text-blue-300">
                  {selectedPreset.split(' (')[0]} is free and processes your code locally without sending data to third parties.
                </div>
              )}

              {/* Test Connection + Save */}
              <div className="flex items-center gap-3 pt-2">
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
