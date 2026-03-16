import React from 'react';
import { useStore } from '../../store/useStore';

export const Dashboard: React.FC = () => {
  const { openFolder, loadDemo, isAnalyzing, analyzeLocal, services } = useStore();
  const lastRepo = localStorage.getItem('stackwatch-last-repo');

  return (
    <div
      className="flex-1 flex items-start justify-center p-8 overflow-y-auto"
      style={{
        backgroundImage: 'linear-gradient(#1a2130 1px, transparent 1px), linear-gradient(90deg, #1a2130 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }}
    >
      <div className="text-center max-w-2xl w-full my-auto py-8">
        {/* Last project banner */}
        {lastRepo && services.length === 0 && (
          <div className="flex items-center gap-3 px-4 py-3 mb-6 border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <span className="font-mono text-[11px] text-[var(--color-text-muted)] truncate flex-1 text-left">
              Last project: {lastRepo}
            </span>
            <button
              onClick={() => analyzeLocal(lastRepo)}
              disabled={isAnalyzing}
              className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest bg-[var(--color-accent)] text-[var(--color-bg-primary)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 transition-colors"
            >
              Reopen
            </button>
          </div>
        )}

        {/* Icon with corner brackets */}
        <div className="relative mb-6 flex justify-center">
          <div className="relative flex items-center justify-center w-[52px] h-[52px] border border-[var(--color-border)]">
            <span className="absolute -top-[3px] -left-[3px] w-2 h-2 border-t border-l border-[var(--color-accent)]" />
            <span className="absolute -top-[3px] -right-[3px] w-2 h-2 border-t border-r border-[var(--color-accent)]" />
            <span className="absolute -bottom-[3px] -left-[3px] w-2 h-2 border-b border-l border-[var(--color-accent)]" />
            <span className="absolute -bottom-[3px] -right-[3px] w-2 h-2 border-b border-r border-[var(--color-accent)]" />
            <svg
              className="w-6 h-6 text-[var(--color-accent)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 className="font-mono text-base font-medium tracking-wide uppercase text-[var(--color-text-primary)] mb-2">
          Welcome to <span className="text-[var(--color-accent)]">Stack</span>Watch
        </h1>

        {/* Description */}
        <p className="font-mono text-[11px] tracking-wide text-[var(--color-text-muted)] mb-2">
          Visualize and monitor all the services, dependencies, and external
          accounts your project relies on.
        </p>
        <p className="font-mono text-[11px] tracking-wide text-[var(--color-text-muted)] mb-6">
          Open a local repository or connect to GitHub to automatically detect
          your project&apos;s tech stack, services, and infrastructure.
        </p>

        {/* CTA Buttons */}
        <div className="flex items-center justify-center gap-4 mb-2">
          <button
            onClick={openFolder}
            disabled={isAnalyzing}
            className="inline-flex items-center gap-2 px-7 py-2.5 bg-transparent border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)] disabled:opacity-50 disabled:cursor-not-allowed font-mono text-[11px] uppercase tracking-widest rounded-none transition-all"
          >
            {isAnalyzing ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Analyzing...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
                Open a Repository
              </>
            )}
          </button>

          <button
            onClick={loadDemo}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-transparent border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] font-mono text-[11px] uppercase tracking-widest rounded-none transition-all"
            aria-label="Explore demo with sample data"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Explore Demo
          </button>
        </div>

        <p className="font-mono text-[10px] tracking-wide text-[var(--color-text-muted)] mb-10">
          Or use the GitHub button in the top bar to analyze a remote repository
        </p>

        {/* Quick Start */}
        <div className="mb-10">
          <div
            className="text-left px-6 py-5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
          >
            <h2 className="font-mono text-[10px] uppercase tracking-widest mb-4 text-[var(--color-accent)]">
              Quick Start
            </h2>
            <div className="space-y-3">
              {[
                { num: '01', text: 'Open a local folder or connect a GitHub repo' },
                { num: '02', text: 'Review detected services, dependencies, and costs' },
                { num: '03', text: 'Visualize your architecture in the flow graph' },
              ].map((step) => (
                <div key={step.num} className="flex items-start gap-3">
                  <span
                    className="font-mono text-[10px] font-medium shrink-0 w-6 h-6 flex items-center justify-center text-[var(--color-accent)] border border-[var(--color-border)]"
                  >
                    {step.num}
                  </span>
                  <span className="font-mono text-[11px] text-[var(--color-text-secondary)] leading-relaxed pt-0.5">
                    {step.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mb-10">
          <h2 className="font-mono text-[10px] uppercase tracking-widest mb-4 text-left text-[var(--color-accent)]">
            Features
          </h2>
          <div className="grid grid-cols-3 gap-px text-left bg-[var(--color-border)]">
            {[
              {
                num: '01',
                label: 'SERVICES',
                title: 'Services',
                desc: 'Detect hosting, payments, auth, and more from your codebase.',
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                  </svg>
                ),
              },
              {
                num: '02',
                label: 'DEPS',
                title: 'Dependencies',
                desc: 'Browse all packages with version, type, and ecosystem info.',
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                ),
              },
              {
                num: '03',
                label: 'GRAPH',
                title: 'Flow Graph',
                desc: 'Interactive architecture diagram of your app data flow.',
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
              },
              {
                num: '04',
                label: 'COSTS',
                title: 'Costs & Renewals',
                desc: 'Track spending by category with renewal date alerts.',
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
              },
              {
                num: '05',
                label: 'AI',
                title: 'AI Analysis',
                desc: 'Validate findings and discover hidden services with AI.',
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                ),
              },
              {
                num: '06',
                label: 'DATA',
                title: 'Import / Export',
                desc: 'Scan = fresh from code. Import = restore all your edits.',
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                ),
              },
            ].map((feat) => (
              <div key={feat.num} className="p-4 bg-[var(--color-bg-secondary)]">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[var(--color-text-muted)]">{feat.icon}</span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">
                    {feat.num} · {feat.label}
                  </span>
                </div>
                <h3 className="font-sans text-[12px] font-medium text-[var(--color-text-secondary)] mb-1">{feat.title}</h3>
                <p className="font-mono text-[10px] text-[var(--color-text-muted)]">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Keyboard Shortcuts */}
        <div className="text-left">
          <div
            className="px-6 py-5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
          >
            <h2 className="font-mono text-[10px] uppercase tracking-widest mb-4 text-[var(--color-accent)]">
              Keyboard Shortcuts
            </h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              {[
                { key: 'Esc', desc: 'Close dialogs and modals' },
                { key: 'Right-click', desc: 'Context menu in flow graph' },
                { key: 'Double-click', desc: 'Edit nodes in flow graph' },
                { key: 'Drag', desc: 'Reposition nodes on canvas' },
              ].map((shortcut) => (
                <div key={shortcut.key} className="flex items-center gap-3">
                  <kbd
                    className="font-mono text-[9px] px-1.5 py-0.5 shrink-0 text-[var(--color-accent)] border border-[var(--color-border)] bg-[var(--color-bg-primary)]"
                  >
                    {shortcut.key}
                  </kbd>
                  <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                    {shortcut.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
