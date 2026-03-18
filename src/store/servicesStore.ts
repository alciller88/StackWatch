/**
 * Services state selectors — use these instead of useStore() in components
 * that only need service/dependency data, to avoid unnecessary re-renders.
 */
import { useStore } from './useStore'

/** Hook: select only services and score state */
export function useServicesState() {
  return useStore(s => ({
    services: s.services,
    dependencies: s.dependencies,
    stackScore: s.stackScore,
    healthChecks: s.healthChecks,
    scoreHistory: s.scoreHistory,
  }))
}

/** Hook: select only service CRUD actions */
export function useServicesActions() {
  return useStore(s => ({
    addManualService: s.addManualService,
    updateManualService: s.updateManualService,
    deleteManualService: s.deleteManualService,
    updateServiceConfidence: s.updateServiceConfidence,
    restoreDiscardedItem: s.restoreDiscardedItem,
    recalculateScore: s.recalculateScore,
  }))
}
