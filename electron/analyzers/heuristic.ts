import type { Evidence, HeuristicResult, ServiceCategory } from '../types'

export function classifyEvidences(evidences: Evidence[], projectName?: string): HeuristicResult[] {
  const results: HeuristicResult[] = []
  const normalizedProject = projectName
    ? projectName.toLowerCase().replace(/[^a-z0-9]/g, '')
    : null

  for (const ev of evidences) {
    let result: HeuristicResult | null = null

    switch (ev.type) {
      case 'env_var':
        result = classifyEnvVar(ev.value)
        break
      case 'url':
        result = classifyUrl(ev.value)
        break
      case 'npm_package':
        result = classifyNpmPackage(ev.value)
        break
      case 'import':
        result = classifyImport(ev.value)
        break
      case 'config_file':
        result = classifyConfigFile(ev.value)
        break
      case 'ci_secret':
        result = classifyCISecret(ev.value)
        break
      case 'domain':
        result = classifyDomain(ev.value)
        break
    }

    if (result) {
      // Filter out the project's own name from detected services
      if (normalizedProject) {
        const normalizedService = result.serviceName.toLowerCase().replace(/[^a-z0-9]/g, '')
        if (normalizedService === normalizedProject) continue
      }
      results.push(result)
    }
  }

  return results
}

// Names too generic to be a real external service
const GENERIC_NAMES = new Set([
  'admin', 'app', 'api', 'auth', 'backend', 'base', 'cache', 'client',
  'config', 'core', 'data', 'database', 'db', 'default', 'dev', 'domain',
  'email', 'env', 'frontend', 'gateway', 'global', 'host', 'http', 'https',
  'internal', 'local', 'login', 'mail', 'main', 'master', 'name', 'node',
  'notification', 'origin', 'primary', 'private', 'production', 'proxy',
  'public', 'queue', 'root', 'server', 'service', 'session', 'site',
  'staging', 'static', 'storage', 'store', 'system', 'test', 'token',
  'url', 'user', 'web', 'webhook', 'worker',
])

function isGenericName(name: string): boolean {
  return GENERIC_NAMES.has(name.toLowerCase().trim())
}

