import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TopBar } from '../TopBar'

const mockStore = {
  repoPath: null as string | null,
  services: [] as any[],
  dependencies: [] as any[],
  config: null,
  isAnalyzing: false,
  analysisPhase: null as string | null,
  aiSettings: null,
  linkStatus: 'unknown' as 'linked' | 'unlinked' | 'unknown',
  openFolder: vi.fn(),
  analyzeLocal: vi.fn(),
  analyzeGitHub: vi.fn(),
  reanalyze: vi.fn(),
  checkLinkStatus: vi.fn(),
  relinkLocal: vi.fn(),
  saveConfig: vi.fn(),
  importStandalone: vi.fn(),
  error: null as string | null,
  clearError: vi.fn(),
}

vi.mock('../../../store/useStore', () => ({
  useStore: vi.fn(() => mockStore),
}))

vi.mock('../../../store/dialogStore', () => ({
  useDialogStore: vi.fn(() => ({
    confirm: vi.fn(),
  })),
}))

// Mock window.stackwatch
Object.defineProperty(window, 'stackwatch', {
  value: {
    exportConfig: vi.fn(),
    exportServicesMd: vi.fn(),
  },
  writable: true,
})

describe('TopBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.repoPath = null
    mockStore.services = []
    mockStore.isAnalyzing = false
    mockStore.error = null
    mockStore.linkStatus = 'unknown'
    mockStore.analysisPhase = null
  })

  it('renders import button', () => {
    render(<TopBar />)
    expect(screen.getByText('Import')).toBeInTheDocument()
  })

  it('renders export button', () => {
    render(<TopBar />)
    expect(screen.getByText('Export')).toBeInTheDocument()
  })

  it('shows "No repository loaded" when no repo', () => {
    render(<TopBar />)
    expect(screen.getByText('No repository loaded')).toBeInTheDocument()
  })

  it('shows repo path when loaded', () => {
    mockStore.repoPath = '/home/user/project'
    render(<TopBar />)
    expect(screen.getByText('/home/user/project')).toBeInTheDocument()
  })

  it('shows error banner when error exists', () => {
    mockStore.error = 'Something went wrong'
    render(<TopBar />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('calls importStandalone when Import clicked', async () => {
    const user = userEvent.setup()
    render(<TopBar />)
    await user.click(screen.getByText('Import'))
    expect(mockStore.importStandalone).toHaveBeenCalled()
  })

  it('disables buttons during analysis', () => {
    mockStore.isAnalyzing = true
    render(<TopBar />)
    expect(screen.getByText('Import').closest('button')).toBeDisabled()
  })

  it('shows analyzing phase text', () => {
    mockStore.isAnalyzing = true
    mockStore.repoPath = '/some/path'
    mockStore.analysisPhase = 'Scanning repository...'
    render(<TopBar />)
    expect(screen.getByText('Scanning repository...')).toBeInTheDocument()
  })

  it('shows Re-analyze button when repo is loaded', () => {
    mockStore.repoPath = '/some/path'
    render(<TopBar />)
    expect(screen.getByText('Re-analyze')).toBeInTheDocument()
  })

  it('shows Share button when services exist', () => {
    mockStore.services = [{ id: '1', name: 'Test', category: 'hosting', plan: 'free', source: 'inferred' }]
    render(<TopBar />)
    expect(screen.getByText('Share')).toBeInTheDocument()
  })

  it('shows link status when repo loaded and linked', () => {
    mockStore.repoPath = '/some/path'
    mockStore.linkStatus = 'linked'
    render(<TopBar />)
    expect(screen.getByText('Linked')).toBeInTheDocument()
  })

  it('shows unlinked with re-link button', () => {
    mockStore.repoPath = '/some/path'
    mockStore.linkStatus = 'unlinked'
    render(<TopBar />)
    expect(screen.getByText('Unlinked')).toBeInTheDocument()
    expect(screen.getByText('Re-link')).toBeInTheDocument()
  })

  it('clears error when x clicked', async () => {
    const user = userEvent.setup()
    mockStore.error = 'Test error'
    render(<TopBar />)
    await user.click(screen.getByText('x'))
    expect(mockStore.clearError).toHaveBeenCalled()
  })
})
