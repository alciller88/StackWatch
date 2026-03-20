import { create } from 'zustand'
import { TOAST_DURATION_MS, TOAST_ERROR_DURATION_MS } from '../constants'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
}

interface ToastState {
  toasts: Toast[]
  addToast: (message: string, type?: Toast['type'], timeoutMs?: number) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, type = 'info', timeoutMs) => {
    const id = `toast-${Date.now()}`
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }))
    const ms = timeoutMs ?? (type === 'error' ? TOAST_ERROR_DURATION_MS : TOAST_DURATION_MS)
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, ms)
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },
}))
