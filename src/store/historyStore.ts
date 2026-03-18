import { create } from 'zustand'
import type { Node, Edge } from 'reactflow'
import type { Service } from '../types'

interface Snapshot {
  label: string
  nodes: Node[]
  edges: Edge[]
  services: Service[]
}

interface HistoryState {
  past: Snapshot[]
  future: Snapshot[]
  maxHistory: number

  /** Call before making a change to save current state */
  pushSnapshot: (label: string, current: { nodes: Node[]; edges: Edge[]; services: Service[] }) => void

  /** Undo: returns the previous snapshot, or null if nothing to undo */
  undo: (current: { nodes: Node[]; edges: Edge[]; services: Service[] }) => Snapshot | null

  /** Redo: returns the next snapshot, or null if nothing to redo */
  redo: (current: { nodes: Node[]; edges: Edge[]; services: Service[] }) => Snapshot | null

  canUndo: () => boolean
  canRedo: () => boolean
  clear: () => void
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  maxHistory: 50,

  pushSnapshot: (label, current) => {
    // Skip if snapshot is identical to the last one (reference check first, then content)
    const { past } = get()
    const last = past[past.length - 1]
    if (last &&
        last.nodes === current.nodes &&
        last.edges === current.edges &&
        last.services === current.services) {
      return
    }

    const snapshot: Snapshot = {
      label,
      nodes: structuredClone(current.nodes),
      edges: structuredClone(current.edges),
      services: structuredClone(current.services),
    }
    set((state) => ({
      past: [...state.past.slice(-(state.maxHistory - 1)), snapshot],
      future: [], // Clear redo stack on new action
    }))
  },

  undo: (current) => {
    const { past } = get()
    if (past.length === 0) return null

    const previous = past[past.length - 1]
    const currentSnapshot: Snapshot = {
      label: 'current',
      nodes: structuredClone(current.nodes),
      edges: structuredClone(current.edges),
      services: structuredClone(current.services),
    }

    set((state) => ({
      past: state.past.slice(0, -1),
      future: [currentSnapshot, ...state.future],
    }))

    return previous
  },

  redo: (current) => {
    const { future } = get()
    if (future.length === 0) return null

    const next = future[0]
    const currentSnapshot: Snapshot = {
      label: 'current',
      nodes: structuredClone(current.nodes),
      edges: structuredClone(current.edges),
      services: structuredClone(current.services),
    }

    set((state) => ({
      past: [...state.past, currentSnapshot],
      future: state.future.slice(1),
    }))

    return next
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
  clear: () => set({ past: [], future: [] }),
}))
