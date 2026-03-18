import { describe, it, expect, vi } from 'vitest'

// Standalone encryption tests — test the logic without importing main.ts

describe('Encryption helpers', () => {
  describe('encryptValue / decryptValue round-trip', () => {
    it('recovers original value when safeStorage available', () => {
      // Simulate safeStorage
      const encryptString = (s: string) => Buffer.from(`ENC:${s}`)
      const decryptString = (b: Buffer) => {
        const str = b.toString()
        if (!str.startsWith('ENC:')) throw new Error('Bad decrypt')
        return str.slice(4)
      }

      function encryptValue(value: string): string {
        return encryptString(value).toString('base64')
      }

      function decryptValue(encrypted: string): string {
        try {
          return decryptString(Buffer.from(encrypted, 'base64'))
        } catch {
          return encrypted
        }
      }

      const original = 'my-secret-api-key-12345'
      const encrypted = encryptValue(original)
      expect(encrypted).not.toBe(original)
      const decrypted = decryptValue(encrypted)
      expect(decrypted).toBe(original)
    })

    it('returns value unchanged when safeStorage unavailable', () => {
      const isAvailable = false

      function encryptValue(value: string): string {
        if (!isAvailable) return value
        return Buffer.from(value).toString('base64')
      }

      function decryptValue(encrypted: string): string {
        if (!isAvailable) return encrypted
        return Buffer.from(encrypted, 'base64').toString()
      }

      const value = 'plaintext-key'
      expect(encryptValue(value)).toBe(value)
      expect(decryptValue(value)).toBe(value)
    })

    it('returns original value for corrupted base64', () => {
      const decryptString = (_b: Buffer) => { throw new Error('Corrupted') }

      function decryptValue(encrypted: string): string {
        try {
          return decryptString(Buffer.from(encrypted, 'base64'))
        } catch {
          return encrypted
        }
      }

      const corrupted = '!!!not-valid-base64!!!'
      expect(decryptValue(corrupted)).toBe(corrupted)
    })
  })

  describe('encryptConfig / decryptConfig', () => {
    const SENSITIVE_FIELDS = ['accountEmail', 'owner', 'notes']

    it('encrypts and decrypts sensitive service fields', () => {
      const store = new Map<string, string>()

      function encryptValue(value: string): string {
        return Buffer.from(`ENC:${value}`).toString('base64')
      }

      function decryptValue(encrypted: string): string {
        try {
          const decoded = Buffer.from(encrypted, 'base64').toString()
          if (decoded.startsWith('ENC:')) return decoded.slice(4)
          return encrypted
        } catch {
          return encrypted
        }
      }

      function encryptServiceField(serviceId: string, fieldName: string, value: string): string {
        const ref = `$encrypted:${serviceId}_${fieldName}`
        store.set(`encrypted.${serviceId}_${fieldName}`, encryptValue(value))
        return ref
      }

      function decryptServiceField(reference: string): string | undefined {
        if (!reference.startsWith('$encrypted:')) return undefined
        const key = reference.slice('$encrypted:'.length)
        const stored = store.get(`encrypted.${key}`)
        if (!stored) return undefined
        return decryptValue(stored)
      }

      // Encrypt
      const service: any = {
        id: 'stripe',
        name: 'Stripe',
        accountEmail: 'admin@company.com',
        owner: 'Alice',
        notes: 'Production account',
      }

      for (const field of SENSITIVE_FIELDS) {
        if (service[field]) {
          service[field] = encryptServiceField(service.id, field, service[field])
        }
      }

      expect(service.accountEmail).toMatch(/^\$encrypted:/)
      expect(service.owner).toMatch(/^\$encrypted:/)
      expect(service.notes).toMatch(/^\$encrypted:/)

      // Decrypt
      for (const field of SENSITIVE_FIELDS) {
        const val = service[field]
        if (typeof val === 'string' && val.startsWith('$encrypted:')) {
          const real = decryptServiceField(val)
          if (real) service[field] = real
        }
      }

      expect(service.accountEmail).toBe('admin@company.com')
      expect(service.owner).toBe('Alice')
      expect(service.notes).toBe('Production account')
    })
  })

  describe('store corruption recovery', () => {
    it('recovers from corrupted JSON by creating empty store', () => {
      // Simulate Store constructor that throws on corrupt data
      let attempts = 0
      function createStore(options?: any): Record<string, any> {
        attempts++
        if (attempts === 1) throw new Error('Unexpected end of JSON input')
        return { store: {}, get: () => undefined, set: () => {} }
      }

      let store
      try {
        store = createStore({ encryptionKey: undefined })
      } catch {
        // Delete corrupted file (simulated)
        store = createStore()
      }

      expect(store).toBeDefined()
      expect(attempts).toBe(2)
    })

    it('loads valid store without recovery', () => {
      let attempts = 0
      function createStore(): Record<string, any> {
        attempts++
        return { store: { aiSettings: { enabled: false } }, get: (k: string) => ({ aiSettings: { enabled: false } })[k], set: () => {} }
      }

      const store = createStore()
      expect(store).toBeDefined()
      expect(attempts).toBe(1)
      expect(store.get('aiSettings')).toEqual({ enabled: false })
    })
  })

  describe('legacy encryption migration', () => {
    it('migrates plaintext values to safeStorage format', () => {
      const safeStorageEncrypt = (s: string) => Buffer.from(`SAFE:${s}`)
      const safeStorageDecrypt = (b: Buffer) => {
        const str = b.toString()
        if (!str.startsWith('SAFE:')) throw new Error('Not safeStorage')
        return str.slice(5)
      }

      const storeData: Record<string, string> = {
        'encrypted.stripe_accountEmail': 'admin@company.com', // legacy plaintext
      }

      // Migration logic
      for (const [key, value] of Object.entries(storeData)) {
        if (key.startsWith('encrypted.') && typeof value === 'string') {
          try {
            safeStorageDecrypt(Buffer.from(value, 'base64'))
            // Already migrated
          } catch {
            // Legacy — re-encrypt
            storeData[key] = safeStorageEncrypt(value).toString('base64')
          }
        }
      }

      // Verify migrated value can be decrypted
      const migrated = storeData['encrypted.stripe_accountEmail']
      expect(migrated).not.toBe('admin@company.com')
      const decrypted = safeStorageDecrypt(Buffer.from(migrated, 'base64'))
      expect(decrypted).toBe('admin@company.com')
    })

    it('skips already-migrated values', () => {
      const safeStorageEncrypt = (s: string) => Buffer.from(`SAFE:${s}`)
      const safeStorageDecrypt = (b: Buffer) => {
        const str = b.toString()
        if (!str.startsWith('SAFE:')) throw new Error('Not safeStorage')
        return str.slice(5)
      }

      // Already encrypted with safeStorage
      const alreadyEncrypted = safeStorageEncrypt('admin@company.com').toString('base64')
      const storeData: Record<string, string> = {
        'encrypted.stripe_accountEmail': alreadyEncrypted,
      }

      const originalValue = storeData['encrypted.stripe_accountEmail']

      // Migration logic
      for (const [key, value] of Object.entries(storeData)) {
        if (key.startsWith('encrypted.') && typeof value === 'string') {
          try {
            safeStorageDecrypt(Buffer.from(value, 'base64'))
            // Already migrated — skip
          } catch {
            storeData[key] = safeStorageEncrypt(value).toString('base64')
          }
        }
      }

      // Should remain unchanged
      expect(storeData['encrypted.stripe_accountEmail']).toBe(originalValue)
    })
  })
})
