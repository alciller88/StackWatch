import type { Service, Dependency } from '../types'

const KNOWN_SERVICES: Record<string, { name: string; category: Service['category'] }> = {
  boto3: { name: 'AWS', category: 'infra' },
  botocore: { name: 'AWS', category: 'infra' },
  'aws-cdk-lib': { name: 'AWS CDK', category: 'infra' },
  stripe: { name: 'Stripe', category: 'payments' },
  openai: { name: 'OpenAI', category: 'ai' },
  anthropic: { name: 'Anthropic', category: 'ai' },
  cohere: { name: 'Cohere', category: 'ai' },
  huggingface_hub: { name: 'HuggingFace', category: 'ai' },
  transformers: { name: 'HuggingFace', category: 'ai' },
  wandb: { name: 'Weights & Biases', category: 'ai' },
  mlflow: { name: 'MLflow', category: 'ai' },
  pinecone: { name: 'Pinecone', category: 'data' },
  'pinecone-client': { name: 'Pinecone', category: 'data' },
  snowflake_connector_python: { name: 'Snowflake', category: 'data' },
  'snowflake-connector-python': { name: 'Snowflake', category: 'data' },
  'databricks-sdk': { name: 'Databricks', category: 'data' },
  psycopg2: { name: 'PostgreSQL', category: 'database' },
  'psycopg2-binary': { name: 'PostgreSQL', category: 'database' },
  pymongo: { name: 'MongoDB', category: 'database' },
  redis: { name: 'Redis', category: 'database' },
  celery: { name: 'Celery', category: 'messaging' },
  pika: { name: 'RabbitMQ', category: 'messaging' },
  'kafka-python': { name: 'Apache Kafka', category: 'messaging' },
  'sentry-sdk': { name: 'Sentry', category: 'monitoring' },
  'google-cloud-storage': { name: 'Google Cloud', category: 'infra' },
  'google-cloud-bigquery': { name: 'Google Cloud', category: 'data' },
  'firebase-admin': { name: 'Firebase', category: 'mobile' },
  sendgrid: { name: 'SendGrid', category: 'email' },
  twilio: { name: 'Twilio', category: 'email' },
  'elasticsearch-py': { name: 'Elasticsearch', category: 'data' },
  elasticsearch: { name: 'Elasticsearch', category: 'data' },
  algolia: { name: 'Algolia', category: 'other' },
  'auth0-python': { name: 'Auth0', category: 'auth' },
  'datadog-api-client': { name: 'Datadog', category: 'monitoring' },
  newrelic: { name: 'New Relic', category: 'monitoring' },
}

function parseRequirementsTxt(content: string): { name: string; version: string }[] {
  const deps: { name: string; version: string }[] = []
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) continue
    const match = trimmed.match(/^([a-zA-Z0-9_.-]+)\s*(?:[><=!~]+\s*(.+))?/)
    if (match) {
      deps.push({ name: match[1], version: match[2]?.trim() ?? '*' })
    }
  }
  return deps
}

function parsePyprojectToml(content: string): { name: string; version: string }[] {
  const deps: { name: string; version: string }[] = []
  const depsMatch = content.match(/\[project\][\s\S]*?dependencies\s*=\s*\[([\s\S]*?)\]/)
  if (depsMatch) {
    for (const line of depsMatch[1].split('\n')) {
      const trimmed = line.replace(/[",]/g, '').trim()
      if (!trimmed) continue
      const match = trimmed.match(/^([a-zA-Z0-9_.-]+)\s*(?:[><=!~]+\s*(.+))?/)
      if (match) {
        deps.push({ name: match[1], version: match[2]?.trim() ?? '*' })
      }
    }
  }
  return deps
}

function parseSetupPy(content: string): { name: string; version: string }[] {
  const deps: { name: string; version: string }[] = []
  const match = content.match(/install_requires\s*=\s*\[([\s\S]*?)\]/)
  if (match) {
    for (const line of match[1].split('\n')) {
      const trimmed = line.replace(/['"",]/g, '').trim()
      if (!trimmed) continue
      const depMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\s*(?:[><=!~]+\s*(.+))?/)
      if (depMatch) {
        deps.push({ name: depMatch[1], version: depMatch[2]?.trim() ?? '*' })
      }
    }
  }
  return deps
}

export function analyzePythonDeps(
  content: string,
  filename: string
): { services: Service[]; dependencies: Dependency[] } {
  let rawDeps: { name: string; version: string }[]
  if (filename === 'requirements.txt' || filename.endsWith('/requirements.txt')) {
    rawDeps = parseRequirementsTxt(content)
  } else if (filename === 'pyproject.toml' || filename.endsWith('/pyproject.toml')) {
    rawDeps = parsePyprojectToml(content)
  } else {
    rawDeps = parseSetupPy(content)
  }

  const services: Service[] = []
  const dependencies: Dependency[] = []
  const seenServices = new Set<string>()

  for (const dep of rawDeps) {
    dependencies.push({
      name: dep.name,
      version: dep.version,
      type: 'production',
      ecosystem: 'pip',
    })

    const normalizedName = dep.name.toLowerCase().replace(/_/g, '-')
    const match = KNOWN_SERVICES[dep.name] || KNOWN_SERVICES[normalizedName]
    if (match && !seenServices.has(match.name)) {
      seenServices.add(match.name)
      const serviceId = match.name.toLowerCase().replace(/[\s().]/g, '-')
      services.push({
        id: serviceId,
        name: match.name,
        category: match.category,
        plan: 'unknown',
        source: 'inferred',
        inferredFrom: `${filename} → ${dep.name}`,
      })
      const d = dependencies.find((x) => x.name === dep.name)
      if (d) d.relatedService = serviceId
    }
  }

  return { services, dependencies }
}
