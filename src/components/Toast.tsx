import { useToastStore } from '../store/toastStore'

const typeStyles = {
  success: { border: 'var(--color-success-muted)', text: 'var(--color-success)', icon: '✓' },
  error: { border: 'var(--color-danger-muted)', text: 'var(--color-danger)', icon: '✕' },
  info: { border: 'var(--color-border)', text: 'var(--color-text-secondary)', icon: 'ℹ' },
}

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2" style={{ maxWidth: 320 }}>
      {toasts.map((toast) => {
        const style = typeStyles[toast.type]
        return (
          <div
            key={toast.id}
            className="flex items-center gap-2 px-3 py-2 font-mono text-[11px] shadow-lg animate-in"
            style={{
              background: 'var(--color-bg-secondary)',
              border: `1px solid ${style.border}`,
              color: style.text,
            }}
            role="status"
            aria-live="polite"
          >
            <span className="shrink-0">{style.icon}</span>
            <span className="flex-1" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
