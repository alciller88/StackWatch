import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ScanProgressData } from '../../../types'

const mockCancelScan = vi.fn()

let currentProgress: ScanProgressData | null = null
let currentRepoPath: string | null = '/home/user/my-project'

vi.mock('../../../store/useStore', () => ({
  useStore: vi.fn((selector) => {
    const state = {
      scanProgress: currentProgress,
      repoPath: currentRepoPath,
      cancelScan: mockCancelScan,
    }
    return typeof selector === 'function' ? selector(state) : state
  }),
}))

import { ScanProgress } from '../ScanProgress'

describe('ScanProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentProgress = null
    currentRepoPath = '/home/user/my-project'
  })

  it('renders nothing when scanProgress is null', () => {
    currentProgress = null
    const { container } = render(<ScanProgress />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the correct phase text', () => {
    currentProgress = {
      phase: 'Extracting evidences...',
      percent: 20,
      counts: { evidences: 150, services: 0, vulns: 0 },
    }
    render(<ScanProgress />)
    expect(screen.getByText(/Extracting evidences\.\.\./)).toBeTruthy()
  })

  it('displays repo name from local path', () => {
    currentProgress = {
      phase: 'Initializing...',
      percent: 5,
      counts: { evidences: 0, services: 0, vulns: 0 },
    }
    currentRepoPath = '/home/user/my-project'
    render(<ScanProgress />)
    expect(screen.getByText('my-project')).toBeTruthy()
  })

  it('displays repo name from GitHub path', () => {
    currentProgress = {
      phase: 'Initializing...',
      percent: 5,
      counts: { evidences: 0, services: 0, vulns: 0 },
    }
    currentRepoPath = 'github:owner/repo'
    render(<ScanProgress />)
    expect(screen.getByText('owner/repo')).toBeTruthy()
  })

  it('shows evidence and service counts', () => {
    currentProgress = {
      phase: 'Classifying services...',
      percent: 40,
      counts: { evidences: 847, services: 23, vulns: 0 },
    }
    render(<ScanProgress />)
    expect(screen.getByText(/847 evidences/)).toBeTruthy()
    expect(screen.getByText(/23 services/)).toBeTruthy()
    expect(screen.getByText(/0 vulns/)).toBeTruthy()
  })

  it('shows Cancel button during active phases', () => {
    currentProgress = {
      phase: 'Extracting evidences...',
      percent: 20,
      counts: { evidences: 50, services: 0, vulns: 0 },
    }
    render(<ScanProgress />)
    expect(screen.getByText('Cancel')).toBeTruthy()
  })

  it('Cancel button calls cancelScan', async () => {
    currentProgress = {
      phase: 'Extracting evidences...',
      percent: 20,
      counts: { evidences: 50, services: 0, vulns: 0 },
    }
    render(<ScanProgress />)
    await userEvent.click(screen.getByText('Cancel'))
    expect(mockCancelScan).toHaveBeenCalledOnce()
  })

  it('hides Cancel button when phase is Done', () => {
    currentProgress = {
      phase: 'Done',
      percent: 100,
      counts: { evidences: 300, services: 12, vulns: 0 },
    }
    render(<ScanProgress />)
    expect(screen.queryByText('Cancel')).toBeNull()
  })

  it('hides blinking cursor when phase is Done', () => {
    currentProgress = {
      phase: 'Done',
      percent: 100,
      counts: { evidences: 300, services: 12, vulns: 0 },
    }
    render(<ScanProgress />)
    expect(screen.queryByText('\u2588', { exact: false })).toBeNull()
  })
})
