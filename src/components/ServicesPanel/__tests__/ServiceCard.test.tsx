import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ServiceCard } from '../ServiceCard'
import type { Service } from '../../../types'

// Mock useStore
vi.mock('../../../store/useStore', () => ({
  useStore: vi.fn((selector) => {
    const state = {
      updateServiceConfidence: vi.fn(),
    }
    return typeof selector === 'function' ? selector(state) : state
  }),
}))

const baseService: Service = {
  id: 'test-svc',
  name: 'Test Service',
  category: 'hosting',
  plan: 'paid',
  source: 'inferred',
  confidence: 'high',
}

describe('ServiceCard', () => {
  it('renders service name and category', () => {
    render(<ServiceCard service={baseService} />)
    expect(screen.getByText('Test Service')).toBeInTheDocument()
    expect(screen.getByText('hosting')).toBeInTheDocument()
  })

  it('renders plan badge', () => {
    render(<ServiceCard service={baseService} />)
    expect(screen.getByText('paid')).toBeInTheDocument()
  })

  it('renders billing amount when present', () => {
    const svc = { ...baseService, billing: { type: 'manual' as const, period: 'monthly' as const, amount: 29, currency: 'USD' } }
    render(<ServiceCard service={svc} />)
    expect(screen.getByText('USD 29')).toBeInTheDocument()
    expect(screen.getByText('/ monthly')).toBeInTheDocument()
  })

  it('renders owner when present', () => {
    const svc = { ...baseService, owner: 'DevOps Team' }
    render(<ServiceCard service={svc} />)
    expect(screen.getByText('DevOps Team')).toBeInTheDocument()
  })

  it('renders renewal date with days left', () => {
    // Set a future date within 30 days so "(Xd left)" shows
    const future = new Date()
    future.setDate(future.getDate() + 10)
    const nextDate = future.toISOString().split('T')[0]
    const svc = { ...baseService, billing: { type: 'manual' as const, period: 'monthly' as const, amount: 10, nextDate } }
    render(<ServiceCard service={svc} />)
    expect(screen.getByText(/10d left/)).toBeInTheDocument()
  })

  it('calls onEdit when clicked', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    render(<ServiceCard service={baseService} onEdit={onEdit} />)

    await user.click(screen.getByRole('button', { name: /Test Service/i }))
    expect(onEdit).toHaveBeenCalledWith(baseService)
  })

  it('is keyboard accessible when editable', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    render(<ServiceCard service={baseService} onEdit={onEdit} />)

    const card = screen.getByRole('button', { name: /Test Service/i })
    card.focus()
    await user.keyboard('{Enter}')
    expect(onEdit).toHaveBeenCalledWith(baseService)
  })

  it('shows confidence badge', () => {
    const lowSvc = { ...baseService, confidence: 'low' as const }
    render(<ServiceCard service={lowSvc} />)
    expect(screen.getByText(/incomplete/)).toBeInTheDocument()
  })

  it('renders notes when present', () => {
    const svc = { ...baseService, notes: 'Important note here' }
    render(<ServiceCard service={svc} />)
    expect(screen.getByText('Important note here')).toBeInTheDocument()
  })

  it('renders inferred from info', () => {
    const svc = { ...baseService, inferredFrom: 'package.json' }
    render(<ServiceCard service={svc} />)
    expect(screen.getByText(/package\.json/)).toBeInTheDocument()
  })

  it('renders evidence info button when evidenceSummary is present', () => {
    const svc = {
      ...baseService,
      evidenceSummary: [
        { type: 'env_var', value: 'STRIPE_KEY found in .env', file: '.env', score: 7 },
        { type: 'npm_package', value: 'npm package stripe', file: '', score: 1 },
      ],
    }
    render(<ServiceCard service={svc} />)
    expect(screen.getByLabelText('Evidence details')).toBeInTheDocument()
  })

  it('does not render evidence button for manual services', () => {
    const svc = { ...baseService, source: 'manual' as const, evidenceSummary: [{ type: 'env_var', value: 'test', file: '', score: 5 }] }
    render(<ServiceCard service={svc} />)
    expect(screen.queryByLabelText('Evidence details')).not.toBeInTheDocument()
  })

  describe('needsReview ? button and popover', () => {
    it('shows ? button when needsReview is true', () => {
      const svc = {
        ...baseService,
        confidence: 'medium' as const,
        needsReview: true,
        confidenceReasons: ['Low evidence score'],
      }
      render(<ServiceCard service={svc} />)
      expect(screen.getByLabelText('Evidence details')).toBeInTheDocument()
    })

    it('shows confidenceReasons in popover when ? is clicked', async () => {
      const user = userEvent.setup()
      const svc = {
        ...baseService,
        confidence: 'medium' as const,
        needsReview: true,
        confidenceReasons: ['Low evidence score', 'Generic category'],
      }
      render(<ServiceCard service={svc} />)
      await user.click(screen.getByLabelText('Evidence details'))
      expect(screen.getByText('Low evidence score')).toBeInTheDocument()
      expect(screen.getByText('Generic category')).toBeInTheDocument()
    })

    it('shows generic message in popover when confidenceReasons is empty', async () => {
      const user = userEvent.setup()
      const svc = {
        ...baseService,
        confidence: 'low' as const,
        needsReview: true,
        confidenceReasons: [],
      }
      render(<ServiceCard service={svc} />)
      await user.click(screen.getByLabelText('Evidence details'))
      expect(screen.getByText('Review confidence and category')).toBeInTheDocument()
    })

    it('does not show ? button when needsReview is false and no evidence', () => {
      const svc = {
        ...baseService,
        confidence: 'high' as const,
        needsReview: false,
      }
      render(<ServiceCard service={svc} />)
      expect(screen.queryByLabelText('Evidence details')).not.toBeInTheDocument()
    })
  })
})
