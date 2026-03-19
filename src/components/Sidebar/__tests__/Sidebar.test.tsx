import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sidebar } from '../Sidebar'

// Track the mock state so tests can manipulate it
const mockState: Record<string, any> = {
  activePanel: 'dashboard',
  services: [],
  stackScore: 0,
  healthChecks: [],
  repoPath: null,
  config: null,
  theme: 'dark',
  setActivePanel: vi.fn(),
  openScoreBreakdown: vi.fn(),
  openScoreHistory: vi.fn(),
  openDoctor: vi.fn(),
  toggleTheme: vi.fn(),
  closeStack: vi.fn(),
}

vi.mock('../../../store/useStore', () => ({
  useStore: vi.fn((selector?: any) => {
    if (typeof selector === 'function') return selector(mockState)
    return mockState
  }),
}))

let confirmResult = 'cancel'
vi.mock('../../../store/dialogStore', () => ({
  useDialogStore: () => ({
    confirm: vi.fn().mockImplementation(() => Promise.resolve(confirmResult)),
  }),
}))

vi.mock('../../../constants', () => ({ APP_VERSION: '0.12.0' }))

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.activePanel = 'dashboard'
    mockState.services = []
    mockState.repoPath = null
    mockState.config = null
    confirmResult = 'cancel'
  })

  it('always shows Dashboard nav item', () => {
    render(<Sidebar />)
    expect(screen.getByTestId('nav-dashboard')).toBeInTheDocument()
    expect(screen.getByText('Home')).toBeInTheDocument()
  })

  it('shows Dashboard as first nav item before Services', () => {
    render(<Sidebar />)
    const dashboard = screen.getByTestId('nav-dashboard')
    const services = screen.getByTestId('nav-services')
    // Dashboard should come before Services in DOM order
    expect(dashboard.compareDocumentPosition(services) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows Close Stack when project is loaded', () => {
    mockState.repoPath = '/test/repo'
    mockState.services = [{ id: 'svc', name: 'Test', category: 'other', plan: 'free', source: 'manual' }]
    render(<Sidebar />)
    expect(screen.getByTestId('close-stack')).toBeInTheDocument()
  })

  it('hides Close Stack when no project is loaded', () => {
    mockState.repoPath = null
    mockState.services = []
    mockState.config = null
    render(<Sidebar />)
    expect(screen.queryByTestId('close-stack')).not.toBeInTheDocument()
  })

  it('clicking Close Stack shows confirmation and calls closeStack on confirm', async () => {
    const user = userEvent.setup()
    mockState.repoPath = '/test/repo'
    confirmResult = 'close'
    render(<Sidebar />)

    await user.click(screen.getByTestId('close-stack'))

    expect(mockState.closeStack).toHaveBeenCalled()
  })

  it('clicking Close Stack then cancelling does not call closeStack', async () => {
    const user = userEvent.setup()
    mockState.repoPath = '/test/repo'
    confirmResult = 'cancel'
    render(<Sidebar />)

    await user.click(screen.getByTestId('close-stack'))

    expect(mockState.closeStack).not.toHaveBeenCalled()
  })
})
