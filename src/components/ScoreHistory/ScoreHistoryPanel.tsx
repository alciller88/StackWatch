import { useEffect, useRef, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useStore } from '../../store/useStore';
import type { ScoreHistoryEntry } from '../../types';

function formatDate(timestamp: string): string {
  const d = new Date(timestamp);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}/${day}`;
}

function formatFullDate(timestamp: string): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface ChartEntry extends ScoreHistoryEntry {
  dateLabel: string;
}

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartEntry }>;
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0].payload;
  const sourceLabel = entry.source === 'manual' ? 'Manual edit' : 'Scan';
  return (
    <div
      style={{
        background: 'var(--color-bg-tertiary)',
        border: '1px solid var(--color-border)',
        fontFamily: 'IBM Plex Mono',
        fontSize: 10,
        padding: '8px 10px',
      }}
    >
      <div style={{ color: 'var(--color-accent)', marginBottom: 4 }}>
        {formatFullDate(entry.timestamp)}
      </div>
      <div style={{ color: 'var(--color-text-primary)', marginBottom: 4 }}>
        Score: {entry.score}
      </div>
      <div style={{ color: 'var(--color-text-secondary)' }}>
        Cost: {entry.breakdown.servicesWithCost}% | Owner:{' '}
        {entry.breakdown.servicesWithOwner}%
      </div>
      <div style={{ color: 'var(--color-text-secondary)' }}>
        Reviewed: {entry.breakdown.servicesReviewed}% | Graph:{' '}
        {entry.breakdown.graphCompleteness}%
      </div>
      <div style={{ color: 'var(--color-text-secondary)', marginTop: 4 }}>
        {entry.serviceCount} services, {entry.depCount} deps
      </div>
      <div style={{ color: entry.source === 'manual' ? '#60a5fa' : '#e2b04a', marginTop: 4 }}>
        Source: {sourceLabel}
      </div>
    </div>
  );
};

// Custom dot: scan = solid gold circle, manual = blue circle with dashed border
const CustomDot = (props: { cx?: number; cy?: number; payload?: ChartEntry }) => {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return null;
  const isManual = payload.source === 'manual';
  return (
    <circle
      cx={cx}
      cy={cy}
      r={3}
      fill={isManual ? '#60a5fa' : '#e2b04a'}
      stroke={isManual ? '#60a5fa' : '#e2b04a'}
      strokeWidth={isManual ? 1.5 : 0}
      strokeDasharray={isManual ? '2 2' : undefined}
    />
  );
};

const CustomActiveDot = (props: { cx?: number; cy?: number; payload?: ChartEntry }) => {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return null;
  const isManual = payload.source === 'manual';
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={isManual ? '#60a5fa' : '#e2b04a'}
      stroke="#0d1017"
      strokeWidth={2}
    />
  );
};

export const ScoreHistoryPanel: React.FC = () => {
  const { scoreHistory, closeScoreHistory } = useStore();
  const overlayRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });
    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeScoreHistory();
        return;
      }
      if (e.key === 'Tab') {
        const focusable = overlayRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [closeScoreHistory]);

  const chartData: ChartEntry[] = useMemo(
    () =>
      scoreHistory.map((entry) => ({
        ...entry,
        dateLabel: formatDate(entry.timestamp),
      })),
    [scoreHistory]
  );

  const stats = useMemo(() => {
    if (scoreHistory.length === 0) return null;
    const scores = scoreHistory.map((e) => e.score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const latest = scores[scores.length - 1];
    const first = scores[0];
    const diff = latest - first;
    return { min, max, avg, latest, diff, count: scores.length };
  }, [scoreHistory]);

  const hasHistory = scoreHistory.length > 0;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="score-history-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === overlayRef.current) closeScoreHistory();
      }}
    >
      <div
        className="w-full max-w-2xl shadow-2xl"
        style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-3 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <h3
            id="score-history-title"
            className="font-mono text-[11px] uppercase tracking-widest"
            style={{ color: 'var(--color-accent)' }}
          >
            Stack Score History
          </h3>
          <button
            ref={closeButtonRef}
            onClick={closeScoreHistory}
            className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
            title="Close"
          >
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {!hasHistory ? (
            <div className="flex items-center justify-center py-12">
              <p
                className="font-mono text-[11px] tracking-wide"
                style={{ color: 'var(--color-text-muted)' }}
              >
                No scan history yet. Run a scan to start tracking.
              </p>
            </div>
          ) : (
            <>
              {/* Chart */}
              <div
                className="mb-4"
                style={{
                  background: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart
                    data={chartData}
                    margin={{ top: 16, right: 24, bottom: 8, left: 8 }}
                  >
                    <XAxis
                      dataKey="dateLabel"
                      tick={{
                        fill: 'var(--color-text-secondary)',
                        fontFamily: 'IBM Plex Mono',
                        fontSize: 10,
                      }}
                      axisLine={{ stroke: '#2a3040' }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{
                        fill: 'var(--color-text-secondary)',
                        fontFamily: 'IBM Plex Mono',
                        fontSize: 10,
                      }}
                      axisLine={{ stroke: '#2a3040' }}
                      tickLine={false}
                      width={30}
                    />
                    <Tooltip
                      content={<CustomTooltip />}
                      cursor={{ stroke: '#2a3040' }}
                    />
                    <ReferenceLine
                      y={80}
                      stroke="#22c55e"
                      strokeDasharray="4 4"
                      strokeOpacity={0.4}
                    />
                    <ReferenceLine
                      y={50}
                      stroke="#eab308"
                      strokeDasharray="4 4"
                      strokeOpacity={0.4}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#e2b04a"
                      strokeWidth={2}
                      dot={<CustomDot />}
                      activeDot={<CustomActiveDot />}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Stats */}
              {stats && (
                <>
                  {/* Latest score + trend */}
                  <div className="flex items-center gap-4 mb-4">
                    <div
                      className={`font-mono text-2xl font-bold ${
                        stats.latest >= 80
                          ? 'text-green-400'
                          : stats.latest >= 50
                            ? 'text-[var(--color-accent)]'
                            : 'text-red-400'
                      }`}
                    >
                      {stats.latest}
                    </div>
                    <div>
                      <div
                        className="font-mono text-[10px] uppercase tracking-widest"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        Latest Score
                      </div>
                      {stats.count > 1 && (
                        <div
                          className="font-mono text-[11px]"
                          style={{
                            color:
                              stats.diff > 0
                                ? '#22c55e'
                                : stats.diff < 0
                                  ? '#ef4444'
                                  : 'var(--color-text-muted)',
                          }}
                        >
                          {stats.diff > 0 ? '+' : ''}
                          {stats.diff} points over {stats.count} entries
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Min / Max / Avg cards */}
                  <div
                    className="grid grid-cols-3 gap-px"
                    style={{ background: 'var(--color-border)' }}
                  >
                    <div
                      className="p-3"
                      style={{ background: 'var(--color-bg-primary)' }}
                    >
                      <div
                        className="font-mono text-[10px] uppercase tracking-widest mb-1"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        Min
                      </div>
                      <div
                        className="font-mono text-sm font-medium"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {stats.min}
                      </div>
                    </div>
                    <div
                      className="p-3"
                      style={{ background: 'var(--color-bg-primary)' }}
                    >
                      <div
                        className="font-mono text-[10px] uppercase tracking-widest mb-1"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        Max
                      </div>
                      <div
                        className="font-mono text-sm font-medium"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {stats.max}
                      </div>
                    </div>
                    <div
                      className="p-3"
                      style={{ background: 'var(--color-bg-primary)' }}
                    >
                      <div
                        className="font-mono text-[10px] uppercase tracking-widest mb-1"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        Average
                      </div>
                      <div
                        className="font-mono text-sm font-medium"
                        style={{ color: 'var(--color-accent)' }}
                      >
                        {stats.avg}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex justify-end px-5 py-3"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <button
            onClick={closeScoreHistory}
            className="px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest transition-colors border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
