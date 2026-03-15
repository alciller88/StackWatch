import { describe, it, expect } from 'vitest'
import { analyzeRustDeps } from '../rustDeps'

describe('analyzeRustDeps', () => {
  it('parses [dependencies] with simple versions', () => {
    const content = `
[package]
name = "myapp"
version = "0.1.0"

[dependencies]
reqwest = "0.11"
serde = "1.0"
tokio = "1"
    `.trim()

    const result = analyzeRustDeps(content)
    expect(result.dependencies).toHaveLength(3)
    expect(result.dependencies[0]).toEqual({
      name: 'reqwest',
      version: '0.11',
      type: 'production',
      ecosystem: 'cargo',
    })
  })

  it('parses inline table versions', () => {
    const content = `
[dependencies]
serde = { version = "1.0", features = ["derive"] }
tokio = { version = "1.28", features = ["full"] }
    `.trim()

    const result = analyzeRustDeps(content)
    expect(result.dependencies).toHaveLength(2)
    expect(result.dependencies[0]).toMatchObject({
      name: 'serde',
      version: '1.0',
      ecosystem: 'cargo',
    })
  })

  it('parses [dev-dependencies]', () => {
    const content = `
[dependencies]
reqwest = "0.11"

[dev-dependencies]
mockall = "0.11"
criterion = "0.5"
    `.trim()

    const result = analyzeRustDeps(content)
    expect(result.dependencies).toHaveLength(3)
    const devDeps = result.dependencies.filter((d) => d.type === 'development')
    expect(devDeps).toHaveLength(2)
    expect(devDeps[0].name).toBe('mockall')
  })

  it('skips comments', () => {
    const content = `
[dependencies]
# HTTP client
reqwest = "0.11"
    `.trim()

    const result = analyzeRustDeps(content)
    expect(result.dependencies).toHaveLength(1)
  })

  it('handles empty Cargo.toml', () => {
    const content = `
[package]
name = "myapp"
version = "0.1.0"
    `.trim()

    const result = analyzeRustDeps(content)
    expect(result.dependencies).toHaveLength(0)
  })

  it('strips version prefixes', () => {
    const content = `
[dependencies]
serde = "^1.0"
    `.trim()

    const result = analyzeRustDeps(content)
    expect(result.dependencies[0].version).toBe('1.0')
  })
})
