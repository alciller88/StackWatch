import type { Service, Dependency } from '../types'

const KNOWN_SERVICES: Record<string, { name: string; category: Service['category'] }> = {
  stripe: { name: 'Stripe', category: 'payments' },
  '@stripe/stripe-js': { name: 'Stripe', category: 'payments' },
  '@sendgrid/mail': { name: 'SendGrid', category: 'email' },
  '@sentry/node': { name: 'Sentry', category: 'monitoring' },
  '@sentry/react': { name: 'Sentry', category: 'monitoring' },
  '@sentry/browser': { name: 'Sentry', category: 'monitoring' },
  '@prisma/client': { name: 'Prisma (Database)', category: 'database' },
  mongoose: { name: 'MongoDB', category: 'database' },
  pg: { name: 'PostgreSQL', category: 'database' },
  mysql2: { name: 'MySQL', category: 'database' },
  redis: { name: 'Redis', category: 'database' },
  ioredis: { name: 'Redis', category: 'database' },
  twilio: { name: 'Twilio', category: 'email' },
  firebase: { name: 'Firebase', category: 'hosting' },
  'firebase-admin': { name: 'Firebase', category: 'hosting' },
  next: { name: 'Vercel (Next.js)', category: 'hosting' },
  '@vercel/analytics': { name: 'Vercel', category: 'analytics' },
  '@octokit/rest': { name: 'GitHub API', category: 'other' },
  '@auth0/nextjs-auth0': { name: 'Auth0', category: 'auth' },
  'next-auth': { name: 'NextAuth.js', category: 'auth' },
  '@supabase/supabase-js': { name: 'Supabase', category: 'database' },
  'aws-sdk': { name: 'AWS', category: 'storage' },
  '@aws-sdk/client-s3': { name: 'AWS S3', category: 'storage' },
  cloudinary: { name: 'Cloudinary', category: 'storage' },
  nodemailer: { name: 'Email (SMTP)', category: 'email' },
  'google-auth-library': { name: 'Google Cloud', category: 'auth' },
}

export function analyzePackageJson(content: string): {
  services: Service[]
  dependencies: Dependency[]
} {
  const pkg = JSON.parse(content)
  const services: Service[] = []
  const dependencies: Dependency[] = []
  const seenServices = new Set<string>()

  function processDeps(
    deps: Record<string, string> | undefined,
    type: Dependency['type']
  ) {
    if (!deps) return
    for (const [name, version] of Object.entries(deps)) {
      dependencies.push({
        name,
        version: version.replace(/^[\^~]/, ''),
        type,
        ecosystem: 'npm',
      })

      const match =
        KNOWN_SERVICES[name] ||
        Object.entries(KNOWN_SERVICES).find(
          ([pattern]) =>
            name.startsWith(pattern.replace('*', '')) ||
            name === pattern
        )?.[1]

      if (match && !seenServices.has(match.name)) {
        seenServices.add(match.name)
        const serviceId = match.name.toLowerCase().replace(/[\s().]/g, '-')
        services.push({
          id: serviceId,
          name: match.name,
          category: match.category,
          plan: 'unknown',
          source: 'inferred',
          inferredFrom: `package.json → ${name}`,
        })

        const dep = dependencies.find((d) => d.name === name)
        if (dep) dep.relatedService = serviceId
      }
    }
  }

  processDeps(pkg.dependencies, 'production')
  processDeps(pkg.devDependencies, 'development')
  processDeps(pkg.peerDependencies, 'peer')

  return { services, dependencies }
}
