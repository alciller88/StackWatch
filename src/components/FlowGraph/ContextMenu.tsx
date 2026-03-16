import { useEffect, useRef, useCallback } from 'react'

export interface MenuItem {
  label: string
  icon?: string
  onClick: () => void
  active?: boolean
  danger?: boolean
}

export interface MenuDivider {
  divider: true
}

export type MenuEntry = MenuItem | MenuDivider

interface ContextMenuProps {
  x: number
  y: number
  items: MenuEntry[]
  onClose: () => void
}

function isDivider(entry: MenuEntry): entry is MenuDivider {
  return 'divider' in entry
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const ref = useRef<HTMLDivElement>(null)

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) {
        onClose()
      }
    },
    [onClose],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleClickOutside, handleKeyDown])

  // Clamp position so the menu doesn't overflow the container
  const style: React.CSSProperties = {
    position: 'absolute',
    left: x,
    top: y,
    zIndex: 50,
  }

  return (
    <div
      ref={ref}
      style={{ ...style, background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 0 }}
      className="min-w-[200px] py-1 font-mono text-[11px]"
    >
      {items.map((entry, i) => {
        if (isDivider(entry)) {
          return <div key={i} style={{ borderTop: '1px solid var(--color-border)', margin: '4px 0' }} />
        }
        return (
          <button
            key={i}
            onClick={() => {
              entry.onClick()
              onClose()
            }}
            className={`w-full text-left px-3 py-1.5 flex items-center gap-2 transition-colors ${
              entry.active
                ? 'text-[var(--color-accent)]'
                : entry.danger
                  ? 'text-[#c05050] hover:bg-[var(--color-bg-hover)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
            }`}
            style={entry.active ? { background: 'var(--color-bg-hover)' } : undefined}
          >
            {entry.icon && <span className="w-5 text-center">{entry.icon}</span>}
            <span>{entry.label}</span>
          </button>
        )
      })}
    </div>
  )
}
