import { useEffect, useRef } from 'react'

export interface ConfirmDialogProps {
  title: string
  message: string
  detail?: string
  buttons: Array<{
    label: string
    value: string
    danger?: boolean
    primary?: boolean
  }>
  onResult: (value: string) => void
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  detail,
  buttons,
  onResult,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const cancel = buttons.find(b => b.value === 'cancel') ?? buttons[buttons.length - 1]
        onResult(cancel.value)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [buttons, onResult])

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(2px)' }}
      onClick={(e) => {
        if (e.target === overlayRef.current) {
          const cancel = buttons.find(b => b.value === 'cancel') ?? buttons[buttons.length - 1]
          onResult(cancel.value)
        }
      }}
    >
      <div
        className="w-full max-w-sm shadow-2xl"
        style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-3"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <h3
            className="font-mono text-[10px] uppercase tracking-widest"
            style={{ color: 'var(--color-accent)' }}
          >
            {title}
          </h3>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p
            className="text-sm leading-relaxed"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {message}
          </p>
          {detail && (
            <p
              className="text-xs mt-2 leading-relaxed"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {detail}
            </p>
          )}
        </div>

        {/* Buttons */}
        <div
          className="flex justify-end gap-2 px-5 py-3"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          {buttons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => onResult(btn.value)}
              className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest rounded-sm transition-colors"
              style={
                btn.danger
                  ? {
                      background: 'transparent',
                      border: '1px solid #c05050',
                      color: '#c05050',
                    }
                  : btn.primary
                    ? {
                        background: 'var(--color-accent)',
                        border: '1px solid var(--color-accent)',
                        color: 'var(--color-bg-primary)',
                      }
                    : {
                        background: 'transparent',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-secondary)',
                      }
              }
              onMouseEnter={(e) => {
                if (btn.danger) {
                  e.currentTarget.style.background = '#c05050'
                  e.currentTarget.style.color = '#fff'
                } else if (btn.primary) {
                  e.currentTarget.style.background = 'var(--color-accent-hover)'
                } else {
                  e.currentTarget.style.borderColor = 'var(--color-accent)'
                  e.currentTarget.style.color = 'var(--color-accent)'
                }
              }}
              onMouseLeave={(e) => {
                if (btn.danger) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = '#c05050'
                } else if (btn.primary) {
                  e.currentTarget.style.background = 'var(--color-accent)'
                } else {
                  e.currentTarget.style.borderColor = 'var(--color-border)'
                  e.currentTarget.style.color = 'var(--color-text-secondary)'
                }
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
