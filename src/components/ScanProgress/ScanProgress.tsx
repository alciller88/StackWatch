import { useStore } from '../../store/useStore';
import type { ScanProgressData } from '../../types';

export function ScanProgress() {
  const scanProgress = useStore((s) => s.scanProgress);
  const repoPath = useStore((s) => s.repoPath);
  const cancelScan = useStore((s) => s.cancelScan);

  if (!scanProgress) return null;

  const repoName = repoPath
    ? repoPath.startsWith('github:')
      ? repoPath.slice(7)
      : repoPath.split(/[\\/]/).pop() || repoPath
    : 'Unknown';

  const { phase, percent, counts } = scanProgress;

  return (
    <div
      data-testid="scan-progress"
      className="flex-1 flex items-center justify-center p-8"
      style={{ background: 'var(--color-bg-primary)' }}
    >
      <div className="w-full max-w-lg flex flex-col gap-6">
        {/* Repo name */}
        <div
          className="text-center font-mono text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {repoName}
        </div>

        {/* Progress bar */}
        <div
          className="relative h-6 overflow-hidden"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Scan progress: ${phase}`}
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 0,
            background: 'var(--color-bg-secondary)',
          }}
        >
          <div
            className="h-full transition-all duration-500 ease-out relative overflow-hidden"
            style={{
              width: `${percent}%`,
              background: 'var(--color-accent)',
              borderRadius: 0,
            }}
          >
            {/* CRT scan line effect */}
            <div className="scan-line-effect" />
          </div>
        </div>

        {/* Phase text with blinking cursor */}
        <div
          className="text-center font-mono text-sm"
          style={{ color: 'var(--color-text-primary)', fontSize: '14px' }}
          aria-live="polite"
        >
          {phase}
          {phase !== 'Done' && (
            <span className="blinking-cursor" style={{ color: 'var(--color-accent)' }}>
              {' \u2588'}
            </span>
          )}
        </div>

        {/* Counters */}
        <div
          className="text-center font-mono text-xs"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {counts.evidences} evidences &middot; {counts.services} services &middot; {counts.vulns} vulns
        </div>

        {/* Cancel button */}
        {phase !== 'Done' && (
          <div className="text-center mt-4">
            <button
              onClick={cancelScan}
              className="font-mono text-xs px-4 py-1.5 transition-colors cursor-pointer rounded-none bg-transparent text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-danger)] hover:border-[var(--color-danger)]"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Inline styles for animations */}
        <style>{`
          .blinking-cursor {
            animation: blink 1s step-end infinite;
          }
          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
          .scan-line-effect {
            position: absolute;
            top: 0;
            left: 0;
            width: 60px;
            height: 100%;
            background: linear-gradient(
              90deg,
              transparent,
              rgba(255, 255, 255, 0.15),
              transparent
            );
            animation: scanLine 1.5s linear infinite;
          }
          @keyframes scanLine {
            0% { transform: translateX(-60px); }
            100% { transform: translateX(calc(100vw)); }
          }
        `}</style>
      </div>
    </div>
  );
}
