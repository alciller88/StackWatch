import type { Service } from '../types'

const PROVIDER_MAP: Record<string, { name: string; category: Service['category'] }> = {
  aws: { name: 'AWS', category: 'infra' },
  google: { name: 'Google Cloud', category: 'infra' },
  azurerm: { name: 'Azure', category: 'infra' },
  cloudflare: { name: 'Cloudflare', category: 'cdn' },
  datadog: { name: 'Datadog', category: 'monitoring' },
  newrelic: { name: 'New Relic', category: 'monitoring' },
  github: { name: 'GitHub', category: 'other' },
  digitalocean: { name: 'DigitalOcean', category: 'infra' },
  heroku: { name: 'Heroku', category: 'hosting' },
  pagerduty: { name: 'PagerDuty', category: 'monitoring' },
  mongodbatlas: { name: 'MongoDB Atlas', category: 'database' },
  elasticsearch: { name: 'Elasticsearch', category: 'data' },
  kubernetes: { name: 'Kubernetes', category: 'infra' },
  helm: { name: 'Helm', category: 'infra' },
  vault: { name: 'HashiCorp Vault', category: 'auth' },
  random: null as unknown as { name: string; category: Service['category'] },
  null: null as unknown as { name: string; category: Service['category'] },
  local: null as unknown as { name: string; category: Service['category'] },
  template: null as unknown as { name: string; category: Service['category'] },
}

export function analyzeTerraform(
  content: string,
  filename: string
): { services: Service[] } {
  const services: Service[] = []
  const seenServices = new Set<string>()

  // Match provider blocks: provider "aws" { ... }
  const providerBlocks = content.matchAll(/provider\s+"([^"]+)"/g)
  for (const match of providerBlocks) {
    addProvider(match[1])
  }

  // Match required_providers in terraform block
  const requiredProviders = content.matchAll(
    /([a-zA-Z0-9_]+)\s*=\s*\{[^}]*source\s*=\s*"[^/]*\/([^"]+)"/g
  )
  for (const match of requiredProviders) {
    addProvider(match[2])
  }

  // Match resource types: resource "aws_instance" → provider = aws
  const resources = content.matchAll(/resource\s+"([a-zA-Z0-9]+)_/g)
  for (const match of resources) {
    addProvider(match[1])
  }

  function addProvider(providerName: string) {
    const meta = PROVIDER_MAP[providerName]
    if (!meta || seenServices.has(meta.name)) return
    seenServices.add(meta.name)
    services.push({
      id: meta.name.toLowerCase().replace(/[\s().]/g, '-'),
      name: meta.name,
      category: meta.category,
      plan: 'unknown',
      source: 'inferred',
      inferredFrom: `${filename} → provider ${providerName}`,
    })
  }

  return { services }
}
