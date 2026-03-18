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

export const storeMutex = new AsyncMutex()
