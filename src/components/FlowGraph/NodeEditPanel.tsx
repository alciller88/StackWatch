import { useState, useEffect, useRef, useCallback } from 'react'
import { SERVICE_CATEGORIES } from '../../types'
import type { FlowNode, ServiceCategory } from '../../types'

const NODE_TYPES: FlowNode['type'][] = ['layer', 'cdn', 'api', 'database', 'external']

const CATEGORIES = SERVICE_CATEGORIES;

const PLANS = ['free', 'paid', 'trial', 'unknown'] as const
const CONFIDENCES = ['high', 'medium', 'low'] as const

interface NodeEditPanelProps {
  x: number
  y: number
  initialData: {
    label: string
    nodeType: FlowNode['type']
    category?: ServiceCategory
    plan?: string
    confidence?: 'high' | 'medium' | 'low'
    url?: string
    note?: string
  }
  onSave: (data: {
    label: string
    nodeType: FlowNode['type']
    category?: ServiceCategory
    plan?: 'free' | 'paid' | 'trial' | 'unknown'
    confidence?: 'high' | 'medium' | 'low'
    url?: string
    note?: string
  }) => void
  onCancel: () => void
}

export const NodeEditPanel: React.FC<NodeEditPanelProps> = ({
  x,
  y,
  initialData,
  onSave,
  onCancel,
}) => {
  const [label, setLabel] = useState(initialData.label)
  const [nodeType, setNodeType] = useState<FlowNode['type']>(initialData.nodeType)
  const [category, setCategory] = useState<ServiceCategory>(initialData.category ?? 'other')
  const [plan, setPlan] = useState(initialData.plan ?? 'unknown')
  const [confidence, setConfidence] = useState<'high' | 'medium' | 'low'>(initialData.confidence ?? 'high')
  const [url, setUrl] = useState(initialData.url ?? '')
  const [note, setNote] = useState(initialData.note ?? '')

  const ref = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    },
    [onCancel],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleSave = () => {
    if (!label.trim()) return
    onSave({
      label: label.trim(),
      nodeType,
      category,
      plan: plan as 'free' | 'paid' | 'trial' | 'unknown',
      confidence,
      url: url.trim() || undefined,
      note: note.trim() || undefined,
    })
  }

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--color-bg-primary)',
    border: '1px solid var(--color-border)',
    borderRadius: 0,
    padding: '4px 8px',
    color: 'var(--color-text-primary)',
    fontSize: '11px',
    fontFamily: 'IBM Plex Mono',
    outline: 'none',
  }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-label="Edit node"
      style={{
        position: 'absolute',
        left: Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 1280) - 280),
        top: Math.min(y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 500),
        zIndex: 50,
        width: 256,
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 0,
        padding: 12,
        fontFamily: 'IBM Plex Mono',
        fontSize: '11px',
      }}
    >
      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', marginBottom: 8 }}>Edit Node</div>

      <div className="space-y-2">
        <div>
          <label style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', display: 'block', marginBottom: 2 }}>Name</label>
          <input
            style={fieldStyle}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            onFocus={(e) => (e.target.style.borderColor = 'var(--color-accent)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
          />
        </div>

        <div>
          <label style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', display: 'block', marginBottom: 2 }}>Node type</label>
          <select style={fieldStyle} value={nodeType} onChange={(e) => setNodeType(e.target.value as FlowNode['type'])}>
            {NODE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', display: 'block', marginBottom: 2 }}>Service category</label>
          <select style={fieldStyle} value={category} onChange={(e) => setCategory(e.target.value as ServiceCategory)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', display: 'block', marginBottom: 2 }}>Plan</label>
          <select style={fieldStyle} value={plan} onChange={(e) => setPlan(e.target.value)}>
            {PLANS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', display: 'block', marginBottom: 2 }}>Confidence</label>
          <select style={fieldStyle} value={confidence} onChange={(e) => setConfidence(e.target.value as 'high' | 'medium' | 'low')}>
            {CONFIDENCES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', display: 'block', marginBottom: 2 }}>URL</label>
          <input
            style={fieldStyle}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            onFocus={(e) => (e.target.style.borderColor = 'var(--color-accent)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
          />
        </div>

        <div>
          <label style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', display: 'block', marginBottom: 2 }}>Notes</label>
          <textarea
            style={{ ...fieldStyle, resize: 'none' }}
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 200))}
            rows={2}
            maxLength={200}
            placeholder="Max 200 characters"
            onFocus={(e) => (e.target.style.borderColor = 'var(--color-accent)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
          />
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: 'var(--color-text-muted)', textAlign: 'right' }}>{note.length}/200</div>
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={handleSave}
          className="flex-1 border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)] transition-all cursor-pointer"
          style={{
            fontFamily: 'IBM Plex Mono',
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            padding: '6px 0',
            background: 'transparent',
          }}
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="flex-1 border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-all cursor-pointer"
          style={{
            fontFamily: 'IBM Plex Mono',
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            padding: '6px 0',
            background: 'transparent',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
