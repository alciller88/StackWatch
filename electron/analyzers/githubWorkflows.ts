import yaml from 'js-yaml'
import type { Service } from '../types'

const ACTION_PATTERNS: Record<string, { name: string; category: Service['category'] }> = {
  'aws-actions/': { name: 'AWS', category: 'storage' },
  'google-github-actions/': { name: 'Google Cloud', category: 'hosting' },
  'azure/': { name: 'Azure', category: 'hosting' },
  'docker/': { name: 'Docker Hub', category: 'hosting' },
  'codecov/': { name: 'Codecov', category: 'monitoring' },
  'sonarsource/': { name: 'SonarCloud', category: 'monitoring' },
  'vercel/': { name: 'Vercel', category: 'hosting' },
  'netlify/': { name: 'Netlify', category: 'hosting' },
}

interface Workflow {
  jobs?: Record<
    string,
    {
      steps?: Array<{ uses?: string }>
      services?: Record<string, { image?: string }>
    }
  >
}

export function analyzeGithubWorkflows(
  content: string,
  filename: string
): { services: Service[] } {
  const workflow = yaml.load(content) as Workflow
  const services: Service[] = []
  const seen = new Set<string>()

  if (!seen.has('GitHub Actions')) {
    seen.add('GitHub Actions')
    services.push({
      id: 'github-actions',
      name: 'GitHub Actions',
      category: 'cicd',
      plan: 'unknown',
      source: 'inferred',
      inferredFrom: `${filename}`,
    })
  }

  if (!workflow?.jobs) return { services }

  for (const [, job] of Object.entries(workflow.jobs)) {
    if (job.steps) {
      for (const step of job.steps) {
        if (!step.uses) continue
        for (const [pattern, meta] of Object.entries(ACTION_PATTERNS)) {
          if (step.uses.startsWith(pattern) && !seen.has(meta.name)) {
            seen.add(meta.name)
            services.push({
              id: meta.name.toLowerCase().replace(/\s/g, '-'),
              name: meta.name,
              category: meta.category,
              plan: 'unknown',
              source: 'inferred',
              inferredFrom: `${filename} → ${step.uses}`,
            })
          }
        }
      }
    }

    if (job.services) {
      for (const [svcName, svcDef] of Object.entries(job.services)) {
        const image = svcDef.image?.split(':')[0] ?? svcName
        if (!seen.has(image)) {
          seen.add(image)
          services.push({
            id: `ci-${image.toLowerCase()}`,
            name: image,
            category: 'other',
            plan: 'free',
            source: 'inferred',
            inferredFrom: `${filename} → services.${svcName}`,
          })
        }
      }
    }
  }

  return { services }
}
