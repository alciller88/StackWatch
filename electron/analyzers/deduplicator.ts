import type { Service, HeuristicResult, ServiceCategory, DiscardedItem } from '../types'

interface ServiceGroup {
  name: string
  category: ServiceCategory
  confidence: 'high' | 'medium' | 'low'
  reasons: string[]
  /** Best (max) score per unique evidence type. Final score = sum of values. */
  scoreByType: Map<string, number>
  needsReview?: boolean
}

/** Normalize evidence type key — import and npm_package count as the same type */
function evidenceTypeKey(type: string): string {
  return (type === 'import' || type === 'npm_package') ? 'import/npm' : type
}

// Well-known brand names for collapsing "BrandName + descriptor" entries
const KNOWN_BRANDS = [
  'cloudflare', 'vercel', 'docker', 'aws', 'google', 'azure', 'stripe',
  'sendgrid', 'sentry', 'twilio', 'github', 'gitlab', 'redis', 'postgres',
  'postgresql', 'mongo', 'mongodb', 'firebase', 'heroku', 'netlify',
  'datadog', 'newrelic', 'pagerduty', 'slack', 'intercom', 'zendesk',
  'salesforce', 'posthog', 'hubspot', 'mailgun', 'postmark',
]

// Generic service names that should be replaced by specific ones when found
const GENERIC_SERVICE_NAMES = new Set([
  'database', 'email', 'email from', 'email server', 'user email',
  'user emails', 'insights database',
])

export function deduplicateServices(results: HeuristicResult[]): { services: Service[]; discarded: DiscardedItem[] } {
  const groups = new Map<string, ServiceGroup>()

  for (const result of results) {
    const key = normalizeServiceKey(result.serviceName)
    if (!key) continue

    const typeKey = evidenceTypeKey(result.evidenceType)
    const existing = groups.get(key)
    if (existing) {
      // Keep best (max) score per evidence type — not additive per instance
      const prev = existing.scoreByType.get(typeKey) ?? 0
      if (result.score > prev) {
        existing.scoreByType.set(typeKey, result.score)
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
      const scoreMap = new Map<string, number>()
      scoreMap.set(typeKey, result.score)
      groups.set(key, {
        name: result.serviceName,
        category: result.category,
        confidence: result.confidence,
        reasons: [result.reason],
        scoreByType: scoreMap,
      })
    }
  }

  // Merge related groups (e.g. "Upstash Redis" + "Upstash Ratelimit" → "Upstash")
  mergeRelatedGroups(groups)

  // Collapse brand + descriptor entries into brand root
  collapseBrandEntries(groups)

  // Remove generic entries when a specific one exists in the same category
  const discarded: DiscardedItem[] = []
  removeGenericEntries(groups, discarded)

  // Compute final score per group and apply thresholds
  const services: Service[] = []
  for (const [key, group] of groups) {
    // Final score = sum of best scores per unique evidence type
    let finalScore = 0
    for (const s of group.scoreByType.values()) {
      finalScore += s
    }

    // Score threshold: discard if below 6
    if (finalScore < 6) {
      discarded.push({
        name: group.name,
        reason: 'low_score',
        score: finalScore,
        evidences: group.reasons.map(r => ({ type: 'reason', value: r, file: '' })),
        category: group.category,
      })
      continue
    }

    // Derive confidence from final score
    // > 10 → high (strong multi-type evidence, no AI needed)
    // 6-10 → low, needsReview (grey zone, AI validates)
    let confidence: 'high' | 'medium' | 'low'
    let needsReview: boolean
    if (finalScore > 10) {
      confidence = 'high'
      needsReview = false
    } else {
      // score 6-10
      confidence = 'low'
      needsReview = true
    }

    services.push({
      id: key,
      name: group.name,
      category: group.category,
      plan: 'unknown',
      source: 'inferred',
      confidence,
      needsReview,
      confidenceReasons: group.reasons,
      inferredFrom: group.reasons[0],
    })
  }

  return { services, discarded }
}

function normalizeServiceKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function confidenceRank(c: 'high' | 'medium' | 'low'): number {
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
        mergeInto(groups, shorter, longer)
      }
    }
  }
}

