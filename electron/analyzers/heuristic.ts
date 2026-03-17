import type { Evidence, HeuristicResult, ServiceCategory } from '../types'

export function classifyEvidences(evidences: Evidence[], projectName?: string): HeuristicResult[] {
  const results: HeuristicResult[] = []
  const normalizedProject = projectName
    ? projectName.toLowerCase().replace(/[^a-z0-9]/g, '')
    : null
  // Also support common variations of the project name (e.g., "cal.com" → "cal", "calcom", "calendso")
  const projectAliases: string[] = []
  if (normalizedProject) {
    projectAliases.push(normalizedProject)
    // Strip "com", "io", "dev" suffixes (e.g., "calcom" → "cal")
    const stripped = normalizedProject.replace(/(com|io|dev|app|org)$/i, '')
    if (stripped && stripped !== normalizedProject && stripped.length >= 2) {
      projectAliases.push(stripped)
    }
  }

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
      // Penalty: name contains the project name → -10
      if (projectAliases.length > 0) {
        const normalizedService = result.serviceName.toLowerCase().replace(/[^a-z0-9]/g, '')
        if (projectAliases.some(alias =>
          alias.length >= 4
            ? (normalizedService === alias || normalizedService.includes(alias))
            : normalizedService === alias
        )) {
          result.score -= 10
        }
      }

      // Penalty: name is a descriptive phrase (more than 2 words) → -3
      const wordCount = result.serviceName.trim().split(/\s+/).length
      if (wordCount > 2) {
        result.score -= 3
      }

      // Only include results with positive score
      if (result.score > 0) {
        results.push(result)
      }
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
  // Node.js / programming concepts (false positive prevention)
  'child', 'process', 'child process', 'spawn', 'exec', 'fork',
  'path', 'file', 'fs', 'buffer', 'stream', 'event', 'emitter',
  'promise', 'async', 'await', 'callback', 'handler', 'middleware',
  'component', 'module', 'package', 'library', 'framework',
  'build', 'dist', 'output', 'input', 'source', 'target',
  'secret', 'key', 'value', 'string', 'number', 'boolean',
  'request', 'response', 'header', 'body', 'query', 'param',
  'error', 'debug', 'info', 'warn', 'log', 'trace',
  'type', 'interface', 'class', 'function', 'method', 'property',
  'schema', 'model', 'entity', 'record', 'field', 'column',
  'table', 'index', 'cursor', 'iterator', 'generator',
  'connection', 'socket', 'channel', 'pipe', 'stdio',
  'timeout', 'interval', 'timer', 'delay', 'retry',
  'options', 'settings', 'preferences', 'constants',
  // CI/script action verbs and artifacts
  'run', 'deploy', 'release', 'trigger', 'exit', 'merge', 'branch',
  'head', 'last', 'full', 'seed', 'ci', 'project', 'team', 'single',
  'directory', 'sender', 'sink', 'edge',
  // Generic names that are not external services
  'api v2', 'auth bearer', 'last day', 'http code', 'exit code',
  'full prompt', 'original files', 'merge files', 'html report',
])

// Config suffixes that indicate internal parameters, not services — penalty -5
const CONFIG_SUFFIXES = [
  '_ENABLED', '_DISABLED', '_INTERVAL', '_DELAY_MS', '_DELAY', '_MINUTES',
  '_SECONDS', '_TIMEOUT', '_LIMIT', '_MAX', '_MIN', '_SIZE', '_COUNT',
  '_RATE', '_PRICE', '_COST', '_POLICY', '_ROLLOUT', '_REPORT', '_REPORTS',
  '_DIR', '_PATH', '_MODE', '_LEVEL', '_SCHEDULE', '_THRESHOLD', '_RETRIES',
  '_BATCH', '_TTL', '_CACHE', '_QUOTA', '_SEATS',
  // CI artifacts
  '_ARTIFACT', '_ARTIFACTS',
]

