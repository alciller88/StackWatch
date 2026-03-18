import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useToastStore } from '../toastStore'

beforeEach(() => {
  useToastStore.setState({ toasts: [] })
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('toastStore', () => {
  it('adds toast with unique id', () => {
    useToastStore.getState().addToast('Hello', 'info')
    const toasts = useToastStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0]!.message).toBe('Hello')
    expect(toasts[0]!.type).toBe('info')
    expect(toasts[0]!.id).toMatch(/^toast-/)
  })

  it('defaults type to info', () => {
    useToastStore.getState().addToast('Test')
    expect(useToastStore.getState().toasts[0]!.type).toBe('info')
  })

  it('auto-dismisses info toast after 4000ms', () => {
    useToastStore.getState().addToast('Temp', 'info')
    expect(useToastStore.getState().toasts).toHaveLength(1)
    vi.advanceTimersByTime(4000)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('auto-dismisses error toast after 8000ms', () => {
    useToastStore.getState().addToast('Error', 'error')
    expect(useToastStore.getState().toasts).toHaveLength(1)
    vi.advanceTimersByTime(4000)
    expect(useToastStore.getState().toasts).toHaveLength(1)
    vi.advanceTimersByTime(4000)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('removes toast by id', () => {
    useToastStore.getState().addToast('A', 'info')
    useToastStore.getState().addToast('B', 'info')
    const id = useToastStore.getState().toasts[0]!.id
    useToastStore.getState().removeToast(id)
    expect(useToastStore.getState().toasts).toHaveLength(1)
    expect(useToastStore.getState().toasts[0]!.message).toBe('B')
  })

  it('manages multiple toasts independently', () => {
    useToastStore.getState().addToast('First', 'info')
    vi.advanceTimersByTime(2000)
    useToastStore.getState().addToast('Second', 'info')
    expect(useToastStore.getState().toasts).toHaveLength(2)
    vi.advanceTimersByTime(2000)
    expect(useToastStore.getState().toasts).toHaveLength(1)
    expect(useToastStore.getState().toasts[0]!.message).toBe('Second')
  })

  it('supports custom timeout', () => {
    useToastStore.getState().addToast('Custom', 'info', 1000)
    vi.advanceTimersByTime(1000)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })
})
