import React from 'react'

interface PanelErrorBoundaryProps {
  panelName: string
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface PanelErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class PanelErrorBoundary extends React.Component<PanelErrorBoundaryProps, PanelErrorBoundaryState> {
  constructor(props: PanelErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): PanelErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[PanelErrorBoundary:${this.props.panelName}]`, error, info.componentStack)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  private handleReport = () => {
    const url = 'https://github.com/alciller88/StackWatch/issues'
    if (window.stackwatch?.openExternalUrl) {
      window.stackwatch.openExternalUrl(url)
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    if (this.props.fallback) {
      return this.props.fallback
    }

    const isDev = import.meta.env.DEV

    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-[400px] w-full text-center space-y-4">
          <div className="text-[var(--color-danger)] text-3xl">&#9888;</div>
          <h2 className="font-mono text-sm uppercase tracking-widest text-[var(--color-text-primary)]">
            {this.props.panelName} crashed
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
            {isDev && this.state.error
              ? `${this.state.error.name}: ${this.state.error.message}`
              : 'An unexpected error occurred in this panel. Other panels are unaffected.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={this.handleReset}
              className="px-4 py-1.5 font-mono text-[11px] uppercase tracking-widest border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)] rounded-none transition-colors"
            >
              Reload panel
            </button>
            <button
              onClick={this.handleReport}
              className="px-4 py-1.5 font-mono text-[11px] uppercase tracking-widest border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-secondary)] rounded-none transition-colors"
            >
              Report issue
            </button>
          </div>
        </div>
      </div>
    )
  }
}
