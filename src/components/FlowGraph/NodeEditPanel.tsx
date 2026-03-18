import { useReducer, useEffect, useRef, useCallback } from 'react'
import { SERVICE_CATEGORIES } from '../../types'
import type { FlowNode, ServiceCategory, ServiceBilling } from '../../types'
import { renewService } from '../../utils/billing'

const NODE_TYPES: FlowNode['type'][] = ['layer', 'cdn', 'api', 'database', 'external']

const CATEGORIES = SERVICE_CATEGORIES;

const PLANS = ['free', 'paid', 'trial', 'unknown'] as const
const CONFIDENCES = ['high', 'medium', 'low'] as const
const BILLING_TYPES: ServiceBilling['type'][] = ['manual', 'automatic', 'free']
const BILLING_PERIODS: NonNullable<ServiceBilling['period']>[] = ['monthly', 'yearly', 'one-time', 'usage-based']

interface NodeEditFormState {
  label: string
  nodeType: FlowNode['type']
  category: ServiceCategory
  plan: string
  confidence: 'high' | 'medium' | 'low'
  url: string
  note: string
  billingType: ServiceBilling['type']
  billingPeriod: NonNullable<ServiceBilling['period']>
  billingAmount: string
  billingCurrency: string
  billingNextDate: string
  billingLastRenewed: string
}

type NodeEditAction =
  | { type: 'SET_FIELD'; field: keyof NodeEditFormState; value: string }
  | { type: 'INIT'; data: NodeEditPanelProps['initialData'] }