// CI variable patterns — penalty -5
const CI_VARIABLE_PATTERNS = [
  /^EXIT_CODE$/i, /^HTTP_CODE$/i, /^HEAD_REF$/i, /^HEAD_BRANCH$/i,
  /^BRANCH_NAME$/i, /^LAST_DAY$/i, /^HTML_REPORT$/i,
  /^DEVIN_/i, /^COPILOT_/i,
]

// Feature flag / app config patterns — penalty -5
const FEATURE_FLAG_PATTERNS = [
  /^IS_/i,                    // IS_E2E, IS_PREMIUM, IS_SELF_HOSTED
  /^DISABLE_/i,               // DISABLE_SIGNUP, etc. (further checked below)
  /^ENABLE_/i,                // ENABLE_* (further checked below)
  /^BOOKER_/i,                // App-specific UI config
  /^AVAILABILITY_/i,          // App-specific scheduling config
  /^COMPANY_NAME$/i,
  /^APP_NAME$/i,
  /^WEBSITE_URL$/i,
  /^WEBAPP_URL$/i,
  /^MINUTES_TO_BOOK$/i,
]

// Browser APIs / polyfills — penalty -5
const BROWSER_API_PATTERNS = [
  /_POLYFILL$/i, /_OBSERVER$/i, /_LOGIN_ENABLED$/i,
]

/** Check if an env var name ends in a config suffix — returns penalty */
function configSuffixPenalty(upper: string): number {
  if (CONFIG_SUFFIXES.some(suffix => upper.endsWith(suffix))) return -5
  return 0
}

/** Check if the env var matches CI variable patterns — hard filter */
function isCIVariable(upper: string): boolean {
  return CI_VARIABLE_PATTERNS.some(p => p.test(upper))
}

/** Check if the env var matches feature flag / app config patterns — hard filter */
function isFeatureFlag(upper: string): boolean {
  if (FEATURE_FLAG_PATTERNS.some(p => p.test(upper))) {
    // Exception: DISABLE_/ENABLE_ + known service name should still pass
    const stripped = upper.replace(/^(DISABLE_|ENABLE_)/, '')
    if (isKnownServiceToken(stripped)) return false
    return true
  }
  if (BROWSER_API_PATTERNS.some(p => p.test(upper))) return true
  // *_SEATS, *_CREDITS — pricing params
  if (/_SEATS$/i.test(upper) || /_CREDITS$/i.test(upper)) return true
  return false
}

/** Check if a token is a known real service (for DISABLE_/ENABLE_ exceptions) */
function isKnownServiceToken(token: string): boolean {
  const t = token.toLowerCase().replace(/_/g, '')
  const known = [
    'stripe', 'sendgrid', 'sentry', 'redis', 'postgres', 'vercel',
    'twilio', 'cloudflare', 'posthog', 'intercom', 'zendesk', 'salesforce',
    'github', 'datadog', 'newrelic', 'pagerduty', 'slack', 'aws', 'gcp',
    'azure', 'docker', 'heroku', 'netlify', 'firebase',
  ]
  return known.some(k => t.includes(k))
}

function isGenericName(name: string): boolean {
  return GENERIC_NAMES.has(name.toLowerCase().trim())
}

