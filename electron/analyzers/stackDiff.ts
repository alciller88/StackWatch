import fs from 'fs/promises'
import path from 'path'
import type { AnalysisResult, Service, Dependency, StackDiffResult } from '../types'

const STACKWATCH_DIR = '.stackwatch'
const SNAPSHOT_FILE = 'last-scan.json'

interface ScanSnapshot {
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
  repoPath: string,
  scanResult: AnalysisResult,
): Promise<void> {
  const dirPath = path.join(repoPath, STACKWATCH_DIR)
  const filePath = path.join(dirPath, SNAPSHOT_FILE)

  const snapshot: ScanSnapshot = {
    timestamp: new Date().toISOString(),
    services: scanResult.services,
    dependencies: scanResult.dependencies,
  }

  await fs.mkdir(dirPath, { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf-8')
}

export async function loadPreviousScan(
  repoPath: string,
): Promise<ScanSnapshot | null> {
  const filePath = path.join(repoPath, STACKWATCH_DIR, SNAPSHOT_FILE)

  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content) as ScanSnapshot
  } catch {
    return null
  }
}
