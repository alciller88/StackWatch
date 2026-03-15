import type { Dependency } from '../types'

export function analyzeRustDeps(content: string): { dependencies: Dependency[] } {
  const dependencies: Dependency[] = []

  function extractSection(sectionHeader: string, type: Dependency['type']) {
    const regex = new RegExp(`\\[${sectionHeader}\\]([\\s\\S]*?)(?=\\n\\[|$)`)
    const match = content.match(regex)
    if (!match) return
    for (const line of match[1].split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('[')) continue
      const depMatch = trimmed.match(
        /^([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]+)"|(?:\{.*?version\s*=\s*"([^"]+)".*))/
      )
      if (depMatch) {
        dependencies.push({
          name: depMatch[1],
          version: (depMatch[2] || depMatch[3] || '*').replace(/^[\^~>=<]/, ''),
          type,
          ecosystem: 'cargo',
        })
      }
    }
  }

  extractSection('dependencies', 'production')
  extractSection('dev-dependencies', 'development')
  extractSection('build-dependencies', 'development')

  return { dependencies }
}
