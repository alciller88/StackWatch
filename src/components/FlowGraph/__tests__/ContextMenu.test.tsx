import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContextMenu } from '../ContextMenu'
import type { MenuEntry } from '../ContextMenu'

describe('ContextMenu', () => {
  const baseItems: MenuEntry[] = [
    { label: 'Edit', icon: '✏️', onClick: vi.fn() },
    { label: 'Delete', icon: '🗑️', onClick: vi.fn(), danger: true },
  ]

  it('renders menu items', () => {
    render(<ContextMenu x={100} y={100} items={baseItems} onClose={vi.fn()} />)
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('has role="menu" on container', () => {
    render(<ContextMenu x={100} y={100} items={baseItems} onClose={vi.fn()} />)
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('has role="menuitem" on items', () => {
    render(<ContextMenu x={100} y={100} items={baseItems} onClose={vi.fn()} />)
    const menuItems = screen.getAllByRole('menuitem')
    expect(menuItems).toHaveLength(2)
  })

  it('calls onClick and onClose when item clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const onClose = vi.fn()
    const items: MenuEntry[] = [{ label: 'Edit', onClick }]

    render(<ContextMenu x={100} y={100} items={items} onClose={onClose} />)
    await user.click(screen.getByText('Edit'))

    expect(onClick).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('closes on Escape key', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<ContextMenu x={100} y={100} items={baseItems} onClose={onClose} />)

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('renders dividers', () => {
    const items: MenuEntry[] = [
      { label: 'Edit', onClick: vi.fn() },
      { divider: true },
      { label: 'Delete', onClick: vi.fn(), danger: true },
    ]
    render(<ContextMenu x={100} y={100} items={items} onClose={vi.fn()} />)
    // divider + 2 items
    const menuItems = screen.getAllByRole('menuitem')
    expect(menuItems).toHaveLength(2)
  })

  it('shows active state', () => {
    const items: MenuEntry[] = [
      { label: 'Data', onClick: vi.fn(), active: true },
      { label: 'Auth', onClick: vi.fn() },
    ]
    render(<ContextMenu x={100} y={100} items={items} onClose={vi.fn()} />)
    const dataItem = screen.getByText('Data').closest('button')
    expect(dataItem?.className).toContain('text-[var(--color-accent)]')
  })
})
