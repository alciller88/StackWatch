import type { Dependency, Vulnerability, DepVulnResult } from '../../shared/types'

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

const BATCH_SIZE = 100
const BATCH_DELAY_MS = 200
const MAX_RETRIES = 3
const RETRY_BASE_DELAY_MS = 1000
const REQUEST_TIMEOUT_MS = 15000

function mapSeverity(scores: Array<{ score?: number; severity?: string }>): Vulnerability['severity'] {
  if (!scores || scores.length === 0) return 'unknown'
  for (const s of scores) {
    const score = s.score ?? 0
    if (score >= 9.0) return 'critical'
    if (score >= 7.0) return 'high'
    if (score >= 4.0) return 'medium'
    if (score > 0) return 'low'
  }
  for (const s of scores) {
    const sev = s.severity?.toLowerCase()
    if (sev === 'critical') return 'critical'
    if (sev === 'high') return 'high'
    if (sev === 'medium' || sev === 'moderate') return 'medium'
    if (sev === 'low') return 'low'
  }
  return 'unknown'
}

async function fetchWithBackoff(
  url: string,
  body: unknown,
  retries = MAX_RETRIES,
): Promise<Response> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (response.status === 429 && retries > 0) {
    const delay = RETRY_BASE_DELAY_MS * (MAX_RETRIES - retries + 1)
    console.warn(`[VulnScanner] Rate limited (429), retrying in ${delay}ms (${retries} retries left)`)
    await new Promise(r => setTimeout(r, delay))
    return fetchWithBackoff(url, body, retries - 1)
  }

  return response
}

export interface VulnScanResult {
  results: DepVulnResult[]
  partial: boolean
  error?: string
}

/** Scan dependencies against OSV.dev API with backoff and partial result support */
export async function scanVulnerabilities(
  deps: Dependency[],
): Promise<VulnScanResult> {
  const results: DepVulnResult[] = []
  let failedBatches = 0

  const queries = deps
    .filter(d => ecosystemMap[d.ecosystem])
    .map(d => ({
      package: {
        name: d.name,
        ecosystem: ecosystemMap[d.ecosystem],
      },
      version: d.version.replace(/^[\^~>=<]/, ''),
    }))

  if (queries.length === 0) return { results, partial: false }

  const totalBatches = Math.ceil(queries.length / BATCH_SIZE)

  for (let i = 0; i < queries.length; i += BATCH_SIZE) {
    const batch = queries.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1

    try {
      const response = await fetchWithBackoff('https://api.osv.dev/v1/querybatch', { queries: batch })

      if (!response.ok) {
        console.warn(`[VulnScanner] Batch ${batchNum}/${totalBatches} failed: HTTP ${response.status}`)
        failedBatches++
        continue
      }

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
    } catch (err) {
      console.warn(`[VulnScanner] Batch ${batchNum}/${totalBatches} error:`, err instanceof Error ? err.message : err)
      failedBatches++
    }

    // Delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < queries.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS))
    }
  }

  return {
    results,
    partial: failedBatches > 0,
    error: failedBatches > 0
      ? `${failedBatches}/${totalBatches} batches failed — vulnerability results may be incomplete`
      : undefined,
  }
}
