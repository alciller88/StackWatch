import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'

const STEPS = [
  {
    title: 'Welcome to StackWatch!',
    description:
      "We've scanned your project and found services, dependencies, and architecture data.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    title: 'Services Panel',
    description:
      'View all detected services. Click confidence badges to adjust. Add manual services for anything we missed.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
      </svg>
    ),
  },
  {
    title: 'Flow Graph',
    description:
      'Your architecture visualized. Right-click nodes to edit, drag to reposition, connect services with edges.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    title: 'Costs & Renewals',
    description:
      'Track spending by category. Set renewal dates to get alerts before services expire.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'AI Enhancement',
    description:
      'Enable AI in Settings to validate findings, remove false positives, and discover hidden services.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    title: 'Save & Restore',
    description:
      'Export your config to save all edits (costs, owners, graph layout). Import it later to restore everything. Scanning a repo always starts fresh from code.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
]

export const OnboardingTutorial: React.FC = () => {
  const { showTutorial, dismissTutorial } = useStore()
  const [step, setStep] = useState(0)
  const overlayRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const nextButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!showTutorial) return
    previousFocusRef.current = document.activeElement as HTMLElement | null
    requestAnimationFrame(() => {
      nextButtonRef.current?.focus()
    })
    return () => {
      previousFocusRef.current?.focus()
    }
  }, [showTutorial])

  useEffect(() => {
    if (!showTutorial) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismissTutorial()
        return
      }
      if (e.key === 'Tab') {
        const focusable = overlayRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (!focusable || focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [showTutorial, dismissTutorial])

  if (!showTutorial) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const isFirst = step === 0

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      aria-describedby="onboarding-desc"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === overlayRef.current) dismissTutorial()
      }}
    >
      <div
        className="w-full max-w-md shadow-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
      >
        {/* Step indicator */}
        <div
          className="px-5 py-3 flex items-center justify-between border-b border-[var(--color-border)]"
        >
          <span
            className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-accent)]"
          >
            Getting Started
          </span>
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className="h-1 rounded-full transition-all"
                style={{
                  width: i === step ? 16 : 6,
                  background: i === step ? 'var(--color-accent)' : 'var(--color-border)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-5 py-6">
          <div className="flex items-start gap-4">
            <div
              className="shrink-0 w-10 h-10 flex items-center justify-center text-[var(--color-accent)] border border-[var(--color-border)]"
            >
              {current.icon}
            </div>
            <div className="flex-1">
              <div className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] mb-1">
                Step {step + 1} of {STEPS.length}
              </div>
              <h3
                id="onboarding-title"
                className="font-mono text-sm font-medium text-[var(--color-text-primary)] mb-2"
              >
                {current.title}
              </h3>
              <p
                id="onboarding-desc"
                className="font-mono text-[11px] leading-relaxed text-[var(--color-text-secondary)]"
              >
                {current.description}
              </p>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div
          className="flex items-center justify-between px-5 py-3 border-t border-[var(--color-border)]"
        >
          <button
            onClick={dismissTutorial}
            className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-colors bg-transparent border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]"
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-colors bg-transparent border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
              >
                Back
              </button>
            )}
            <button
              ref={nextButtonRef}
              onClick={() => {
                if (isLast) {
                  dismissTutorial()
                } else {
                  setStep(step + 1)
                }
              }}
              className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-colors bg-[var(--color-accent)] border border-[var(--color-accent)] text-[var(--color-bg-primary)] hover:bg-[var(--color-accent-hover)]"
            >
              {isLast ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
