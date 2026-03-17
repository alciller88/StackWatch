import { useEffect, useCallback } from 'react'
import { useStore } from './store/useStore'
import { useDialogStore } from './store/dialogStore'
import { useHistoryStore } from './store/historyStore'
import { useGraphStore } from './store/graphStore'
import { TopBar } from './components/TopBar/TopBar'
import { Sidebar } from './components/Sidebar/Sidebar'
import { Dashboard } from './components/Dashboard/Dashboard'
import { ServicesPanel } from './components/ServicesPanel/ServicesPanel'
import { DepsPanel } from './components/DepsPanel/DepsPanel'
import { DiscardedPanel } from './components/DiscardedPanel/DiscardedPanel'
import { FlowGraph } from './components/FlowGraph/FlowGraph'
import { Settings } from './components/Settings/Settings'
import { CostsPanel } from './components/CostsPanel/CostsPanel'
import { TitleBar } from './components/TitleBar'
import { ToastContainer } from './components/Toast'
import { ConfirmDialog } from './components/ConfirmDialog'
import { ErrorBoundary } from './components/ErrorBoundary'
import { OnboardingTutorial } from './components/OnboardingTutorial'
import { ScoreHistoryPanel } from './components/ScoreHistory/ScoreHistoryPanel'
import { DoctorModal } from './components/Doctor/DoctorModal'
import { ServicesPanelSkeleton, DepsPanelSkeleton, DiscardedPanelSkeleton, FlowGraphSkeleton, CostsPanelSkeleton } from './components/Skeleton'
import { useTheme } from './hooks/useTheme'

export default function App() {
  const { repoPath, activePanel, showTutorial, showScoreHistory, showDoctor, services, config, isAnalyzing } = useStore()
  useTheme()
  const dialog = useDialogStore()

  const handleUndoRedo = useCallback((e: KeyboardEvent) => {
    // Only handle Ctrl+Z / Ctrl+Shift+Z (or Cmd on Mac)
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return
    // Don't intercept when typing in input/textarea
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

    e.preventDefault()
    const history = useHistoryStore.getState()
    const graphState = useGraphStore.getState()
    const currentServices = useStore.getState().services
    const current = { nodes: graphState.nodes, edges: graphState.edges, services: currentServices }

    const snapshot = e.shiftKey ? history.redo(current) : history.undo(current)
    if (!snapshot) return

    // Restore graph state
    useGraphStore.setState({ nodes: snapshot.nodes, edges: snapshot.edges })
    // Restore services
    useStore.setState({ services: snapshot.services })
    // Persist
    graphState.persistToConfig()
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleUndoRedo)
    return () => window.removeEventListener('keydown', handleUndoRedo)
  }, [handleUndoRedo])

  const renderPanel = () => {
    if (activePanel === 'settings') return <Settings />
    const hasData = !!repoPath || services.length > 0 || !!config
    if (!hasData && !isAnalyzing) return <Dashboard />

    // Show skeletons during initial analysis (no data yet)
    if (isAnalyzing && !hasData) {
      switch (activePanel) {
        case 'services': return <ServicesPanelSkeleton />
        case 'dependencies': return <DepsPanelSkeleton />
        case 'discarded': return <DiscardedPanelSkeleton />
        case 'flow': return <FlowGraphSkeleton />
        case 'costs': return <CostsPanelSkeleton />
        default: return <Dashboard />
      }
    }

    switch (activePanel) {
      case 'services':
        return <ServicesPanel />
      case 'dependencies':
        return <DepsPanel />
      case 'discarded':
        return <DiscardedPanel />
      case 'flow':
        return <FlowGraph />
      case 'costs':
        return <CostsPanel />
      default:
        return <Dashboard />
    }
  }

  return (
    <ErrorBoundary>
      <div className="h-full flex flex-col" style={{ background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
        <TitleBar />
        <TopBar />
        <div className="flex-1 flex min-h-0">
          <Sidebar />
          <main className="flex-1 flex flex-col min-h-0 min-w-0">
            {renderPanel()}
          </main>
        </div>
        {showTutorial && <OnboardingTutorial />}
        {showScoreHistory && <ScoreHistoryPanel />}
        {showDoctor && <DoctorModal />}
        {dialog.current && (
          <ConfirmDialog
            title={dialog.current.title}
            message={dialog.current.message}
            detail={dialog.current.detail}
            buttons={dialog.current.buttons}
            onResult={dialog.close}
          />
        )}
        <ToastContainer />
      </div>
    </ErrorBoundary>
  )
}
