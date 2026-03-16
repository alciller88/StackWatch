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

  it('renders cost when present', () => {
    const svc = { ...baseService, cost: { amount: 29, currency: 'USD', period: 'monthly' as const } }
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
    const svc = { ...baseService, renewalDate: future.toISOString().split('T')[0] }
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
})
