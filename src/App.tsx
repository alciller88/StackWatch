import { useState, useEffect, useCallback } from 'react'
import { useStore } from './store/useStore'
import { useToastStore } from './store/toastStore'
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
import { PanelErrorBoundary } from './components/PanelErrorBoundary'
import { OnboardingTutorial } from './components/OnboardingTutorial'
import { ScoreHistoryPanel } from './components/ScoreHistory/ScoreHistoryPanel'
import { ScoreBreakdown } from './components/ScoreBreakdown/ScoreBreakdown'
import { DoctorModal } from './components/Doctor/DoctorModal'
import { ScanProgress } from './components/ScanProgress/ScanProgress'
import { ServicesPanelSkeleton, DepsPanelSkeleton, DiscardedPanelSkeleton, FlowGraphSkeleton, CostsPanelSkeleton } from './components/Skeleton'
import { useTheme } from './hooks/useTheme'
import { useStylesStore } from './store/stylesStore'

export default function App() {
  const { repoPath, activePanel, showTutorial, showScoreHistory, showScoreBreakdown, showDoctor, services, config, isAnalyzing, scanProgress } = useStore()
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

  // Load style overrides on startup
  const theme = useStore(s => s.theme)
  useEffect(() => {
    const stylesStore = useStylesStore.getState()
    // Theme overrides from localStorage
    const stored = localStorage.getItem('stackwatch-theme-overrides')
    if (stored) {
      try {
        stylesStore.loadThemeOverrides(JSON.parse(stored))
      } catch {
        console.warn('[App] Failed to parse stored theme overrides')
      }
    }
    // Graph styles from config
    const graphStyles = config?.graphStyles
    if (graphStyles) {
      stylesStore.loadGraphStyles(graphStyles)
    }
    stylesStore.applyStyles(theme as 'dark' | 'light')
  // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time init on mount, config may not be loaded yet
  }, [])

  // Re-apply styles when theme changes
  useEffect(() => {
    useStylesStore.getState().applyStyles(theme as 'dark' | 'light')
  }, [theme])

  // Load graph styles when config loads (e.g. after scan)
  useEffect(() => {
    if (config?.graphStyles) {
      const stylesStore = useStylesStore.getState()
      stylesStore.loadGraphStyles(config.graphStyles)
      stylesStore.applyStyles(theme as 'dark' | 'light')
    }
  }, [config?.graphStyles, theme])

  // ── Drag & drop folder to scan ──
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounter = useCallback(() => {
    let count = 0
    return {
      inc: () => { count++; return count },
      dec: () => { count--; return count },
      reset: () => { count = 0 },
    }
  }, [])()

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (dragCounter.inc() === 1) setIsDragOver(true)
  }, [dragCounter])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (dragCounter.dec() === 0) setIsDragOver(false)
  }, [dragCounter])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    dragCounter.reset()

    const file = e.dataTransfer.files[0]
    if (!file) return

    // Use Electron webUtils.getPathForFile() exposed via preload (File.path is deprecated in Electron 35)
    let filePath: string | undefined
    try {
      filePath = window.stackwatch?.getPathForFile(file)
    } catch {
      // Fallback for environments where getPathForFile is not available
      filePath = (file as any).path as string | undefined
    }
    if (!filePath) {
      useToastStore.getState().addToast('Could not read folder path — try using "Open a Repository" instead', 'error')
      return
    }

    const { isAnalyzing } = useStore.getState()
    if (isAnalyzing) {
      useToastStore.getState().addToast('A scan is already in progress', 'error')
      return
    }

    useStore.getState().analyzeLocal(filePath)
  }, [dragCounter])

  const renderPanel = () => {
    // Show scan progress screen when actively scanning — takes priority over any panel
    if (isAnalyzing && scanProgress) return <ScanProgress />

    if (activePanel === 'dashboard') return <Dashboard />
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
        return <PanelErrorBoundary panelName="Services"><ServicesPanel /></PanelErrorBoundary>
      case 'dependencies':
        return <PanelErrorBoundary panelName="Dependencies"><DepsPanel /></PanelErrorBoundary>
      case 'discarded':
        return <PanelErrorBoundary panelName="Discarded"><DiscardedPanel /></PanelErrorBoundary>
      case 'flow':
        return <PanelErrorBoundary panelName="Flow Graph"><FlowGraph /></PanelErrorBoundary>
      case 'costs':
        return <PanelErrorBoundary panelName="Costs"><CostsPanel /></PanelErrorBoundary>
      default:
        return <Dashboard />
    }
  }

  return (
    <ErrorBoundary>
      <div
        className="h-full flex flex-col relative"
        style={{ background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <TitleBar />
        <TopBar />
        <div className="flex-1 flex min-h-0">
          <Sidebar />
          <main className="flex-1 flex flex-col min-h-0 min-w-0">
            {renderPanel()}
          </main>
        </div>
        {/* Drag & drop overlay */}
        {isDragOver && (
          <div
            className="absolute inset-0 z-[100] flex items-center justify-center pointer-events-none"
            style={{
              background: 'rgba(0, 0, 0, 0.6)',
              border: '3px dashed var(--color-accent)',
            }}
          >
            <div className="font-mono text-sm uppercase tracking-widest" style={{ color: 'var(--color-accent)' }}>
              Drop to scan
            </div>
          </div>
        )}
        {showTutorial && <OnboardingTutorial />}
        {showScoreHistory && <ScoreHistoryPanel />}
        {showScoreBreakdown && <ScoreBreakdown />}
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
