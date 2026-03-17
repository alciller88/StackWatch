import crypto from 'crypto'
import type { Dependency } from '../types'

/** Map StackWatch ecosystem names to PURL types per purl-spec */
const ECOSYSTEM_TO_PURL: Record<string, string> = {
  npm: 'npm',
  pip: 'pypi',
  cargo: 'cargo',
  go: 'golang',
  composer: 'composer',
  gem: 'gem',
  maven: 'maven',
  gradle: 'maven',
  dart: 'pub',
}

/**
 * Generate a Package URL (purl) for a dependency.
 * Spec: https://github.com/package-url/purl-spec
 */
function buildPurl(dep: Dependency): string {
  const purlType = ECOSYSTEM_TO_PURL[dep.ecosystem] ?? dep.ecosystem
  const name = dep.name

  // Go modules use the full module path as namespace+name
  if (purlType === 'golang') {
    // pkg:golang/github.com/user/repo@v1.2.3
    const version = dep.version && dep.version !== '*' ? `@${dep.version}` : ''
    return `pkg:${purlType}/${name}${version}`
  }

  // Scoped npm packages: @scope/name → pkg:npm/%40scope/name@version
  if (purlType === 'npm' && name.startsWith('@')) {
    const encoded = name.replace('@', '%40')
    const version = dep.version && dep.version !== '*' ? `@${dep.version}` : ''
    return `pkg:${purlType}/${encoded}${version}`
  }

  const version = dep.version && dep.version !== '*' ? `@${dep.version}` : ''
  return `pkg:${purlType}/${name}${version}`
}

/**
 * Sanitize a string for use as an SPDX identifier (SPDXRef-).
 * Only alphanumeric, '.', and '-' are allowed.
 */
function spdxSafeId(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-]/g, '-')
}

/** Map dependency type to CycloneDX scope */
function cdxScope(dep: Dependency): 'required' | 'optional' | 'excluded' {
  if (dep.type === 'production') return 'required'
  if (dep.type === 'peer') return 'optional'
  return 'optional' // dev dependencies
}

export interface CycloneDXBom {
  bomFormat: 'CycloneDX'
  specVersion: '1.5'
  version: number
  metadata: {
    timestamp: string
    tools: { vendor: string; name: string; version: string }[]
    component: { type: string; name: string }
  }
  components: {
    type: 'library'
    name: string
    version: string
    purl: string
    scope: 'required' | 'optional' | 'excluded'
  }[]
}

export interface SPDXDocument {
  spdxVersion: 'SPDX-2.3'
  dataLicense: 'CC0-1.0'
  SPDXID: 'SPDXRef-DOCUMENT'
  name: string
  documentNamespace: string
  creationInfo: {
    created: string
    creators: string[]
  }
  packages: {
    SPDXID: string
    name: string
    versionInfo: string
    downloadLocation: string
    externalRefs: {
      referenceCategory: 'PACKAGE-MANAGER'
      referenceType: 'purl'
      referenceLocator: string
    }[]
  }[]
}

/**
 * Generate a CycloneDX 1.5 SBOM from extracted dependencies.
 */
export function generateCycloneDX(deps: Dependency[], projectName: string): CycloneDXBom {
  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [{ vendor: 'StackWatch', name: 'stackwatch', version: '0.4.0' }],
      component: { type: 'application', name: projectName },
    },
    components: deps.map(dep => ({
      type: 'library' as const,
      name: dep.name,
      version: dep.version,
      purl: buildPurl(dep),
      scope: cdxScope(dep),
    })),
  }
}

/**
 * Generate an SPDX 2.3 document from extracted dependencies.
 */
export function generateSPDX(deps: Dependency[], projectName: string): SPDXDocument {
  // Deterministic namespace UUID derived from the project name
  const namespaceUuid = crypto
    .createHash('sha256')
    .update(`stackwatch:${projectName}`)
    .digest('hex')
    .slice(0, 32)
  const formattedUuid = [
    namespaceUuid.slice(0, 8),
    namespaceUuid.slice(8, 12),
    namespaceUuid.slice(12, 16),
    namespaceUuid.slice(16, 20),
    namespaceUuid.slice(20, 32),
  ].join('-')

  return {
    spdxVersion: 'SPDX-2.3',
    dataLicense: 'CC0-1.0',
    SPDXID: 'SPDXRef-DOCUMENT',
    name: projectName,
    documentNamespace: `https://spdx.org/spdxdocs/${projectName}-${formattedUuid}`,
    creationInfo: {
      created: new Date().toISOString(),
      creators: ['Tool: stackwatch-0.4.0'],
    },
    packages: deps.map(dep => ({
      SPDXID: `SPDXRef-Package-${spdxSafeId(dep.name)}`,
      name: dep.name,
      versionInfo: dep.version,
      downloadLocation: 'NOASSERTION',
      externalRefs: [{
        referenceCategory: 'PACKAGE-MANAGER' as const,
        referenceType: 'purl' as const,
        referenceLocator: buildPurl(dep),
      }],
    })),
  }
}