function nodeEditReducer(state: NodeEditFormState, action: NodeEditAction): NodeEditFormState {
  switch (action.type) {
    case 'INIT':
      return {
        label: action.data.label,
        nodeType: action.data.nodeType,
        category: action.data.category ?? 'other',
        plan: action.data.plan ?? 'unknown',
        confidence: action.data.confidence ?? 'high',
        url: action.data.url ?? '',
        note: action.data.note ?? '',
        billingType: action.data.billing?.type ?? 'manual',
        billingPeriod: action.data.billing?.period ?? 'monthly',
        billingAmount: action.data.billing?.amount?.toString() ?? '',
        billingCurrency: action.data.billing?.currency ?? 'USD',
        billingNextDate: action.data.billing?.nextDate ?? '',
        billingLastRenewed: action.data.billing?.lastRenewed ?? '',
      }
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value }
    default:
      return state
  }
}

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
    billing?: ServiceBilling
  }
  onSave: (data: {
    label: string
    nodeType: FlowNode['type']
    category?: ServiceCategory
    plan?: 'free' | 'paid' | 'trial' | 'unknown'
    confidence?: 'high' | 'medium' | 'low'
    url?: string
    note?: string
    billing?: ServiceBilling
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
  const [state, dispatch] = useReducer(nodeEditReducer, initialData, (data) => ({
    label: data.label,
    nodeType: data.nodeType,
    category: data.category ?? 'other',
    plan: data.plan ?? 'unknown',
    confidence: data.confidence ?? 'high',
    url: data.url ?? '',
    note: data.note ?? '',
    billingType: data.billing?.type ?? 'manual',
    billingPeriod: data.billing?.period ?? 'monthly',
    billingAmount: data.billing?.amount?.toString() ?? '',
    billingCurrency: data.billing?.currency ?? 'USD',
    billingNextDate: data.billing?.nextDate ?? '',
    billingLastRenewed: data.billing?.lastRenewed ?? '',
  }))

  const { label, nodeType, category, plan, confidence, url, note, billingType, billingPeriod, billingAmount, billingCurrency, billingNextDate, billingLastRenewed } = state
  const setField = (field: keyof NodeEditFormState, value: string) => dispatch({ type: 'SET_FIELD', field, value })

  const ref = useRef<HTMLDivElement>(null)
  const [clampedPos, setClampedPos] = useState({ left: x, top: y })

  // Clamp position after render so panel stays within viewport
  useEffect(() => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const maxLeft = window.innerWidth - rect.width - 10
    const maxTop = window.innerHeight - rect.height - 10
    setClampedPos({
      left: Math.max(10, Math.min(x, maxLeft)),
      top: Math.max(10, Math.min(y, maxTop)),
    })
  }, [x, y])

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

    let billing: ServiceBilling | undefined
    if (billingType === 'free') {
      billing = { type: 'free' }
    } else {
      billing = {
        type: billingType,
        period: billingPeriod,
        ...(billingAmount && { amount: parseFloat(billingAmount) }),
        currency: billingCurrency,
        ...(billingNextDate && { nextDate: billingNextDate }),
        ...(billingLastRenewed && { lastRenewed: billingLastRenewed }),
      }
    }

    onSave({
      label: label.trim(),
      nodeType,
      category,
      plan: plan as 'free' | 'paid' | 'trial' | 'unknown',
      confidence,
      url: url.trim() || undefined,
      note: note.trim() || undefined,
      billing,
    })
  }

  const showBillingFields = billingType !== 'free'
  const showRenewalFields = showBillingFields && billingPeriod !== 'usage-based' && billingPeriod !== 'one-time'
  const showManualRenewal = showRenewalFields && billingType === 'manual'

  const labelClass = "font-mono text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] block mb-0.5"
  const fieldClass = "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] px-2 py-1 text-[11px] font-mono text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="Edit node"
      className="absolute z-50 w-64 p-3 font-mono text-[11px]"
      onKeyDown={(e) => {
        if (e.key === 'Tab' && ref.current) {
          const focusable = ref.current.querySelectorAll<HTMLElement>(
            'input, select, textarea, button, [tabindex]:not([tabindex="-1"])'
          )
          if (focusable.length === 0) return
          const first = focusable[0]
          const last = focusable[focusable.length - 1]
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault()
            last.focus()
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }}
      style={{
        left: clampedPos.left,
        top: clampedPos.top,
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        maxHeight: 'calc(100vh - 20px)',
        overflowY: 'auto',
      }}
    >
      <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Edit Node</div>

      <div className="space-y-2">
        <div>
          <label className={labelClass}>Name</label>
          <input
            className={fieldClass}
            value={label}
            onChange={(e) => setField('label', e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className={labelClass}>Type</label>
            <select className={fieldClass} value={nodeType} onChange={(e) => setField('nodeType', e.target.value)}>
              {NODE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className={labelClass}>Category</label>
            <select className={fieldClass} value={category} onChange={(e) => setField('category', e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className={labelClass}>Plan</label>
            <select className={fieldClass} value={plan} onChange={(e) => setField('plan', e.target.value)}>
              {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className={labelClass}>Confidence</label>
            <select className={fieldClass} value={confidence} onChange={(e) => setField('confidence', e.target.value)}>
              {CONFIDENCES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>URL</label>
          <input className={fieldClass} value={url} onChange={(e) => setField('url', e.target.value)} placeholder="https://..." />
        </div>

        {/* Billing section */}
        <div className="border-t border-[var(--color-border)] pt-2 mt-2">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-1.5">Billing</div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className={labelClass}>Type</label>
              <select className={fieldClass} value={billingType} onChange={(e) => setField('billingType', e.target.value)}>
                {BILLING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {showBillingFields && (
              <div className="flex-1">
                <label className={labelClass}>Period</label>
                <select className={fieldClass} value={billingPeriod} onChange={(e) => setField('billingPeriod', e.target.value)}>
                  {BILLING_PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            )}
          </div>

          {billingType === 'free' && (
            <div className="font-mono text-[10px] text-[var(--color-success)] mt-1">Free — no billing</div>
          )}

          {showBillingFields && billingPeriod === 'usage-based' && (
            <div className="font-mono text-[10px] text-[var(--color-text-muted)] mt-1">Cost varies by usage</div>
          )}

          {showBillingFields && billingPeriod !== 'usage-based' && (
            <div className="flex gap-2 mt-1.5">
              <div className="flex-1">
                <label className={labelClass}>Amount</label>
                <input
                  className={fieldClass}
                  type="number"
                  value={billingAmount}
                  onChange={(e) => setField('billingAmount', e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="w-16">
                <label className={labelClass}>Cur.</label>
                <select className={fieldClass} value={billingCurrency} onChange={(e) => setField('billingCurrency', e.target.value)}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>
          )}

          {showRenewalFields && (
            <div className="mt-1.5">
              <label className={labelClass}>Next renewal</label>
              <input className={fieldClass} type="date" value={billingNextDate} onChange={(e) => setField('billingNextDate', e.target.value)} />
            </div>
          )}

          {showManualRenewal && (
            <div className="mt-1.5 space-y-1.5">
              <div>
                <label className={labelClass}>Last renewed</label>
                <input className={fieldClass} type="date" value={billingLastRenewed} onChange={(e) => setField('billingLastRenewed', e.target.value)} />
              </div>
              <button
                type="button"
                onClick={() => {
                  const updated = renewService({
                    type: billingType,
                    period: billingPeriod,
                    amount: billingAmount ? parseFloat(billingAmount) : undefined,
                    currency: billingCurrency,
                    nextDate: billingNextDate || undefined,
                    lastRenewed: billingLastRenewed || undefined,
                  })
                  setField('billingLastRenewed', updated.lastRenewed ?? '')
                  setField('billingNextDate', updated.nextDate ?? '')
                }}
                className="w-full py-1 font-mono text-[10px] uppercase tracking-widest bg-transparent border border-[var(--color-success)] text-[var(--color-success)] hover:bg-[var(--color-success)] hover:text-[var(--color-bg-primary)] transition-colors"
              >
                Mark renewed today
              </button>
            </div>
          )}
        </div>

        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            className={`${fieldClass} resize-none`}
            value={note}
            onChange={(e) => setField('note', e.target.value.slice(0, 200))}
            rows={2}
            maxLength={200}
            placeholder="Max 200 characters"
          />
          <div className="font-mono text-[10px] text-[var(--color-text-muted)] text-right">{note.length}/200</div>
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={handleSave}
          className="flex-1 py-1.5 font-mono text-[10px] uppercase tracking-widest bg-transparent border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)] transition-all cursor-pointer"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="flex-1 py-1.5 font-mono text-[10px] uppercase tracking-widest bg-transparent border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-all cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