/** Merge group `from` into group `into` and delete `from` */
function mergeInto(groups: Map<string, ServiceGroup>, into: string, from: string): void {
  const gInto = groups.get(into)
  const gFrom = groups.get(from)
  if (!gInto || !gFrom) return

  // Merge scoreByType: keep max per type
  for (const [type, score] of gFrom.scoreByType) {
    const prev = gInto.scoreByType.get(type) ?? 0
    if (score > prev) {
      gInto.scoreByType.set(type, score)
    }
  }

  if (gInto.category === 'other' && gFrom.category !== 'other') {
    gInto.category = gFrom.category
  }
  for (const reason of gFrom.reasons) {
    if (!gInto.reasons.includes(reason)) {
      gInto.reasons.push(reason)
    }
  }
  groups.delete(from)
}

/**
 * Collapse "BrandName Descriptor" entries into "BrandName"
 * e.g., "Cloudflare Sitekey" + "Cloudflare Use Turnstile" → "Cloudflare"
 *       "Docker Hub" + "Dockerhub" → "Docker Hub"
 *       "Vercel Use Botid In Booker" → "Vercel"
 */
function collapseBrandEntries(groups: Map<string, ServiceGroup>): void {
  // Normalize variant spellings first (e.g., "dockerhub" → "docker-hub")
  const variantMap: Record<string, string> = {
    'dockerhub': 'docker-hub',
  }
  for (const [variant, canonical] of Object.entries(variantMap)) {
    if (groups.has(variant) && groups.has(canonical)) {
      mergeInto(groups, canonical, variant)
    } else if (groups.has(variant)) {
      const g = groups.get(variant)!
      g.name = toTitleCaseSimple(canonical.replace(/-/g, ' '))
      groups.set(canonical, g)
      groups.delete(variant)
    }
  }

  const keys = Array.from(groups.keys())

  for (const brand of KNOWN_BRANDS) {
    const brandKey = brand.replace(/[^a-z0-9]+/g, '-')
    const matching = keys.filter(k =>
      groups.has(k) &&
      k !== brandKey &&
      k.startsWith(brandKey + '-')
    )

    if (matching.length === 0) continue

    // If brand root exists, merge into it; otherwise create it from best match
    if (groups.has(brandKey)) {
      for (const key of matching) {
        mergeInto(groups, brandKey, key)
      }
      // Keep the brand root's name as the canonical brand name
      const root = groups.get(brandKey)!
      root.name = toTitleCaseSimple(brand)
    } else if (matching.length === 1) {
      // Single match: promote it to brand root but keep a good name
      const first = matching[0]
      const g = groups.get(first)!
      // Use the existing name if it's a well-known variant (e.g., "Docker Hub")
      // Otherwise simplify to the brand name
      const existingWords = g.name.split(/\s+/).length
      const brandName = existingWords <= 2 ? g.name : toTitleCaseSimple(brand)
      g.name = brandName
      groups.set(brandKey, g)
      groups.delete(first)
    } else {
      // Multiple matches: create brand root from the first, merge rest
      const first = matching[0]
      const g = groups.get(first)!
      const brandGroup: ServiceGroup = {
        name: toTitleCaseSimple(brand),
        category: g.category,
        confidence: g.confidence,
        reasons: [...g.reasons],
        scoreByType: new Map(g.scoreByType),
      }
      groups.set(brandKey, brandGroup)
      groups.delete(first)

      for (let i = 1; i < matching.length; i++) {
        mergeInto(groups, brandKey, matching[i])
      }
    }
  }
}

/**
 * Remove generic entries when a specific one exists.
 * e.g., "Database" removed if "PostgreSQL" exists (both category 'database')
 *        "Email From" removed if "SendGrid" exists (both category 'email')
 */
function removeGenericEntries(groups: Map<string, ServiceGroup>, discarded: DiscardedItem[]): void {
  const keys = Array.from(groups.keys())

  for (const key of keys) {
    if (!groups.has(key)) continue
    const group = groups.get(key)!
    const lowerName = group.name.toLowerCase()

    if (GENERIC_SERVICE_NAMES.has(lowerName)) {
      // Check if a specific service in the same category exists
      const hasSpecific = Array.from(groups.entries()).some(
        ([otherKey, otherGroup]) =>
          otherKey !== key &&
          otherGroup.category === group.category &&
          !GENERIC_SERVICE_NAMES.has(otherGroup.name.toLowerCase())
      )
      if (hasSpecific) {
        let finalScore = 0
        for (const s of group.scoreByType.values()) finalScore += s
        discarded.push({
          name: group.name,
          reason: 'generic_term',
          score: finalScore,
          evidences: group.reasons.map(r => ({ type: 'reason', value: r, file: '' })),
          category: group.category,
        })
        groups.delete(key)
      }
    }
  }
}

function toTitleCaseSimple(str: string): string {
  return str
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}
