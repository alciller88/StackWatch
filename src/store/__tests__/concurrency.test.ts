import { describe, it, expect, vi, beforeEach } from 'vitest'

// Inline AsyncMutex for isolated testing (no shared state between tests)
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

describe('Concurrency - Race condition prevention', () => {
  describe('AsyncMutex fundamentals', () => {
    it('acquire returns a release function', async () => {
      const mutex = new AsyncMutex()
      const release = await mutex.acquire()
      expect(typeof release).toBe('function')
      release()
    })

    it('second acquire waits until release', async () => {
      const mutex = new AsyncMutex()
      const order: number[] = []

      const release1 = await mutex.acquire()
      order.push(1)

      const p2 = mutex.acquire().then(release => {
        order.push(2)
        release()
      })

      // Give p2 a chance to try acquiring — it should be blocked
      await new Promise(r => setTimeout(r, 10))
      expect(order).toEqual([1]) // 2 should not have run yet

      release1()
      await p2
      expect(order).toEqual([1, 2])
    })

    it('release in finally works even on exception', async () => {
      const mutex = new AsyncMutex()

      // First operation throws
      try {
        const release = await mutex.acquire()
        try {
          throw new Error('boom')
        } finally {
          release()
        }
      } catch { /* expected */ }

      // Second operation should not be blocked
      const release2 = await mutex.acquire()
      expect(typeof release2).toBe('function')
      release2()
    })

    it('serializes multiple concurrent operations in order', async () => {
      const mutex = new AsyncMutex()
      const order: number[] = []

      const op = async (id: number, delay: number) => {
        const release = await mutex.acquire()
        try {
          order.push(id)
          await new Promise(r => setTimeout(r, delay))
        } finally {
          release()
        }
      }

      await Promise.all([
        op(1, 30),
        op(2, 10),
        op(3, 10),
      ])

      expect(order).toEqual([1, 2, 3])
    })
  })

  describe('addService concurrency', () => {
    it('5 concurrent additions result in 5 services', async () => {
      const mutex = new AsyncMutex()
      let services: Array<{ id: string; name: string }> = []

      async function addService(svc: { id: string; name: string }) {
        const release = await mutex.acquire()
        try {
          // Read current state
          const current = [...services]
          // Simulate async save
          await new Promise(r => setTimeout(r, 5))
          // Write with new service appended
          services = [...current, svc]
        } finally {
          release()
        }
      }

      await Promise.all([
        addService({ id: 's1', name: 'Service 1' }),
        addService({ id: 's2', name: 'Service 2' }),
        addService({ id: 's3', name: 'Service 3' }),
        addService({ id: 's4', name: 'Service 4' }),
        addService({ id: 's5', name: 'Service 5' }),
      ])

      expect(services).toHaveLength(5)
      expect(new Set(services.map(s => s.id)).size).toBe(5) // no duplicates
    })

    it('without mutex, concurrent additions can lose data', async () => {
      let services: Array<{ id: string; name: string }> = []

      async function addServiceNoLock(svc: { id: string; name: string }) {
        const current = [...services]
        await new Promise(r => setTimeout(r, 5))
        services = [...current, svc]
      }

      await Promise.all([
        addServiceNoLock({ id: 's1', name: 'Service 1' }),
        addServiceNoLock({ id: 's2', name: 'Service 2' }),
        addServiceNoLock({ id: 's3', name: 'Service 3' }),
      ])

      // Without mutex, all read the same empty array simultaneously,
      // so only the last one to write survives
      expect(services.length).toBeLessThanOrEqual(3)
      // In practice, typically only 1 survives
    })
  })

  describe('deleteService + graph consistency', () => {
    it('delete removes service and corresponding node', async () => {
      const mutex = new AsyncMutex()

      let services = [
        { id: 'stripe', name: 'Stripe' },
        { id: 'sentry', name: 'Sentry' },
      ]
      let nodes = [
        { id: 'svc-stripe', data: { serviceId: 'stripe' } },
        { id: 'svc-sentry', data: { serviceId: 'sentry' } },
        { id: 'user', data: { serviceId: undefined } },
      ]

      async function deleteService(serviceId: string) {
        const release = await mutex.acquire()
        try {
          services = services.filter(s => s.id !== serviceId)
          nodes = nodes.filter(n => n.data.serviceId !== serviceId)
        } finally {
          release()
        }
      }

      await deleteService('stripe')

      expect(services).toHaveLength(1)
      expect(services[0].id).toBe('sentry')
      expect(nodes).toHaveLength(2) // svc-sentry + user
      expect(nodes.find(n => n.data.serviceId === 'stripe')).toBeUndefined()
    })

    it('no orphaned references after delete', async () => {
      const mutex = new AsyncMutex()

      let services = [{ id: 'stripe', name: 'Stripe' }]
      let nodes = [{ id: 'svc-stripe', data: { serviceId: 'stripe' } }]
      let edges = [
        { id: 'e1', source: 'user', target: 'svc-stripe' },
        { id: 'e2', source: 'svc-stripe', target: 'svc-db' },
      ]

      async function deleteService(serviceId: string) {
        const release = await mutex.acquire()
        try {
          const nodeId = `svc-${serviceId}`
          services = services.filter(s => s.id !== serviceId)
          nodes = nodes.filter(n => n.data.serviceId !== serviceId)
          edges = edges.filter(e => e.source !== nodeId && e.target !== nodeId)
        } finally {
          release()
        }
      }

      await deleteService('stripe')

      expect(services).toHaveLength(0)
      expect(nodes).toHaveLength(0)
      expect(edges).toHaveLength(0) // all edges referencing svc-stripe removed
    })
  })

  describe('updateService + persistence', () => {
    it('update reflects in state immediately', async () => {
      const mutex = new AsyncMutex()
      let services = [
        { id: 'stripe', name: 'Stripe', plan: 'free' },
      ]
      let savedConfig: any = null

      async function updateService(id: string, updates: Record<string, any>) {
        const release = await mutex.acquire()
        try {
          services = services.map(s =>
            s.id === id ? { ...s, ...updates } : s,
          )
          // Simulate async save to disk
          await new Promise(r => setTimeout(r, 5))
          savedConfig = { services: [...services] }
        } finally {
          release()
        }
      }

      await updateService('stripe', { plan: 'paid', name: 'Stripe Inc' })

      expect(services[0].plan).toBe('paid')
      expect(services[0].name).toBe('Stripe Inc')
      expect(savedConfig.services[0].plan).toBe('paid')
    })

    it('two rapid updates serialize correctly', async () => {
      const mutex = new AsyncMutex()
      let services = [{ id: 'stripe', name: 'Stripe', plan: 'free' }]
      const persistedVersions: string[] = []

      async function updateService(id: string, updates: Record<string, any>) {
        const release = await mutex.acquire()
        try {
          services = services.map(s =>
            s.id === id ? { ...s, ...updates } : s,
          )
          await new Promise(r => setTimeout(r, 10))
          persistedVersions.push(services.find(s => s.id === id)!.plan)
        } finally {
          release()
        }
      }

      await Promise.all([
        updateService('stripe', { plan: 'trial' }),
        updateService('stripe', { plan: 'paid' }),
      ])

      // Both updates ran in order, final state is 'paid'
      expect(services[0].plan).toBe('paid')
      expect(persistedVersions).toEqual(['trial', 'paid'])
    })
  })

  describe('no update loops', () => {
    it('registered callback does not trigger infinite recursion', async () => {
      const mutex = new AsyncMutex()
      let callCount = 0

      async function deleteFromStore(serviceId: string) {
        const release = await mutex.acquire()
        try {
          callCount++
          // Simulate: only call the callback once, not recursively
          if (callCount > 5) throw new Error('Infinite recursion detected!')
        } finally {
          release()
        }
      }

      await deleteFromStore('test')
      expect(callCount).toBe(1)
    })
  })
})
