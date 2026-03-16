import { useState, useEffect, useCallback } from 'react'

export const TitleBar: React.FC = () => {
  const [maximized, setMaximized] = useState(false)

  const updateMaximized = useCallback(async () => {
    if (window.stackwatch) {
      setMaximized(await window.stackwatch.windowIsMaximized())
    }
  }, [])

  useEffect(() => {
    updateMaximized()
    window.addEventListener('resize', updateMaximized)
    return () => window.removeEventListener('resize', updateMaximized)
  }, [updateMaximized])

  return (
    <div
      className="titlebar-drag flex items-center h-8 shrink-0 select-none"
      style={{
        background: 'var(--color-bg-primary)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {/* App title */}
      <div className="flex items-center gap-2 px-3">
        <span
          className="font-mono text-[9px] uppercase tracking-[0.2em] font-medium"
          style={{ color: 'var(--color-accent)' }}
        >
          StackWatch
        </span>
      </div>

      <div className="flex-1" />

      {/* Window controls */}
      <div className="titlebar-no-drag flex h-full">
        <button
          onClick={() => window.stackwatch?.windowMinimize()}
          className="h-full px-3 flex items-center justify-center transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
          aria-label="Minimize"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 5h8" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>

        <button
          onClick={() => {
            window.stackwatch?.windowMaximize()
            setTimeout(updateMaximized, 50)
          }}
          className="h-full px-3 flex items-center justify-center transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
          aria-label={maximized ? 'Restore' : 'Maximize'}
        >
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3 1h6v6M1 3h6v6" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="1" y="1" width="8" height="8" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          )}
        </button>

        <button
          onClick={() => window.stackwatch?.windowClose()}
          className="h-full px-3 flex items-center justify-center transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] text-[var(--color-text-secondary)] hover:bg-[#c05050] hover:text-white"
          aria-label="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>
    </div>
  )
}
