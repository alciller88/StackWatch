import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DiscardedItem } from '../../../types'

const mockRestoreDiscardedItem = vi.fn()

const mockItems: DiscardedItem[] = [
  {
    name: 'Lodash',
    reason: 'low_score',
    score: 1,
    evidences: [{ type: 'reason', value: 'npm package lodash', file: '' }],
    category: 'other',
  },
  {
    name: 'OAuth2',
    reason: 'ai_filter',
    score: 0,
    evidences: [{ type: 'reason', value: 'AI flagged as generic concept', file: '' }],
    category: 'auth',
  },
  {
    name: 'Database',
    reason: 'generic_term',
    score: 7,
    evidences: [{ type: 'reason', value: 'env var DATABASE_URL', file: '' }],
    category: 'database',
  },
]

let currentItems: DiscardedItem[] = mockItems

vi.mock('../../../store/useStore', () => ({
  useStore: vi.fn((selector) => {
    const state = {
      discardedItems: currentItems,
      restoreDiscardedItem: mockRestoreDiscardedItem,
    }
    return typeof selector === 'function' ? selector(state) : state
  }),
}))

// Mock react-virtual to render all items directly (jsdom has no layout)
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn(({ count }) => ({
    getTotalSize: () => count * 52,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        key: i,
        index: i,
        start: i * 52,
        size: 52,
      })),
    measureElement: () => {},
  })),
}))

import { DiscardedPanel } from '../DiscardedPanel'

describe('DiscardedPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentItems = mockItems
  })

  it('renders all discarded items', () => {
    render(<DiscardedPanel />)
    expect(screen.getByText('Lodash')).toBeInTheDocument()
    expect(screen.getByText('OAuth2')).toBeInTheDocument()
    expect(screen.getByText('Database')).toBeInTheDocument()
  })

  it('shows item count in header', () => {
    render(<DiscardedPanel />)
    expect(screen.getByText('Discarded (3)')).toBeInTheDocument()
  })

  it('shows reason badges', () => {
    render(<DiscardedPanel />)
    expect(screen.getByText('Low score')).toBeInTheDocument()
    expect(screen.getByText('AI filtered')).toBeInTheDocument()
    expect(screen.getByText('Generic term')).toBeInTheDocument()
  })

  it('shows restore buttons for each item', () => {
    render(<DiscardedPanel />)
    const restoreButtons = screen.getAllByText('Restore')
    expect(restoreButtons.length).toBe(3)
  })

  it('calls restoreDiscardedItem when restore button clicked', async () => {
    const user = userEvent.setup()
    render(<DiscardedPanel />)
    const restoreButtons = screen.getAllByText('Restore')
    await user.click(restoreButtons[0])
    expect(mockRestoreDiscardedItem).toHaveBeenCalledWith(mockItems[0])
  })

  it('shows scores for each item', () => {
    render(<DiscardedPanel />)
    expect(screen.getByText('score: 1')).toBeInTheDocument()
    expect(screen.getByText('score: 0')).toBeInTheDocument()
    expect(screen.getByText('score: 7')).toBeInTheDocument()
  })

  it('shows empty state when no items', () => {
    currentItems = []
    render(<DiscardedPanel />)
    expect(screen.getByText('No discarded items')).toBeInTheDocument()
  })
})
