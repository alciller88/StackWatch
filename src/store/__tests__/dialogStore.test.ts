import { describe, it, expect, beforeEach } from 'vitest'
import { useDialogStore } from '../dialogStore'

beforeEach(() => {
  useDialogStore.setState({ current: null })
})

describe('dialogStore', () => {
  it('confirm() sets current dialog and returns promise', async () => {
    const options = {
      title: 'Test',
      message: 'Are you sure?',
      buttons: [
        { label: 'Yes', value: 'yes', primary: true },
        { label: 'No', value: 'no' },
      ],
    }

    const promise = useDialogStore.getState().confirm(options)
    const state = useDialogStore.getState()

    expect(state.current).not.toBeNull()
    expect(state.current?.title).toBe('Test')
    expect(state.current?.message).toBe('Are you sure?')

    // Simulate button click via close()
    useDialogStore.getState().close('yes')

    const result = await promise
    expect(result).toBe('yes')
  })

  it('current is cleared after close', async () => {
    const promise = useDialogStore.getState().confirm({
      title: 'Test',
      message: 'Test',
      buttons: [{ label: 'OK', value: 'ok' }],
    })

    useDialogStore.getState().close('ok')
    await promise

    expect(useDialogStore.getState().current).toBeNull()
  })

  it('close() is a no-op when no dialog is open', () => {
    // Should not throw
    useDialogStore.getState().close('whatever')
    expect(useDialogStore.getState().current).toBeNull()
  })

  it('confirm() replaces previous dialog', async () => {
    const first = useDialogStore.getState().confirm({
      title: 'First',
      message: 'First',
      buttons: [{ label: 'OK', value: 'ok' }],
    })

    const second = useDialogStore.getState().confirm({
      title: 'Second',
      message: 'Second',
      buttons: [{ label: 'OK', value: 'ok' }],
    })

    expect(useDialogStore.getState().current?.title).toBe('Second')

    // Close the second dialog
    useDialogStore.getState().close('ok')
    const result = await second
    expect(result).toBe('ok')
  })
})
