import React, { useState, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useStore } from '../../store/useStore'
import type { DiscardedItem } from '../../types'

const REASON_LABELS: Record<DiscardedItem['reason'], string> = {
  low_score: 'Low score',
  ai_filter: 'AI filtered',
  generic_term: 'Generic term',
}

const REASON_COLORS: Record<DiscardedItem['reason'], string> = {
  low_score: 'bg-[var(--color-badge-bg-warning)] text-[var(--color-accent)] border-[var(--color-badge-border-warning)]',
  ai_filter: 'bg-[#1a2a3a] text-[#4a8ab0] border-[#2a4a6a]',
  generic_term: 'bg-[#1a1a2a] text-[#8a7ab0] border-[#3a3a6a]',
}

export const DiscardedPanel: React.FC = () => {
  const { discardedItems, restoreDiscardedItem } = useStore()
  const [search, setSearch] = useState('')
  const [filterReason, setFilterReason] = useState<DiscardedItem['reason'] | 'all'>('all')
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const parentRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    let items = discardedItems
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(d => d.name.toLowerCase().includes(q))
    }
    if (filterReason !== 'all') {
      items = items.filter(d => d.reason === filterReason)
    }
    return items
  }, [discardedItems, search, filterReason])

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => expandedIdx === i ? 140 : 52,
    overscan: 10,
  })

  const reasonCounts = useMemo(() => {
    const counts: Record<string, number> = { low_score: 0, ai_filter: 0, generic_term: 0 }
    for (const d of discardedItems) counts[d.reason] = (counts[d.reason] ?? 0) + 1
    return counts
  }, [discardedItems])

  if (discardedItems.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
        <div className="text-center space-y-2">
          <p className="font-mono text-sm" style={{ color: 'var(--color-text-secondary)' }}>No discarded items</p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Run an analysis to see items filtered during detection.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0" style={{ background: 'var(--color-bg-primary)' }}>
      {/* Header */}
      <div className="px-6 py-4 border-b space-y-3" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-sm font-medium uppercase tracking-widest" style={{ color: 'var(--color-text-primary)' }}>
            Discarded ({discardedItems.length})
          </h2>
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search discarded items..."
            aria-label="Search discarded items"
            className="w-full pl-10 pr-4 py-2 font-mono text-sm border rounded-none"
            style={{
              background: 'var(--color-bg-primary)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>

        {/* Reason filter */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterReason('all')}
            className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border transition-colors ${
              filterReason === 'all'
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]'
            }`}
          >
            All ({discardedItems.length})
          </button>
          {(['low_score', 'ai_filter', 'generic_term'] as const).map(reason => (
            <button
              key={reason}
              onClick={() => setFilterReason(filterReason === reason ? 'all' : reason)}
              className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border transition-colors ${
                filterReason === reason
                  ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                  : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]'
              }`}
            >
              {REASON_LABELS[reason]} ({reasonCounts[reason] ?? 0})
            </button>
          ))}
        </div>
      </div>

      {/* Virtualized list */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map(virtualRow => {
            const item = filtered[virtualRow.index]
            const isExpanded = expandedIdx === virtualRow.index

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div
                  className="px-6 py-3 border-b"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div className="flex items-center gap-3">
                    {/* Name */}
                    <button
                      onClick={() => setExpandedIdx(isExpanded ? null : virtualRow.index)}
                      className="flex items-center gap-2 min-w-0 text-left"
                    >
                      <svg
                        className={`w-3 h-3 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="font-mono text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>
                        {item.name}
                      </span>
                    </button>

                    {/* Score */}
                    <span className="font-mono text-[10px] shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                      score: {item.score}
                    </span>

                    {/* Category */}
                    {item.category && (
                      <span className="font-mono text-[10px] shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                        {item.category}
                      </span>
                    )}

                    {/* Reason badge */}
                    <span className={`px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider border shrink-0 ${REASON_COLORS[item.reason]}`}>
                      {REASON_LABELS[item.reason]}
                    </span>

                    {/* Restore button */}
                    <button
                      onClick={() => restoreDiscardedItem(item)}
                      className="ml-auto px-2 py-1 text-[10px] font-mono uppercase tracking-wider border transition-colors shrink-0 border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                      title="Restore as manual service"
                    >
                      Restore
                    </button>
                  </div>

                  {/* Expanded evidence */}
                  {isExpanded && item.evidences.length > 0 && (
                    <div className="mt-2 pl-5 space-y-1">
                      {item.evidences.map((ev, i) => (
                        <div key={i} className="font-mono text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                          <span style={{ color: 'var(--color-text-secondary)' }}>{ev.value}</span>
                          {ev.file && <span className="ml-2 opacity-60">{ev.file}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
