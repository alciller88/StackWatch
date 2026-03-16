import React from 'react';
import { useStore } from '../../store/useStore';

export const Dashboard: React.FC = () => {
  const { openFolder, isAnalyzing } = useStore();

  return (
    <div
      className="flex-1 flex items-center justify-center p-8"
      style={{
        backgroundImage: 'linear-gradient(#1a2130 1px, transparent 1px), linear-gradient(90deg, #1a2130 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }}
    >
      <div className="text-center max-w-md">
        {/* Icon with corner brackets */}
        <div className="relative mb-6 flex justify-center">
          <div style={{ width: 52, height: 52, border: '1px solid var(--color-border)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ position:'absolute', top:-3, left:-3, width:8, height:8, borderTop:'1px solid var(--color-accent)', borderLeft:'1px solid var(--color-accent)' }} />
            <span style={{ position:'absolute', top:-3, right:-3, width:8, height:8, borderTop:'1px solid var(--color-accent)', borderRight:'1px solid var(--color-accent)' }} />
            <span style={{ position:'absolute', bottom:-3, left:-3, width:8, height:8, borderBottom:'1px solid var(--color-accent)', borderLeft:'1px solid var(--color-accent)' }} />
            <span style={{ position:'absolute', bottom:-3, right:-3, width:8, height:8, borderBottom:'1px solid var(--color-accent)', borderRight:'1px solid var(--color-accent)' }} />
            <svg
              className="w-6 h-6"
              style={{ color: 'var(--color-accent)' }}
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
          Welcome to <span style={{ color: 'var(--color-accent)' }}>Stack</span>Watch
        </h1>

        {/* Description */}
        <p className="font-mono text-[11px] tracking-wide text-[var(--color-text-muted)] mb-2">
          Visualize and monitor all the services, dependencies, and external
          accounts your project relies on.
        </p>
        <p className="font-mono text-[11px] tracking-wide text-[var(--color-text-muted)] mb-8">
          Open a local repository or connect to GitHub to automatically detect
          your project&apos;s tech stack, services, and infrastructure.
        </p>

        {/* CTA */}
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

        <p className="font-mono text-[10px] tracking-wide text-[var(--color-text-muted)] mt-3">
          Or use the GitHub button in the top bar to analyze a remote repository
        </p>

        {/* Demo CTA */}
        <div className="mt-5 pt-5 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <button
            onClick={openFolder}
            disabled={isAnalyzing}
            className="inline-flex items-center gap-2 px-5 py-2 bg-transparent border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] disabled:opacity-50 disabled:cursor-not-allowed font-mono text-[10px] uppercase tracking-widest rounded-none transition-all"
            aria-label="Try demo by scanning a local project"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Try Demo
          </button>
          <p className="font-mono text-[9px] tracking-wide text-[var(--color-text-muted)] mt-2" style={{ opacity: 0.7 }}>
            Scan any local project to see StackWatch in action
          </p>
        </div>

        {/* Features */}
        <div className="mt-10 grid grid-cols-3 gap-px text-left" style={{ background: 'var(--color-border)' }}>
          <div className="p-4" style={{ background: 'var(--color-bg-secondary)' }}>
            <div className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] mb-1.5">01 · SERVICES</div>
            <h3 className="font-sans text-[12px] font-medium text-[var(--color-text-secondary)] mb-1">Services</h3>
            <p className="font-mono text-[10px] text-[var(--color-text-muted)]">
              Detect hosting, payments, auth, and more from your codebase.
            </p>
          </div>
          <div className="p-4" style={{ background: 'var(--color-bg-secondary)' }}>
            <div className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] mb-1.5">02 · DEPS</div>
            <h3 className="font-sans text-[12px] font-medium text-[var(--color-text-secondary)] mb-1">Dependencies</h3>
            <p className="font-mono text-[10px] text-[var(--color-text-muted)]">
              Browse all packages with version, type, and ecosystem info.
            </p>
          </div>
          <div className="p-4" style={{ background: 'var(--color-bg-secondary)' }}>
            <div className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] mb-1.5">03 · GRAPH</div>
            <h3 className="font-sans text-[12px] font-medium text-[var(--color-text-secondary)] mb-1">Flow Graph</h3>
            <p className="font-mono text-[10px] text-[var(--color-text-muted)]">
              Interactive architecture diagram of your app data flow.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
