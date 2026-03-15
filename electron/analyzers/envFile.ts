import { parse } from 'dotenv'
import type { Service } from '../types'

interface ServicePattern {
  name: string
  category: Service['category']
}

const SERVICE_PATTERNS: Record<string, ServicePattern> = {
  // Payments
  STRIPE_: { name: 'Stripe', category: 'payments' },
  // Email / SMS
  SENDGRID_: { name: 'SendGrid', category: 'email' },
  TWILIO_: { name: 'Twilio', category: 'email' },
  MAILGUN_: { name: 'Mailgun', category: 'email' },
  // Analytics
  NEXT_PUBLIC_GA_: { name: 'Google Analytics', category: 'analytics' },
  GA_: { name: 'Google Analytics', category: 'analytics' },
  // Monitoring
  SENTRY_: { name: 'Sentry', category: 'monitoring' },
  DATADOG_: { name: 'Datadog', category: 'monitoring' },
  NEWRELIC_: { name: 'New Relic', category: 'monitoring' },
  NEW_RELIC_: { name: 'New Relic', category: 'monitoring' },
  // Hosting / CDN
  AWS_: { name: 'AWS', category: 'infra' },
  VERCEL_: { name: 'Vercel', category: 'hosting' },
  CLOUDFLARE_: { name: 'Cloudflare', category: 'cdn' },
  // Auth
  AUTH0_: { name: 'Auth0', category: 'auth' },
  GITHUB_TOKEN: { name: 'GitHub API', category: 'other' },
  // Database
  REDIS_: { name: 'Redis', category: 'database' },
  SUPABASE_: { name: 'Supabase', category: 'database' },
  ELASTICSEARCH_: { name: 'Elasticsearch', category: 'data' },
  // Storage
  CLOUDINARY_: { name: 'Cloudinary', category: 'storage' },
  FIREBASE_: { name: 'Firebase', category: 'mobile' },
  // Mobile
  APPCENTER_: { name: 'App Center', category: 'mobile' },
  ONESIGNAL_: { name: 'OneSignal', category: 'mobile' },
  // AI / ML
  OPENAI_: { name: 'OpenAI', category: 'ai' },
  ANTHROPIC_: { name: 'Anthropic', category: 'ai' },
  HUGGINGFACE_: { name: 'HuggingFace', category: 'ai' },
  COHERE_: { name: 'Cohere', category: 'ai' },
  WANDB_: { name: 'Weights & Biases', category: 'ai' },
  // Data
  SNOWFLAKE_: { name: 'Snowflake', category: 'data' },
  DATABRICKS_: { name: 'Databricks', category: 'data' },
  PINECONE_: { name: 'Pinecone', category: 'data' },
  // Messaging
  RABBITMQ_: { name: 'RabbitMQ', category: 'messaging' },
  KAFKA_: { name: 'Apache Kafka', category: 'messaging' },
  PUSHER_: { name: 'Pusher', category: 'messaging' },
  // Gaming
  STEAM_: { name: 'Steam', category: 'gaming' },
  DISCORD_: { name: 'Discord', category: 'gaming' },
  PLAYFAB_: { name: 'PlayFab', category: 'gaming' },
  // Search / Support / General
  ALGOLIA_: { name: 'Algolia', category: 'other' },
  INTERCOM_: { name: 'Intercom', category: 'support' },
  ZENDESK_: { name: 'Zendesk', category: 'support' },
}

function detectDbFromUrl(value: string): ServicePattern | null {
  if (value.startsWith('postgres://') || value.startsWith('postgresql://'))
    return { name: 'PostgreSQL', category: 'database' }
  if (value.startsWith('mysql://'))
    return { name: 'MySQL', category: 'database' }
  if (value.startsWith('mongodb://') || value.startsWith('mongodb+srv://'))
    return { name: 'MongoDB', category: 'database' }
  return null
}

export function analyzeEnvFile(
  content: string,
  filename: string
): { services: Service[] } {
  const parsed = parse(content)
  const services: Service[] = []
  const seenServices = new Set<string>()

  for (const [key, value] of Object.entries(parsed)) {
    if (key === 'DATABASE_URL' && value) {
      const db = detectDbFromUrl(value)
      if (db && !seenServices.has(db.name)) {
        seenServices.add(db.name)
        services.push({
          id: db.name.toLowerCase().replace(/\s/g, '-'),
          name: db.name,
          category: db.category,
          plan: 'unknown',
          source: 'inferred',
          inferredFrom: `${filename} → DATABASE_URL`,
        })
      }
      continue
    }

    for (const [pattern, meta] of Object.entries(SERVICE_PATTERNS)) {
      if (
        (pattern.endsWith('_') && key.startsWith(pattern)) ||
        key === pattern
      ) {
        if (!seenServices.has(meta.name)) {
          seenServices.add(meta.name)
          services.push({
            id: meta.name.toLowerCase().replace(/\s/g, '-'),
            name: meta.name,
            category: meta.category,
            plan: 'unknown',
            source: 'inferred',
            inferredFrom: `${filename} → ${key}`,
          })
        }
        break
      }
    }
  }

  return { services }
}
