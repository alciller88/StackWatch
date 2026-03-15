import type { Dependency } from '../types'

export function analyzeGoDeps(content: string): { dependencies: Dependency[] } {
  const dependencies: Dependency[] = []
  const requireBlock = content.match(/require\s*\(([\s\S]*?)\)/)

  if (requireBlock) {
    for (const line of requireBlock[1].split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('//')) continue
      const match = trimmed.match(/^(\S+)\s+(v[\d.]+\S*)/)
      if (match) {
        dependencies.push({
          name: match[1],
          version: match[2],
          type: 'production',
          ecosystem: 'go',
        })
      }
    }
  }

  // Single-line require statements
  const singleRequires = content.matchAll(/^require\s+(\S+)\s+(v[\d.]+\S*)/gm)
  for (const match of singleRequires) {
    dependencies.push({
      name: match[1],
      version: match[2],
      type: 'production',
      ecosystem: 'go',
    })
  }

  return { dependencies }
}
