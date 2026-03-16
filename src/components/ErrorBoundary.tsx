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
      <div className="flex items-center justify-center h-full w-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] font-mono p-8">
        <div className="max-w-[480px] w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-8 text-center">
          <h1 className="text-xl font-semibold text-[var(--color-accent)] mb-3">
            Something went wrong
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mb-5 leading-relaxed">
            An unexpected error occurred. You can try reloading the application.
          </p>

          {this.state.error && (
            <pre className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-bg-tertiary)] border border-[var(--color-border-light)] rounded px-4 py-3 text-left overflow-x-auto whitespace-pre-wrap break-words mb-5">
              {this.state.error.name}: {this.state.error.message}
            </pre>
          )}

          <button
            onClick={this.handleReload}
            className="text-sm font-inherit font-medium text-[var(--color-bg-primary)] bg-[var(--color-accent)] border-none rounded px-6 py-2 cursor-pointer"
            aria-label="Reload application"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
