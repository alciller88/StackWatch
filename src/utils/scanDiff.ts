/**
 * Computes which service IDs were added or removed between two scans.
 * Used for the 3-second visual diff highlight on the flow graph.
 */
export interface ScanDiffResult {
  added: Set<string>
  removed: Set<string>
}

export function computeScanDiff(
  previousServiceIds: string[],
  currentServiceIds: string[],
): ScanDiffResult {
  const prevSet = new Set(previousServiceIds)
  const currSet = new Set(currentServiceIds)

  const added = new Set<string>()
  const removed = new Set<string>()

  for (const id of currSet) {
    if (!prevSet.has(id)) added.add(id)
  }
  for (const id of prevSet) {
    if (!currSet.has(id)) removed.add(id)
  }

  return { added, removed }
}