function classifyEnvVar(name: string): HeuristicResult | null {
  // Filter out template/placeholder variables ($SOMETHING, ${SOMETHING})
  if (name.startsWith('$') || name.startsWith('{') || name.includes('${')) return null

  const upper = name.toUpperCase()

  // Ignore system and framework variables (not evidence at all)
  const ignorePattern = /^(NODE_ENV|PORT|HOST|DEBUG|LOG_LEVEL|TZ|LANG|PATH|HOME|PWD|NEXT_PUBLIC_URL|VITE_APP_URL|PUBLIC_URL|HOSTNAME|SHELL|USER|TERM|EDITOR|CI|npm_\w+)$/
  if (ignorePattern.test(upper)) return null

  // Hard filter: CI variable patterns (not services)
  const stripped = upper
    .replace(/^(NEXT_PUBLIC_|VITE_|REACT_APP_|EXPO_PUBLIC_|NUXT_PUBLIC_|GATSBY_)/, '')
  if (isCIVariable(stripped)) return null

  // Hard filter: feature flags and app config patterns (not services)
  if (isFeatureFlag(stripped)) return null

  // Extract service candidate by removing generic prefixes and suffixes
  const serviceCandidate = stripped
    .replace(/^[^A-Z]+/, '') // strip leading non-alpha chars ($, digits, etc.)
    .replace(/_(SECRET|KEY|TOKEN|URL|HOST|PORT|USER|PASSWORD|API|ID|ENDPOINT|DSN|URI|BASE|REGION|BUCKET|PROJECT|APP|CLIENT|ACCESS|PRIVATE|PUBLIC|CONFIG|DOMAIN|ACCOUNT|ORG|WEBHOOK|CALLBACK|REDIRECT|VERSION|DATABASE|SIGNATURE|ENCRYPTION).*$/, '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .trim()

  if (!serviceCandidate || serviceCandidate.length < 2) return null
  if (isGenericName(serviceCandidate)) return null

  // Calculate base score by suffix type
  const isCredential = /_KEY$|_SECRET$|_TOKEN$|_PASSWORD$|_DSN$|_API_KEY$/.test(upper)
  const isEndpoint = /_URL$|_HOST$|_ENDPOINT$|_URI$/.test(upper)

  let score: number
  if (isCredential) {
    score = 7
  } else if (isEndpoint) {
    score = 6
  } else {
    score = 2
  }

  // Score penalty: config suffix → -5
  score += configSuffixPenalty(stripped)

  // Derive confidence from individual score
  const confidence = score >= 7 ? 'high' : score >= 5 ? 'medium' : 'low'

  return {
    serviceName: toTitleCase(serviceCandidate),
    category: inferCategory(serviceCandidate),
    confidence,
    reason: `Environment variable "${name}" suggests external service`,
    score,
    evidenceType: 'env_var',
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

  const score = 5

  return {
    serviceName: toTitleCase(serviceName),
    category: inferCategory(serviceName),
    confidence: 'medium',
    reason: `External URL "${url}" found in source code`,
    score,
    evidenceType: 'url',
  }
}

function classifyNpmPackage(pkg: string): HeuristicResult | null {
  // Ignore Node.js built-in modules
  if (NODE_BUILTINS.has(pkg)) return null

  // Extract service name from package name
  const name = pkg
    .replace(/^@/, '')
    .split('/')[0]
    .replace(/[-_](js|sdk|client|node|api|react|vue|next|browser|web|server|core|utils|helpers|lib|plugin)$/i, '')

  if (name.length < 2) return null
  if (isGenericName(name.replace(/[-_]/g, ' '))) return null

  return {
    serviceName: toTitleCase(name.replace(/[-_]/g, ' ')),
    category: inferCategory(name),
    confidence: 'low',
    reason: `npm package "${pkg}" suggests external service dependency`,
    score: 1,
    evidenceType: 'npm_package',
  }
}

// Node.js built-in modules — these are NOT external services
const NODE_BUILTINS = new Set([
  'child_process', 'fs', 'path', 'crypto', 'http', 'https', 'net', 'os', 'url',
  'util', 'stream', 'events', 'buffer', 'cluster', 'dgram', 'dns', 'readline',
  'tls', 'vm', 'zlib', 'assert', 'console', 'process', 'querystring',
  'string_decoder', 'timers', 'tty', 'v8', 'worker_threads', 'perf_hooks',
  'node:child_process', 'node:fs', 'node:path', 'node:crypto', 'node:http',
  'node:https', 'node:net', 'node:os', 'node:url', 'node:util', 'node:stream',
  'node:events', 'node:buffer', 'node:cluster', 'node:dns', 'node:readline',
  'node:tls', 'node:vm', 'node:zlib', 'node:assert', 'node:process',
  'node:worker_threads', 'node:perf_hooks',
  'fs/promises', 'node:fs/promises',
])

function classifyImport(importPath: string): HeuristicResult | null {
  // Filter out Node.js built-in modules
  if (NODE_BUILTINS.has(importPath)) return null

  // Extract the base package name
  const basePkg = importPath.startsWith('@')
    ? importPath.split('/').slice(0, 2).join('/')
    : importPath.split('/')[0]

  const result = classifyNpmPackage(basePkg)
  if (result) {
    result.evidenceType = 'import'
  }
  return result
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
      score: 10,
      evidenceType: 'config_file',
    }
  }

  // GitHub Actions
  if (value === 'github-actions') {
    return {
      serviceName: 'GitHub Actions',
      category: 'cicd',
      confidence: 'high',
      reason: 'GitHub Actions workflow found',
      score: 10,
      evidenceType: 'config_file',
    }
  }

  // CI action references
  if (value.startsWith('action:')) {
    const action = value.replace('action:', '')
    const org = action.split('/')[0]
    if (org === 'aws-actions') return { serviceName: 'AWS', category: 'infra', confidence: 'high', reason: `GitHub Action "${action}"`, score: 10, evidenceType: 'config_file' }
    if (org === 'google-github-actions') return { serviceName: 'Google Cloud', category: 'infra', confidence: 'high', reason: `GitHub Action "${action}"`, score: 10, evidenceType: 'config_file' }
    if (org === 'azure') return { serviceName: 'Azure', category: 'infra', confidence: 'high', reason: `GitHub Action "${action}"`, score: 10, evidenceType: 'config_file' }
    if (org === 'docker') return { serviceName: 'Docker Hub', category: 'infra', confidence: 'high', reason: `GitHub Action "${action}"`, score: 10, evidenceType: 'config_file' }
    if (org === 'codecov') return { serviceName: 'Codecov', category: 'cicd', confidence: 'high', reason: `GitHub Action "${action}"`, score: 10, evidenceType: 'config_file' }
    if (org === 'sonarsource') return { serviceName: 'SonarQube', category: 'monitoring', confidence: 'high', reason: `GitHub Action "${action}"`, score: 10, evidenceType: 'config_file' }
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
      score: 10,
      evidenceType: 'config_file',
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
      score: 10,
      evidenceType: 'config_file',
    }
  }

  return null
}

