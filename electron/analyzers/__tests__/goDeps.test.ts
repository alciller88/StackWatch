import { describe, it, expect } from 'vitest'
import { analyzeGoDeps } from '../goDeps'

describe('analyzeGoDeps', () => {
  it('parses require block', () => {
    const content = `
module github.com/myorg/myapp

go 1.21

require (
	github.com/gin-gonic/gin v1.9.1
	github.com/lib/pq v1.10.9
	go.uber.org/zap v1.26.0
)
    `.trim()

    const result = analyzeGoDeps(content)
    expect(result.dependencies).toHaveLength(3)
    expect(result.dependencies[0]).toEqual({
      name: 'github.com/gin-gonic/gin',
      version: 'v1.9.1',
      type: 'production',
      ecosystem: 'go',
    })
  })

  it('parses single-line require', () => {
    const content = `
module myapp

go 1.21

require github.com/gin-gonic/gin v1.9.1
    `.trim()

    const result = analyzeGoDeps(content)
    expect(result.dependencies).toHaveLength(1)
    expect(result.dependencies[0].name).toBe('github.com/gin-gonic/gin')
  })

  it('skips comments in require block', () => {
    const content = `
module myapp

require (
	// HTTP framework
	github.com/gin-gonic/gin v1.9.1
)
    `.trim()

    const result = analyzeGoDeps(content)
    expect(result.dependencies).toHaveLength(1)
  })

  it('handles empty go.mod', () => {
    const content = `
module myapp

go 1.21
    `.trim()

    const result = analyzeGoDeps(content)
    expect(result.dependencies).toHaveLength(0)
  })

  it('handles versions with suffixes', () => {
    const content = `
module myapp

require (
	github.com/some/lib v0.0.0-20230101120000-abc123def456
)
    `.trim()

    const result = analyzeGoDeps(content)
    expect(result.dependencies).toHaveLength(1)
    expect(result.dependencies[0].version).toBe('v0.0.0-20230101120000-abc123def456')
  })
})
