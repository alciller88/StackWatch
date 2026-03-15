import { useStore } from './store/useStore'
import { TopBar } from './components/TopBar/TopBar'
import { Sidebar } from './components/Sidebar/Sidebar'
import { Dashboard } from './components/Dashboard/Dashboard'
import { ServicesPanel } from './components/ServicesPanel/ServicesPanel'
import { DepsPanel } from './components/DepsPanel/DepsPanel'
import { FlowGraph } from './components/FlowGraph/FlowGraph'
import { Settings } from './components/Settings/Settings'

export default function App() {
  const { repoPath, activePanel, error, clearError } = useStore()

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
      default:
        return <Dashboard />
    }
  }

  return (
    <div className="h-full flex flex-col bg-gray-950 text-gray-100">
      <TopBar />
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <main className="flex-1 flex flex-col min-h-0 min-w-0">
          {error && (
            <div className="mx-4 mt-2 px-4 py-2 bg-red-900/50 border border-red-700 rounded-lg flex items-center justify-between">
              <span className="text-red-200 text-sm">{error}</span>
              <button
                onClick={clearError}
                className="text-red-400 hover:text-red-200 ml-4 text-sm"
              >
                ✕
              </button>
            </div>
          )}
          {renderPanel()}
        </main>
      </div>
    </div>
  )
}
