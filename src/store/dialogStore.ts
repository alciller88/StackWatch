import { create } from 'zustand'
import type { ConfirmDialogProps } from '../components/ConfirmDialog'

type DialogRequest = Omit<ConfirmDialogProps, 'onResult'>

interface DialogStore {
  current: (DialogRequest & { resolve: (value: string) => void }) | null
  confirm: (request: DialogRequest) => Promise<string>
  close: (value: string) => void
}

export const useDialogStore = create<DialogStore>((set, get) => ({
  current: null,

  confirm: (request) => {
    return new Promise<string>((resolve) => {
      set({ current: { ...request, resolve } })
    })
  },

  close: (value) => {
    const { current } = get()
    if (current) {
      current.resolve(value)
      set({ current: null })
    }
  },
}))
