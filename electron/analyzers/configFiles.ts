import type { Service } from '../types'

const CONFIG_FILE_MAP: Record<string, { name: string; category: Service['category'] }> = {
  'vercel.json': { name: 'Vercel', category: 'hosting' },
  'netlify.toml': { name: 'Netlify', category: 'hosting' },
  'firebase.json': { name: 'Firebase', category: 'hosting' },
  'fly.toml': { name: 'Fly.io', category: 'hosting' },
  'render.yaml': { name: 'Render', category: 'hosting' },
  'railway.json': { name: 'Railway', category: 'hosting' },
}

export function analyzeConfigFile(
  _content: string,
  filename: string
): { services: Service[] } {
  const meta = CONFIG_FILE_MAP[filename]
  if (!meta) return { services: [] }

  return {
    services: [
      {
        id: meta.name.toLowerCase().replace(/[\s.]/g, '-'),
        name: meta.name,
        category: meta.category,
        plan: 'unknown',
        source: 'inferred',
        inferredFrom: filename,
      },
    ],
  }
}
