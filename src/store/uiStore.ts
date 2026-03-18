/**
 * UI state selectors — use these instead of useStore() in components
 * that only need UI state, to avoid unnecessary re-renders.
 */
import { useStore } from './useStore'

/** Hook: select only UI state */
export function useUIState() {
  return useStore(s => ({
    activePanel: s.activePanel,
    theme: s.theme,
    showScoreHistory: s.showScoreHistory,
    showScoreBreakdown: s.showScoreBreakdown,
    showDoctor: s.showDoctor,
    showTutorial: s.showTutorial,
    hasSeenTutorial: s.hasSeenTutorial,
  }))
}

/** Hook: select only UI actions */
export function useUIActions() {
  return useStore(s => ({
    setActivePanel: s.setActivePanel,
    setTheme: s.setTheme,
    toggleTheme: s.toggleTheme,
    openScoreHistory: s.openScoreHistory,
    closeScoreHistory: s.closeScoreHistory,
    openScoreBreakdown: s.openScoreBreakdown,
    closeScoreBreakdown: s.closeScoreBreakdown,
    openDoctor: s.openDoctor,
    closeDoctor: s.closeDoctor,
    dismissTutorial: s.dismissTutorial,
    loadDemo: s.loadDemo,
    initBlankStack: s.initBlankStack,
  }))
}
