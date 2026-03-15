import type { Service, HeuristicResult, ServiceCategory } from '../types'

interface ServiceGroup {
  name: string
  category: ServiceCategory
  confidence: 'high' | 'medium' | 'low'
  reasons: string[]
}

export function deduplicateServices(results: HeuristicResult[]): Service[] {
  const groups = new Map<string, ServiceGroup>()

  for (const result of results) {
    const key = normalizeServiceKey(result.serviceName)
    if (!key) continue

    const existing = groups.get(key)
    if (existing) {
      // Use highest confidence
      if (confidenceRank(result.confidence) > confidenceRank(existing.confidence)) {
        existing.confidence = result.confidence
      }
      // Prefer more specific category over 'other'
      if (existing.category === 'other' && result.category !== 'other') {
        existing.category = result.category
      }
      // Accumulate reasons (dedup)
      if (!existing.reasons.includes(result.reason)) {
        existing.reasons.push(result.reason)
      }
      // Use better name (longer, more specific)
      if (result.serviceName.length > existing.name.length) {
        existing.name = result.serviceName
      }
    } else {
      groups.set(key, {
        name: result.serviceName,
        category: result.category,
        confidence: result.confidence,
        reasons: [result.reason],
      })
    }
  }

  // Merge related groups (e.g. "Upstash Redis" + "Upstash Ratelimit" → "Upstash")
  mergeRelatedGroups(groups)

  const services: Service[] = []
  for (const [key, group] of groups) {
    services.push({
      id: key,
      name: group.name,
      category: group.category,
      plan: 'unknown',
      source: 'inferred',
      confidence: group.confidence,
      needsReview: group.confidence === 'low',
      confidenceReasons: group.reasons,
      inferredFrom: group.reasons[0],
    })
  }

  return services
}

function normalizeServiceKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function confidenceRank(c: 'high' | 'medium' | 'low'): number {
  if (c === 'high') return 3
  if (c === 'medium') return 2
  return 1
}

function mergeRelatedGroups(groups: Map<string, ServiceGroup>): void {
  const keys = Array.from(groups.keys())

  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = keys[i]
      const b = keys[j]
      if (!groups.has(a) || !groups.has(b)) continue

      // Check if one key is a prefix of the other
      const shorter = a.length <= b.length ? a : b
      const longer = a.length <= b.length ? b : a

      if (longer.startsWith(shorter + '-') || longer === shorter) {
        const gShorter = groups.get(shorter)!
        const gLonger = groups.get(longer)!

        // Merge into shorter key (more general name)
        if (confidenceRank(gLonger.confidence) > confidenceRank(gShorter.confidence)) {
          gShorter.confidence = gLonger.confidence
        }
        if (gShorter.category === 'other' && gLonger.category !== 'other') {
          gShorter.category = gLonger.category
        }
        for (const reason of gLonger.reasons) {
          if (!gShorter.reasons.includes(reason)) {
            gShorter.reasons.push(reason)
          }
        }
        groups.delete(longer)
      }
    }
  }
}
