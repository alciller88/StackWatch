import { useState, useEffect, useRef, useCallback } from 'react'
import type { FlowNode } from '../../types'
import type { ServiceCategory } from '../../types'

const NODE_TYPES: FlowNode['type'][] = ['user', 'cdn', 'frontend', 'api', 'database', 'external']

const CATEGORIES: ServiceCategory[] = [
  'domain', 'hosting', 'cicd', 'database', 'auth', 'payments', 'email',
  'analytics', 'monitoring', 'cdn', 'storage', 'infra', 'ai', 'mobile',
  'gaming', 'data', 'messaging', 'support', 'other',
]

const PLANS = ['free', 'paid', 'trial', 'unknown'] as const

interface NodeEditPanelProps {
  x: number
  y: number
  initialData: {
    label: string
    nodeType: FlowNode['type']
    category?: ServiceCategory
    plan?: string
    url?: string
    note?: string
  }
  onSave: (data: {
    label: string
    nodeType: FlowNode['type']
    category?: ServiceCategory
    plan?: 'free' | 'paid' | 'trial' | 'unknown'
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
      url: url.trim() || undefined,
      note: note.trim() || undefined,
    })
  }

  const selectClass =
    'w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-200 text-xs focus:border-blue-500 focus:outline-none'
  const inputClass = selectClass

  return (
    <div
      ref={ref}
      style={{ position: 'absolute', left: x, top: y, zIndex: 50 }}
      className="w-64 bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-3 text-sm"
    >
      <div className="text-gray-400 text-xs font-medium mb-2">Edit Node</div>

      <div className="space-y-2">
        <div>
          <label className="text-gray-400 text-[11px] block mb-0.5">Name</label>
          <input
            className={inputClass}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
        </div>

        <div>
          <label className="text-gray-400 text-[11px] block mb-0.5">Node type</label>
          <select className={selectClass} value={nodeType} onChange={(e) => setNodeType(e.target.value as FlowNode['type'])}>
            {NODE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-gray-400 text-[11px] block mb-0.5">Service category</label>
          <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value as ServiceCategory)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-gray-400 text-[11px] block mb-0.5">Plan</label>
          <select className={selectClass} value={plan} onChange={(e) => setPlan(e.target.value)}>
            {PLANS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-gray-400 text-[11px] block mb-0.5">URL</label>
          <input className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
        </div>

        <div>
          <label className="text-gray-400 text-[11px] block mb-0.5">Notes</label>
          <textarea
            className={`${inputClass} resize-none`}
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 200))}
            rows={2}
            maxLength={200}
            placeholder="Max 200 characters"
          />
          <div className="text-gray-500 text-[10px] text-right">{note.length}/200</div>
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={handleSave}
          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs py-1.5 rounded transition-colors"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs py-1.5 rounded transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