function classifyEnvVar(name: string): HeuristicResult | null {
  const upper = name.toUpperCase()

  // Ignore system and framework variables
  const ignorePattern = /^(NODE_ENV|PORT|HOST|DEBUG|LOG_LEVEL|TZ|LANG|PATH|HOME|PWD|NEXT_PUBLIC_URL|VITE_APP_URL|PUBLIC_URL|HOSTNAME|SHELL|USER|TERM|EDITOR|CI|npm_\w+)$/
  if (ignorePattern.test(upper)) return null

  // Extract service candidate by removing generic prefixes and suffixes
  const serviceCandidate = upper
    .replace(/^[^A-Z]+/, '') // strip leading non-alpha chars ($, digits, etc.)
    .replace(/^(NEXT_PUBLIC_|VITE_|REACT_APP_|EXPO_PUBLIC_|NUXT_PUBLIC_|GATSBY_)/, '')
    .replace(/_(SECRET|KEY|TOKEN|URL|HOST|PORT|USER|PASSWORD|API|ID|ENDPOINT|DSN|URI|BASE|REGION|BUCKET|PROJECT|APP|CLIENT|ACCESS|PRIVATE|PUBLIC|CONFIG|DOMAIN|ACCOUNT|ORG|WEBHOOK|CALLBACK|REDIRECT|VERSION).*$/, '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .trim()

  if (!serviceCandidate || serviceCandidate.length < 2) return null
  if (isGenericName(serviceCandidate)) return null

  const isCredential = /_KEY$|_SECRET$|_TOKEN$|_PASSWORD$|_DSN$|_API_KEY$/.test(upper)
  const isEndpoint = /_URL$|_HOST$|_ENDPOINT$|_URI$/.test(upper)

  return {
    serviceName: toTitleCase(serviceCandidate),
    category: inferCategory(serviceCandidate),
    confidence: isCredential || isEndpoint ? 'high' : 'medium',
    reason: `Environment variable "${name}" suggests external service`,
  }
}

function classifyUrl(url: string): HeuristicResult | null {
  const domain = extractApexDomain(url)
  if (!domain) return null

  // Extract readable name: remove common subdomains and TLD
  const serviceName = domain
    .replace(/^(api|app|cdn|static|assets|dashboard|console|portal|hooks|events|ws|admin|staging|dev|test|login|mail|smtp|ftp|www|docs|status|internal|preview|demo|sandbox|beta|auth|secure|my|account|panel|manage|cms|blog)\./i, '')
    .split('.')[0]

  if (!serviceName || serviceName.length < 2) return null
  if (isGenericName(serviceName)) return null

  return {
    serviceName: toTitleCase(serviceName),
    category: inferCategory(serviceName),
    confidence: url.includes('/api/') || url.includes('api.') ? 'high' : 'medium',
    reason: `External URL "${url}" found in source code`,
  }
}

function classifyNpmPackage(pkg: string): HeuristicResult | null {
  // Ignore packages that are clearly not external services
  const ignorePatterns = [
    /^@types\//,
    /^eslint/, /^prettier/, /^typescript$/, /^ts-node$/,
    /^tailwind/, /^postcss/, /^autoprefixer$/,
    /^@tailwindcss\//,
    /^babel/, /^webpack/, /^vite$/, /^@vitejs\//, /^rollup/, /^esbuild/,
    /^jest$/, /^vitest$/, /^mocha$/, /^chai$/, /^@testing-library\//,
    /^react$/, /^react-dom$/, /^react-router/,
    /^vue$/, /^svelte$/, /^@angular\//,
    /^lodash/, /^moment$/, /^date-fns$/, /^dayjs$/,
    /^zod$/, /^yup$/, /^joi$/,
    /^axios$/, /^node-fetch$/, /^cross-fetch$/,
    /^uuid$/, /^nanoid$/, /^clsx$/, /^classnames$/,
    /^lucide/, /^heroicons/, /^@radix-ui\//,
    /^concurrently$/, /^wait-on$/,
    /^@dagrejs\//, /^reactflow$/,
    /^zustand$/, /^redux$/, /^@reduxjs\//,
    /^next$/, /^nuxt$/, /^gatsby$/,
    /^dotenv$/, /^js-yaml$/,
    /^path$/, /^fs$/, /^crypto$/,
    /^glob$/, /^minimatch$/, /^ignore$/,
    /^chalk$/, /^commander$/, /^yargs$/,
    /^express$/, /^fastify$/, /^koa$/,
    /^electron$/, /^electron-builder$/, /^electron-store$/,
  ]
  if (ignorePatterns.some(p => p.test(pkg))) return null

  // Extract service name from package name
  const name = pkg
    .replace(/^@/, '')
    .split('/')[0]
    .replace(/[-_](js|sdk|client|node|api|react|vue|next|browser|web|server|core|utils|helpers|lib|plugin)$/i, '')

  if (name.length < 2) return null

  return {
    serviceName: toTitleCase(name.replace(/[-_]/g, ' ')),
    category: inferCategory(name),
    confidence: 'medium',
    reason: `npm package "${pkg}" suggests external service dependency`,
  }
}

function classifyImport(importPath: string): HeuristicResult | null {
  // Extract the base package name
  const basePkg = importPath.startsWith('@')
    ? importPath.split('/').slice(0, 2).join('/')
    : importPath.split('/')[0]

  return classifyNpmPackage(basePkg)
}

function classifyConfigFile(value: string): HeuristicResult | null {
  // Docker service names
  if (value.startsWith('docker-service:')) {
    const svcName = value.replace('docker-service:', '')
    return {
      serviceName: toTitleCase(svcName),
      category: inferCategory(svcName),
      confidence: 'high',
      reason: `Docker Compose service "${svcName}"`,
    }
  }

  // GitHub Actions
  if (value === 'github-actions') {
    return {
      serviceName: 'GitHub Actions',
      category: 'cicd',
      confidence: 'high',
      reason: 'GitHub Actions workflow found',
    }
  }

  // CI action references
  if (value.startsWith('action:')) {
    const action = value.replace('action:', '')
    const org = action.split('/')[0]
    if (org === 'aws-actions') return { serviceName: 'AWS', category: 'infra', confidence: 'high', reason: `GitHub Action "${action}"` }
    if (org === 'google-github-actions') return { serviceName: 'Google Cloud', category: 'infra', confidence: 'high', reason: `GitHub Action "${action}"` }
    if (org === 'azure') return { serviceName: 'Azure', category: 'infra', confidence: 'high', reason: `GitHub Action "${action}"` }
    if (org === 'docker') return { serviceName: 'Docker Hub', category: 'infra', confidence: 'high', reason: `GitHub Action "${action}"` }
    if (org === 'codecov') return { serviceName: 'Codecov', category: 'cicd', confidence: 'high', reason: `GitHub Action "${action}"` }
    if (org === 'sonarsource') return { serviceName: 'SonarQube', category: 'monitoring', confidence: 'high', reason: `GitHub Action "${action}"` }
    return null
  }

  // Terraform providers
  if (value.startsWith('terraform:')) {
    const provider = value.replace('terraform:', '')
    return {
      serviceName: toTitleCase(provider.replace(/[-_]/g, ' ')),
      category: inferCategory(provider),
      confidence: 'high',
      reason: `Terraform provider "${provider}"`,
    }
  }

  // Known config files
  const configMap: Record<string, { name: string; category: ServiceCategory }> = {
    'vercel.json': { name: 'Vercel', category: 'hosting' },
    'netlify.toml': { name: 'Netlify', category: 'hosting' },
    'firebase.json': { name: 'Firebase', category: 'infra' },
    '.firebaserc': { name: 'Firebase', category: 'infra' },
    '.sentryclirc': { name: 'Sentry', category: 'monitoring' },
    'wrangler.toml': { name: 'Cloudflare Workers', category: 'hosting' },
    'railway.toml': { name: 'Railway', category: 'hosting' },
    'fly.toml': { name: 'Fly.io', category: 'hosting' },
    'render.yaml': { name: 'Render', category: 'hosting' },
    'amplify.yml': { name: 'AWS Amplify', category: 'hosting' },
    'Procfile': { name: 'Heroku', category: 'hosting' },
    'app.yaml': { name: 'Google App Engine', category: 'hosting' },
  }

  const mapped = configMap[value]
  if (mapped) {
    return {
      serviceName: mapped.name,
      category: mapped.category,
      confidence: 'high',
      reason: `Config file "${value}" found`,
    }
  }

  return null
}

function classifyCISecret(name: string): HeuristicResult | null {
  // CI secrets are basically env vars — reuse the env var classifier
  return classifyEnvVar(name)
}

function classifyDomain(value: string): HeuristicResult | null {
  // Known domain/service mappings (databases from docker images, DATABASE_URL, etc.)
  const n = value.toLowerCase()

  if (n === 'postgresql' || n === 'postgres') {
    return { serviceName: 'PostgreSQL', category: 'database', confidence: 'high', reason: 'PostgreSQL detected from connection string' }
  }
  if (n === 'mysql' || n === 'mariadb') {
    return { serviceName: 'MySQL', category: 'database', confidence: 'high', reason: 'MySQL detected from connection string' }
  }
  if (n === 'mongodb' || n === 'mongo') {
    return { serviceName: 'MongoDB', category: 'database', confidence: 'high', reason: 'MongoDB detected from connection string' }
  }
  if (n === 'redis') {
    return { serviceName: 'Redis', category: 'database', confidence: 'high', reason: 'Redis detected' }
  }
  if (n === 'nginx') {
    return { serviceName: 'Nginx', category: 'cdn', confidence: 'high', reason: 'Nginx reverse proxy detected' }
  }
  if (n === 'rabbitmq') {
    return { serviceName: 'RabbitMQ', category: 'messaging', confidence: 'high', reason: 'RabbitMQ detected' }
  }
  if (n === 'elasticsearch') {
    return { serviceName: 'Elasticsearch', category: 'data', confidence: 'high', reason: 'Elasticsearch detected' }
  }
  if (n === 'memcached') {
    return { serviceName: 'Memcached', category: 'database', confidence: 'high', reason: 'Memcached detected' }
  }
  if (n === 'minio') {
    return { serviceName: 'MinIO', category: 'storage', confidence: 'high', reason: 'MinIO S3-compatible storage detected' }
  }
  if (n === 'mailhog') {
    return { serviceName: 'MailHog', category: 'email', confidence: 'medium', reason: 'MailHog dev email server detected' }
  }

  // Domain from URL — classify by domain name
  const cleanDomain = n.replace(/^(api|app|cdn|www)\./i, '').split('.')[0]
  if (cleanDomain && cleanDomain.length >= 2) {
    const category = inferCategory(cleanDomain)
    if (category !== 'other') {
      return {
        serviceName: toTitleCase(cleanDomain),
        category,
        confidence: 'medium',
        reason: `Domain "${value}" suggests external service`,
      }
    }
  }

  return null
}

export function inferCategory(name: string): ServiceCategory {
  const n = name.toLowerCase()
  if (/redis|mongo|postgres|mysql|sqlite|dynamo|firestore|database|db|supabase|planetscale|neon|turso|cockroach|cassandra|couchdb|fauna|airtable|upstash/.test(n)) return 'database'
  if (/stripe|paypal|paddle|lemonsqueezy|payment|billing|invoice|checkout|braintree|square|razorpay/.test(n)) return 'payments'
  if (/mail|email|smtp|sendgrid|postmark|resend|mailgun|brevo|mailchimp|ses/.test(n)) return 'email'
  if (/sentry|datadog|newrelic|monitor|observ|log|error|trace|grafana|pagerduty|bugsnag|rollbar|honeybadger/.test(n)) return 'monitoring'
  if (/analytic|gtm|segment|mixpanel|amplitude|posthog|plausible|fathom|ga|google.analytics|hotjar|heap/.test(n)) return 'analytics'
  if (/s3|storage|blob|cloudinary|upload|bucket|media|imagekit|bunny|backblaze|minio|uploadthing/.test(n)) return 'storage'
  if (/auth|oauth|jwt|clerk|okta|cognito|auth0|keycloak|passport|supertokens/.test(n)) return 'auth'
  if (/vercel|netlify|railway|render|fly|heroku|deploy|hosting|surge|pages/.test(n)) return 'hosting'
  if (/github|gitlab|bitbucket|ci|cd|pipeline|action|jenkins|circleci|travis|codecov|sonar/.test(n)) return 'cicd'
  if (/openai|anthropic|groq|mistral|llm|gpt|claude|gemini|cohere|hugging|replicate|together|perplexity|wandb|mlflow/.test(n)) return 'ai'
  if (/twilio|vonage|sms|push|notification|onesignal|pusher|ably|socket|kafka|rabbitmq|nats/.test(n)) return 'messaging'
  if (/cloudflare|fastly|akamai|cdn|edge|bunnycdn/.test(n)) return 'cdn'
  if (/aws|gcp|azure|terraform|kubernetes|docker|infra|cloud|digitalocean|linode|hetzner/.test(n)) return 'infra'
  if (/domain|dns|namecheap|godaddy|route53|registrar/.test(n)) return 'domain'
  if (/firebase|appcenter|expo|capacitor|ionic/.test(n)) return 'mobile'
  if (/steam|discord|playfab|unity|unreal|gameanalytics/.test(n)) return 'gaming'
  if (/snowflake|databricks|pinecone|elastic|algolia|meilisearch|typesense/.test(n)) return 'data'
  if (/intercom|zendesk|freshdesk|crisp|helpscout|drift/.test(n)) return 'support'
  return 'other'
}

function extractApexDomain(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.hostname || null
  } catch {
    return null
  }
}

function toTitleCase(str: string): string {
  return str
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}
