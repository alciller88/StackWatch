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

const MAX_HISTORY_SMALL = 50   // < 100 nodes
const MAX_HISTORY_MEDIUM = 25  // 100-300 nodes
const MAX_HISTORY_LARGE = 10   // > 300 nodes
const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024 // 2MB

function getMaxHistory(nodeCount: number): number {
  if (nodeCount > 300) return MAX_HISTORY_LARGE
  if (nodeCount > 100) return MAX_HISTORY_MEDIUM
  return MAX_HISTORY_SMALL
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],

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

    const maxHistory = getMaxHistory(current.nodes.length)

    const snapshot: Snapshot = {
      label,
      nodes: structuredClone(current.nodes),
      edges: structuredClone(current.edges),
      services: structuredClone(current.services),
    }
    set((state) => ({
      past: [...state.past.slice(-(maxHistory - 1)), snapshot],
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
