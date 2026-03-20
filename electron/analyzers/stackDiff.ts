import fs from 'fs/promises'
import path from 'path'
import type { AnalysisResult, Service, Dependency, StackDiffResult } from '../types'

const STACKWATCH_DIR = '.stackwatch'
const SNAPSHOT_FILE = 'last-scan.json'
const SNAPSHOT_VERSION = '1'

interface ScanSnapshot {
  version?: string
  timestamp: string
  services: Service[]
  dependencies: Dependency[]
}

export function computeStackDiff(
  previous: ScanSnapshot,
  current: ScanSnapshot,
): StackDiffResult {
  const prevServiceIds = new Set(previous.services.map(s => s.id))
  const currServiceIds = new Set(current.services.map(s => s.id))

  const added = current.services.filter(s => !prevServiceIds.has(s.id))
  const removed = previous.services.filter(s => !currServiceIds.has(s.id))

  // Changed: services present in both, but with different category or confidence
  const changed: StackDiffResult['changed'] = []
  for (const curr of current.services) {
    if (!prevServiceIds.has(curr.id)) continue
    const prev = previous.services.find(s => s.id === curr.id)!
    const categoryChanged = prev.category !== curr.category
    const confidenceChanged = (prev.confidence ?? 'medium') !== (curr.confidence ?? 'medium')
    if (categoryChanged || confidenceChanged) {
      changed.push({
        service: curr,
        previousCategory: prev.category,
        previousConfidence: prev.confidence ?? 'medium',
      })
    }
  }

  // Dependencies diff
  const prevDepKeys = new Set(previous.dependencies.map(d => `${d.ecosystem}:${d.name}`))
  const currDepKeys = new Set(current.dependencies.map(d => `${d.ecosystem}:${d.name}`))

  const addedDeps = current.dependencies.filter(d => !prevDepKeys.has(`${d.ecosystem}:${d.name}`))
  const removedDeps = previous.dependencies.filter(d => !currDepKeys.has(`${d.ecosystem}:${d.name}`))

  return {
    added,
    removed,
    changed,
    addedDeps,
    removedDeps,
    timestamp: new Date().toISOString(),
    previousTimestamp: previous.timestamp,
  }
}

export async function saveScanSnapshot(
  dataDir: string,
  scanResult: AnalysisResult,
): Promise<void> {
  const filePath = path.join(dataDir, SNAPSHOT_FILE)

  const snapshot: ScanSnapshot = {
    version: SNAPSHOT_VERSION,
    timestamp: new Date().toISOString(),
    services: scanResult.services,
    dependencies: scanResult.dependencies,
  }

  await fs.mkdir(dataDir, { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf-8')
}

export async function loadPreviousScan(
  dataDir: string,
): Promise<ScanSnapshot | null> {
  const filePath = path.join(dataDir, SNAPSHOT_FILE)

  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const data = JSON.parse(content) as ScanSnapshot

    // Ignore snapshots from incompatible versions
    if (data.version && data.version !== SNAPSHOT_VERSION) {
      console.warn(`[StackDiff] Snapshot version mismatch: expected ${SNAPSHOT_VERSION}, got ${data.version} — ignoring`)
      return null
    }

    return data
  } catch {
    return null
  }
}
