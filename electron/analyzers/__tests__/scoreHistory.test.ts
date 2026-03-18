import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadScoreHistory, appendScoreEntry } from '../scoreHistory'
import type { ScoreHistoryEntry } from '../scoreHistory'

// ── Mock fs/promises ──

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}))

import * as fs from 'fs/promises'

// ── Helpers ──

function makeEntry(overrides?: Partial<ScoreHistoryEntry>): ScoreHistoryEntry {
  return {
    timestamp: '2025-01-15T12:00:00Z',
    score: 72,
    passingChecks: 3,
    totalChecks: 5,
    serviceCount: 5,
    depCount: 20,
    ...overrides,
  }
}

// ── Tests ──

describe('loadScoreHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array when file does not exist', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT: no such file'))

    const result = await loadScoreHistory('/repo')
    expect(result).toEqual([])
  })

  it('returns empty array when file has invalid JSON', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('not valid json {{{')

    const result = await loadScoreHistory('/repo')
    expect(result).toEqual([])
  })

  it('returns empty array when file contains non-array JSON', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('{"key": "value"}')

    const result = await loadScoreHistory('/repo')
    expect(result).toEqual([])
  })

  it('returns parsed array when file is valid', async () => {
    const entries = [makeEntry(), makeEntry({ score: 85 })]
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(entries))

    const result = await loadScoreHistory('/repo')
    expect(result).toHaveLength(2)
    expect(result[0].score).toBe(72)
    expect(result[1].score).toBe(85)
  })
})

describe('appendScoreEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fs.mkdir).mockResolvedValue(undefined)
    vi.mocked(fs.writeFile).mockResolvedValue(undefined)
  })

  it('appends entry to existing history', async () => {
    const existing = [makeEntry({ score: 60 })]
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existing))

    const newEntry = makeEntry({ score: 75 })
    await appendScoreEntry('/repo', newEntry)

    expect(fs.writeFile).toHaveBeenCalledTimes(1)
    const writtenData = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0][1] as string)
    expect(writtenData).toHaveLength(2)
    expect(writtenData[0].score).toBe(60)
    expect(writtenData[1].score).toBe(75)
  })

  it('creates directory and file when they do not exist', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'))

    const entry = makeEntry()
    await appendScoreEntry('/repo', entry)

    expect(fs.mkdir).toHaveBeenCalledWith(
      expect.stringContaining('.stackwatch'),
      { recursive: true },
    )
    expect(fs.writeFile).toHaveBeenCalledTimes(1)
    const writtenData = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0][1] as string)
    expect(writtenData).toHaveLength(1)
    expect(writtenData[0].score).toBe(72)
  })

  it('trims to MAX_ENTRIES (100) when exceeding limit', async () => {
    const existing = Array.from({ length: 100 }, (_, i) =>
      makeEntry({ score: i, timestamp: `2025-01-${String(i + 1).padStart(2, '0')}T00:00:00Z` }),
    )
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existing))

    const newEntry = makeEntry({ score: 999 })
    await appendScoreEntry('/repo', newEntry)

    const writtenData = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0][1] as string)
    expect(writtenData).toHaveLength(100)
    // The oldest entry (score 0) should be trimmed, newest (999) should be last
    expect(writtenData[writtenData.length - 1].score).toBe(999)
    expect(writtenData[0].score).toBe(1) // first entry trimmed
  })

  it('preserves existing entries when appending', async () => {
    const existing = [
      makeEntry({ score: 50, timestamp: '2025-01-01T00:00:00Z' }),
      makeEntry({ score: 60, timestamp: '2025-01-02T00:00:00Z' }),
    ]
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existing))

    const newEntry = makeEntry({ score: 70, timestamp: '2025-01-03T00:00:00Z' })
    await appendScoreEntry('/repo', newEntry)

    const writtenData = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0][1] as string)
    expect(writtenData).toHaveLength(3)
    expect(writtenData[0].timestamp).toBe('2025-01-01T00:00:00Z')
    expect(writtenData[1].timestamp).toBe('2025-01-02T00:00:00Z')
    expect(writtenData[2].timestamp).toBe('2025-01-03T00:00:00Z')
  })
})
