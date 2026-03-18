/**
 * Configuration state selectors — use these instead of useStore() in components
 * that only need config/AI/budget data, to avoid unnecessary re-renders.
 */
import { useStore } from './useStore'

/** Hook: select only configuration state */
export function useConfigState() {
  return useStore(s => ({
    config: s.config,
    aiSettings: s.aiSettings,
    error: s.error,
  }))
}

/** Hook: select only configuration actions */
export function useConfigActions() {
  return useStore(s => ({
    loadConfig: s.loadConfig,
    saveConfig: s.saveConfig,
    importStandalone: s.importStandalone,
    loadAISettings: s.loadAISettings,
    saveAISettings: s.saveAISettings,
    testAIConnection: s.testAIConnection,
    setBudget: s.setBudget,
    clearError: s.clearError,
  }))
}
