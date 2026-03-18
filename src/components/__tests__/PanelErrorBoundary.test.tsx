import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PanelErrorBoundary } from '../PanelErrorBoundary'

// Suppress React error boundary console.error in tests
const originalError = console.error
beforeEach(() => {
  console.error = vi.fn()
})

afterEach(() => {
  console.error = originalError
})

const ThrowingComponent = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  if (shouldThrow) throw new Error('Test render error')
  return <div>Working content</div>
}

describe('PanelErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <PanelErrorBoundary panelName="Test">
        <div>Hello</div>
      </PanelErrorBoundary>
    )
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('shows fallback UI when child throws', () => {
    render(
      <PanelErrorBoundary panelName="Flow Graph">
        <ThrowingComponent />
      </PanelErrorBoundary>
    )
    expect(screen.getByText('Flow Graph crashed')).toBeInTheDocument()
    expect(screen.getByText('Reload panel')).toBeInTheDocument()
    expect(screen.getByText('Report issue')).toBeInTheDocument()
  })

  it('renders custom fallback when provided', () => {
    render(
      <PanelErrorBoundary panelName="Test" fallback={<div>Custom fallback</div>}>
        <ThrowingComponent />
      </PanelErrorBoundary>
    )
    expect(screen.getByText('Custom fallback')).toBeInTheDocument()
  })

  it('reset button recovers the panel', () => {
    let shouldThrow = true
    const ToggleComponent = () => {
      if (shouldThrow) throw new Error('Test error')
      return <div>Recovered!</div>
    }

    const { rerender } = render(
      <PanelErrorBoundary panelName="Test">
        <ToggleComponent />
      </PanelErrorBoundary>
    )

    expect(screen.getByText('Test crashed')).toBeInTheDocument()

    // Stop throwing, then click reload
    shouldThrow = false
    fireEvent.click(screen.getByText('Reload panel'))

    // Force re-render after state reset
    rerender(
      <PanelErrorBoundary panelName="Test">
        <ToggleComponent />
      </PanelErrorBoundary>
    )

    expect(screen.getByText('Recovered!')).toBeInTheDocument()
  })

  it('error in one panel does not affect sibling', () => {
    render(
      <div>
        <PanelErrorBoundary panelName="Broken">
          <ThrowingComponent />
        </PanelErrorBoundary>
        <PanelErrorBoundary panelName="Working">
          <div>I am fine</div>
        </PanelErrorBoundary>
      </div>
    )

    expect(screen.getByText('Broken crashed')).toBeInTheDocument()
    expect(screen.getByText('I am fine')).toBeInTheDocument()
  })
})
