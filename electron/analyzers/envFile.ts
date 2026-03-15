import { parse } from 'dotenv'
import type { Service } from '../types'

interface ServicePattern {
  name: string
  category: Service['category']
}

const SERVICE_PATTERNS: Record<string, ServicePattern> = {
  STRIPE_: { name: 'Stripe', category: 'payments' },
  SENDGRID_: { name: 'SendGrid', category: 'email' },
  TWILIO_: { name: 'Twilio', category: 'email' },
  NEXT_PUBLIC_GA_: { name: 'Google Analytics', category: 'analytics' },
  GA_: { name: 'Google Analytics', category: 'analytics' },
  SENTRY_: { name: 'Sentry', category: 'monitoring' },
  AWS_: { name: 'AWS', category: 'storage' },
  VERCEL_: { name: 'Vercel', category: 'hosting' },
  GITHUB_TOKEN: { name: 'GitHub API', category: 'other' },
  REDIS_: { name: 'Redis', category: 'database' },
  FIREBASE_: { name: 'Firebase', category: 'hosting' },
  CLOUDFLARE_: { name: 'Cloudflare', category: 'cdn' },
  AUTH0_: { name: 'Auth0', category: 'auth' },
  SUPABASE_: { name: 'Supabase', category: 'database' },
  MAILGUN_: { name: 'Mailgun', category: 'email' },
  CLOUDINARY_: { name: 'Cloudinary', category: 'storage' },
  DATADOG_: { name: 'Datadog', category: 'monitoring' },
  NEW_RELIC_: { name: 'New Relic', category: 'monitoring' },
  ALGOLIA_: { name: 'Algolia', category: 'other' },
  PUSHER_: { name: 'Pusher', category: 'other' },
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
