import React from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * React error boundary that catches rendering errors and shows a
 * styled fallback UI. If Sentry is loaded, the error is forwarded
 * to Sentry.captureException automatically.
 *
 * Usage: wrap any React subtree with <ErrorBoundary>.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)

    // Forward to Sentry if the SDK is loaded
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any
    if (win.__SENTRY__ && typeof win.Sentry?.captureException === 'function') {
      win.Sentry.captureException(error, { contexts: { react: { componentStack: info.componentStack } } })
    }
  }

  private handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Something went wrong</h1>
          <p style={styles.subtitle}>
            An unexpected error occurred. You can try reloading the application.
          </p>

          {this.state.error && (
            <pre style={styles.details}>
              {this.state.error.name}: {this.state.error.message}
            </pre>
          )}

          <button
            onClick={this.handleReload}
            style={styles.button}
            aria-label="Reload application"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}

/* ------------------------------------------------------------------ */
/*  Inline styles using CSS custom properties from the app theme      */
/* ------------------------------------------------------------------ */
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: '100%',
    background: 'var(--color-bg-primary)',
    color: 'var(--color-text-primary)',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    padding: '2rem',
  },
  card: {
    maxWidth: '480px',
    width: '100%',
    background: 'var(--color-bg-secondary)',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    padding: '2rem',
    textAlign: 'center' as const,
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: 'var(--color-accent)',
    margin: '0 0 0.75rem',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: 'var(--color-text-secondary)',
    margin: '0 0 1.25rem',
    lineHeight: 1.5,
  },
  details: {
    fontSize: '0.75rem',
    color: 'var(--color-text-secondary)',
    background: 'var(--color-bg-tertiary)',
    border: '1px solid var(--color-border-light)',
    borderRadius: '4px',
    padding: '0.75rem 1rem',
    textAlign: 'left' as const,
    overflowX: 'auto' as const,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    margin: '0 0 1.25rem',
  },
  button: {
    fontSize: '0.85rem',
    fontFamily: 'inherit',
    fontWeight: 500,
    color: 'var(--color-bg-primary)',
    background: 'var(--color-accent)',
    border: 'none',
    borderRadius: '4px',
    padding: '0.5rem 1.5rem',
    cursor: 'pointer',
  },
}
