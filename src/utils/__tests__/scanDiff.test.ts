import { describe, it, expect } from 'vitest'
import { computeScanDiff } from '../scanDiff'

describe('computeScanDiff', () => {
  it('returns empty sets when both lists are identical', () => {
    const { added, removed } = computeScanDiff(['a', 'b', 'c'], ['a', 'b', 'c'])
    expect(added.size).toBe(0)
    expect(removed.size).toBe(0)
  })

  it('detects added services', () => {
    const { added, removed } = computeScanDiff(['a', 'b'], ['a', 'b', 'c', 'd'])
    expect(added).toEqual(new Set(['c', 'd']))
    expect(removed.size).toBe(0)
  })

  it('detects removed services', () => {
    const { added, removed } = computeScanDiff(['a', 'b', 'c'], ['a'])
    expect(added.size).toBe(0)
    expect(removed).toEqual(new Set(['b', 'c']))
  })

  it('detects both added and removed', () => {
    const { added, removed } = computeScanDiff(['a', 'b'], ['b', 'c'])
    expect(added).toEqual(new Set(['c']))
    expect(removed).toEqual(new Set(['a']))
  })

  it('handles empty previous list (first scan)', () => {
    const { added, removed } = computeScanDiff([], ['a', 'b'])
    expect(added).toEqual(new Set(['a', 'b']))
    expect(removed.size).toBe(0)
  })

  it('handles empty current list', () => {
    const { added, removed } = computeScanDiff(['a', 'b'], [])
    expect(added.size).toBe(0)
    expect(removed).toEqual(new Set(['a', 'b']))
  })

  it('handles both empty', () => {
    const { added, removed } = computeScanDiff([], [])
    expect(added.size).toBe(0)
    expect(removed.size).toBe(0)
  })
})
