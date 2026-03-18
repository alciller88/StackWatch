import type { Dependency, Vulnerability, DepVulnResult } from '../../shared/types'

// Map StackWatch ecosystems to OSV ecosystems
const ecosystemMap: Record<string, string> = {
  npm: 'npm',
  pip: 'PyPI',
  cargo: 'crates.io',
  go: 'Go',
  gem: 'RubyGems',
  composer: 'Packagist',
  maven: 'Maven',
  gradle: 'Maven',
  dart: 'Pub',
}

function mapSeverity(scores: Array<{ score?: number; severity?: string }>): Vulnerability['severity'] {
  if (!scores || scores.length === 0) return 'unknown'
  for (const s of scores) {
    const score = s.score ?? 0
    if (score >= 9.0) return 'critical'
    if (score >= 7.0) return 'high'
    if (score >= 4.0) return 'medium'
    if (score > 0) return 'low'
  }
  // Check severity field directly
  for (const s of scores) {
    const sev = s.severity?.toLowerCase()
    if (sev === 'critical') return 'critical'
    if (sev === 'high') return 'high'
    if (sev === 'medium' || sev === 'moderate') return 'medium'
    if (sev === 'low') return 'low'
  }
  return 'unknown'
}

/** Scan a batch of dependencies against OSV.dev API */
export async function scanVulnerabilities(
  deps: Dependency[],
): Promise<DepVulnResult[]> {
  const results: DepVulnResult[] = []

  // Build queries for OSV batch API (max 1000 per request)
  const queries = deps
    .filter(d => ecosystemMap[d.ecosystem])
    .map(d => ({
      package: {
        name: d.name,
        ecosystem: ecosystemMap[d.ecosystem],
      },
      version: d.version.replace(/^[\^~>=<]/, ''),
    }))

  if (queries.length === 0) return results

  // Batch in groups of 100
  for (let i = 0; i < queries.length; i += 100) {
    const batch = queries.slice(i, i + 100)

    try {
      const response = await fetch('https://api.osv.dev/v1/querybatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queries: batch }),
        signal: AbortSignal.timeout(15000),
      })

      if (!response.ok) continue

      const data = await response.json()
      const batchResults = data.results ?? []

      for (let j = 0; j < batchResults.length; j++) {
        const vulns = batchResults[j]?.vulns ?? []
        if (vulns.length === 0) continue

        const dep = deps.find(
          d => d.name === batch[j].package.name && ecosystemMap[d.ecosystem] === batch[j].package.ecosystem
        )
        if (!dep) continue

        results.push({
          ecosystem: dep.ecosystem,
          name: dep.name,
          version: dep.version,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- OSV.dev API response is untyped
          vulnerabilities: vulns.slice(0, 5).map((v: Record<string, any>) => ({
            id: v.id ?? 'unknown',
            summary: (v.summary ?? v.details ?? 'No description').slice(0, 200),
            severity: mapSeverity(v.severity ?? []),
            aliases: v.aliases ?? [],
            fixedVersion: v.affected?.[0]?.ranges?.[0]?.events?.find((e: Record<string, unknown>) => e.fixed)?.fixed as string | undefined,
            url: v.references?.[0]?.url ?? `https://osv.dev/vulnerability/${v.id}`,
          })),
        })
      }
    } catch {
      // Network error — skip batch silently
    }
  }

  return results
}
