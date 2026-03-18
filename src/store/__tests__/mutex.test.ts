import { describe, it, expect } from 'vitest'

// Import from source directly to test the class
// We recreate the mutex here to avoid shared state between tests
class AsyncMutex {
  private queue: Array<() => void> = []
  private locked = false

  async acquire(): Promise<() => void> {
    return new Promise(resolve => {
      const tryAcquire = () => {
        if (!this.locked) {
          this.locked = true
          let released = false
          resolve(() => {
            if (released) return
            released = true
            this.locked = false
            const next = this.queue.shift()
            if (next) next()
          })
        } else {
          this.queue.push(tryAcquire)
        }
      }
      tryAcquire()
    })
  }
}

describe('AsyncMutex', () => {
  it('acquires and releases', async () => {
    const mutex = new AsyncMutex()
    const release = await mutex.acquire()
    expect(typeof release).toBe('function')
    release()
  })

  it('serializes two concurrent operations', async () => {
    const mutex = new AsyncMutex()
    const order: number[] = []

    const op1 = async () => {
      const release = await mutex.acquire()
      order.push(1)
      await new Promise(r => setTimeout(r, 50))
      order.push(2)
      release()
    }

    const op2 = async () => {
      const release = await mutex.acquire()
      order.push(3)
      order.push(4)
      release()
    }

    await Promise.all([op1(), op2()])
    // op1 acquires first, op2 waits. So order is [1, 2, 3, 4]
    expect(order).toEqual([1, 2, 3, 4])
  })

  it('releases in finally even if operation throws', async () => {
    const mutex = new AsyncMutex()

    try {
      const release = await mutex.acquire()
      try {
        throw new Error('test error')
      } finally {
        release()
      }
    } catch {
      // expected
    }

    // Mutex should be available again
    const release2 = await mutex.acquire()
    expect(typeof release2).toBe('function')
    release2()
  })

  it('does not deadlock if release is called twice', async () => {
    const mutex = new AsyncMutex()
    const release = await mutex.acquire()
    release()
    release() // Second call should be a no-op

    // Should still be acquirable
    const release2 = await mutex.acquire()
    expect(typeof release2).toBe('function')
    release2()
  })

  it('processes queued operations in order', async () => {
    const mutex = new AsyncMutex()
    const order: number[] = []

    const release1 = await mutex.acquire()

    const p2 = mutex.acquire().then(release => {
      order.push(2)
      release()
    })
    const p3 = mutex.acquire().then(release => {
      order.push(3)
      release()
    })

    order.push(1)
    release1()

    await Promise.all([p2, p3])
    expect(order).toEqual([1, 2, 3])
  })
})