function classifyCISecret(name: string): HeuristicResult | null {
  // Filter out template/placeholder variables
  if (name.startsWith('$') || name.startsWith('{') || name.includes('${')) return null

  const upper = name.toUpperCase()

  // Ignore system variables
  const ignorePattern = /^(NODE_ENV|PORT|HOST|DEBUG|LOG_LEVEL|TZ|LANG|PATH|HOME|PWD|NEXT_PUBLIC_URL|VITE_APP_URL|PUBLIC_URL|HOSTNAME|SHELL|USER|TERM|EDITOR|CI|npm_\w+)$/
  if (ignorePattern.test(upper)) return null

  // Strip framework prefixes
  const stripped = upper
    .replace(/^(NEXT_PUBLIC_|VITE_|REACT_APP_|EXPO_PUBLIC_|NUXT_PUBLIC_|GATSBY_)/, '')

  // Hard filters
  if (isCIVariable(stripped)) return null
  if (isFeatureFlag(stripped)) return null

  // Extract service candidate
  const serviceCandidate = stripped
    .replace(/^[^A-Z]+/, '')
    .replace(/_(SECRET|KEY|TOKEN|URL|HOST|PORT|USER|PASSWORD|API|ID|ENDPOINT|DSN|URI|BASE|REGION|BUCKET|PROJECT|APP|CLIENT|ACCESS|PRIVATE|PUBLIC|CONFIG|DOMAIN|ACCOUNT|ORG|WEBHOOK|CALLBACK|REDIRECT|VERSION|DATABASE|SIGNATURE|ENCRYPTION).*$/, '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .trim()

  if (!serviceCandidate || serviceCandidate.length < 2) return null
  if (isGenericName(serviceCandidate)) return null

  // CI secrets have a base score of 8
  let score = 8

  // Score penalty: config suffix → -5
  score += configSuffixPenalty(stripped)

  const confidence = score >= 7 ? 'high' : score >= 5 ? 'medium' : 'low'

  return {
    serviceName: toTitleCase(serviceCandidate),
    category: inferCategory(serviceCandidate),
    confidence,
    reason: `CI secret "${name}" suggests external service`,
    score,
    evidenceType: 'ci_secret',
  }
}

function classifyDomain(value: string): HeuristicResult | null {
  // Known domain/service mappings (databases from docker images, DATABASE_URL, etc.)
  const n = value.toLowerCase()

  if (n === 'postgresql' || n === 'postgres') {
    return { serviceName: 'PostgreSQL', category: 'database', confidence: 'high', reason: 'PostgreSQL detected from connection string', score: 10, evidenceType: 'domain' }
  }
  if (n === 'mysql' || n === 'mariadb') {
    return { serviceName: 'MySQL', category: 'database', confidence: 'high', reason: 'MySQL detected from connection string', score: 10, evidenceType: 'domain' }
  }
  if (n === 'mongodb' || n === 'mongo') {
    return { serviceName: 'MongoDB', category: 'database', confidence: 'high', reason: 'MongoDB detected from connection string', score: 10, evidenceType: 'domain' }
  }
  if (n === 'redis') {
    return { serviceName: 'Redis', category: 'database', confidence: 'high', reason: 'Redis detected', score: 10, evidenceType: 'domain' }
  }
  if (n === 'nginx') {
    return { serviceName: 'Nginx', category: 'cdn', confidence: 'high', reason: 'Nginx reverse proxy detected', score: 10, evidenceType: 'domain' }
  }
  if (n === 'rabbitmq') {
    return { serviceName: 'RabbitMQ', category: 'messaging', confidence: 'high', reason: 'RabbitMQ detected', score: 10, evidenceType: 'domain' }
  }
  if (n === 'elasticsearch') {
    return { serviceName: 'Elasticsearch', category: 'data', confidence: 'high', reason: 'Elasticsearch detected', score: 10, evidenceType: 'domain' }
  }
  if (n === 'memcached') {
    return { serviceName: 'Memcached', category: 'database', confidence: 'high', reason: 'Memcached detected', score: 10, evidenceType: 'domain' }
  }
  if (n === 'minio') {
    return { serviceName: 'MinIO', category: 'storage', confidence: 'high', reason: 'MinIO S3-compatible storage detected', score: 10, evidenceType: 'domain' }
  }
  if (n === 'mailhog') {
    return { serviceName: 'MailHog', category: 'email', confidence: 'medium', reason: 'MailHog dev email server detected', score: 5, evidenceType: 'domain' }
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
        score: 5,
        evidenceType: 'domain',
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
  // Auth: includes SAML and Outlook (OAuth provider)
  if (/auth|oauth|jwt|clerk|okta|cognito|auth0|keycloak|passport|supertokens|saml|outlook/.test(n)) return 'auth'
  if (/vercel|netlify|railway|render|fly|heroku|deploy|hosting|surge|pages/.test(n)) return 'hosting'
  if (/github|gitlab|bitbucket|ci|cd|pipeline|action|jenkins|circleci|travis|codecov|sonar/.test(n)) return 'cicd'
  if (/openai|anthropic|groq|mistral|llm|gpt|claude|gemini|cohere|hugging|replicate|together|perplexity|wandb|mlflow/.test(n)) return 'ai'
  if (/twilio|vonage|sms|push|notification|onesignal|pusher|ably|socket|kafka|rabbitmq|nats/.test(n)) return 'messaging'
  if (/cloudflare|fastly|akamai|cdn|bunnycdn/.test(n)) return 'cdn'
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
