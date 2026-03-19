import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NodeEditPanel } from '../NodeEditPanel'
import type { FlowNode, ServiceBilling } from '../../../types'

describe('NodeEditPanel', () => {
  const defaultInitial = {
    label: 'Redis',
    nodeType: 'database' as FlowNode['type'],
    category: 'database' as const,
    plan: 'paid' as const,
    confidence: 'medium' as const,
    url: 'https://redis.io',
    note: 'Primary cache',
    billing: undefined as ServiceBilling | undefined,
  }

  it('renders with initial data', () => {
    render(
      <NodeEditPanel
        x={100}
        y={100}
        initialData={defaultInitial}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByDisplayValue('Redis')).toBeInTheDocument()
    expect(screen.getByDisplayValue('https://redis.io')).toBeInTheDocument()
  })

  it('calls onSave with updated confidence', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(
      <NodeEditPanel
        x={100}
        y={100}
        initialData={defaultInitial}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    )

    // Change confidence to high
    const confidenceSelect = screen.getByDisplayValue('medium')
    await user.selectOptions(confidenceSelect, 'high')

    // Click save
    await user.click(screen.getByText('Save'))

    expect(onSave).toHaveBeenCalledTimes(1)
    const savedData = onSave.mock.calls[0][0]
    expect(savedData.confidence).toBe('high')
    expect(savedData.label).toBe('Redis')
  })

  it('calls onCancel when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(
      <NodeEditPanel
        x={100}
        y={100}
        initialData={defaultInitial}
        onSave={vi.fn()}
        onCancel={onCancel}
      />
    )

    await user.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('calls onCancel on Escape key', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(
      <NodeEditPanel
        x={100}
        y={100}
        initialData={defaultInitial}
        onSave={vi.fn()}
        onCancel={onCancel}
      />
    )

    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalled()
  })

  it('does not call onSave with empty label', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(
      <NodeEditPanel
        x={100}
        y={100}
        initialData={{ ...defaultInitial, label: '' }}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    )

    await user.click(screen.getByText('Save'))
    expect(onSave).not.toHaveBeenCalled()
  })
})
