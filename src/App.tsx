import { useStore } from './store/useStore'
import { useDialogStore } from './store/dialogStore'
import { TopBar } from './components/TopBar/TopBar'
import { Sidebar } from './components/Sidebar/Sidebar'
import { Dashboard } from './components/Dashboard/Dashboard'
import { ServicesPanel } from './components/ServicesPanel/ServicesPanel'
import { DepsPanel } from './components/DepsPanel/DepsPanel'
import { FlowGraph } from './components/FlowGraph/FlowGraph'
import { Settings } from './components/Settings/Settings'
import { CostsPanel } from './components/CostsPanel/CostsPanel'
import { TitleBar } from './components/TitleBar'
import { ConfirmDialog } from './components/ConfirmDialog'
import { ErrorBoundary } from './components/ErrorBoundary'

export default function App() {
  const { repoPath, activePanel } = useStore()
  const dialog = useDialogStore()

  const renderPanel = () => {
    if (activePanel === 'settings') return <Settings />
    if (!repoPath) return <Dashboard />
    switch (activePanel) {
      case 'services':
        return <ServicesPanel />
      case 'dependencies':
        return <DepsPanel />
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
        {dialog.current && (
          <ConfirmDialog
            title={dialog.current.title}
            message={dialog.current.message}
            detail={dialog.current.detail}
            buttons={dialog.current.buttons}
            onResult={dialog.close}
          />
        )}
      </div>
    </ErrorBoundary>
  )
}
