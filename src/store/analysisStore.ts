/**
 * Analysis state selectors — use these instead of useStore() in components
 * that only need analysis pipeline state, to avoid unnecessary re-renders.
 */
import { useStore } from './useStore'

/** Hook: select only analysis pipeline state */
export function useAnalysisState() {
  return useStore(s => ({
    isAnalyzing: s.isAnalyzing,
    analysisPhase: s.analysisPhase,
    scanProgress: s.scanProgress,
    repoPath: s.repoPath,
    mode: s.mode,
    flowNodes: s.flowNodes,
    flowEdges: s.flowEdges,
    discardedItems: s.discardedItems,
    vulnResults: s.vulnResults,
    vulnScanned: s.vulnScanned,
    deepAnalysis: s.deepAnalysis,
    scanDiffAdded: s.scanDiffAdded,
    scanDiffRemoved: s.scanDiffRemoved,
    linkStatus: s.linkStatus,
  }))
}

/** Hook: select only analysis actions */
export function useAnalysisActions() {
  return useStore(s => ({
    analyzeLocal: s.analyzeLocal,
    analyzeGitHub: s.analyzeGitHub,
    reanalyze: s.reanalyze,
    cancelScan: s.cancelScan,
    checkLinkStatus: s.checkLinkStatus,
    relinkLocal: s.relinkLocal,
    openFolder: s.openFolder,
  }))
}
