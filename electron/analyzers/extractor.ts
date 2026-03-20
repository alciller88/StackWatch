import fs from 'fs/promises'
import path from 'path'
import ignore from 'ignore'
import type { Evidence, Dependency, ProgressCallback } from '../types'

const EXCLUDED_DIRS = new Set([
  'node_modules', 'dist', '.next', 'build', '.git', 'coverage',
  '.nuxt', '.output', '__pycache__', '.venv', 'venv', 'target',
  '.svelte-kit', '.vercel', '.netlify', '.turbo', '.cache',
  '__tests__', '__mocks__',
])

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.rb',
  '.java', '.kt', '.swift', '.dart', '.cs', '.php',
])

const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024 // 1MB — skip large files to prevent memory exhaustion

async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    const stat = await fs.stat(filePath)
    if (stat.size > MAX_FILE_SIZE_BYTES) return null
    return await fs.readFile(filePath, 'utf-8')
  } catch {
    return null
  }
}

const IGNORED_DOMAINS = new Set([
  'localhost', '127.0.0.1', '0.0.0.0',
  // Documentation and standards
  'mozilla.org', 'developer.mozilla.org', 'w3.org', 'w3schools.com',
  'schema.org', 'json-schema.org', 'example.com', 'example.org',
  'tc39.es', 'ogp.me',
  'typescriptlang.org', 'reactjs.org', 'vuejs.org', 'nodejs.org',
  'wikipedia.org', 'stackoverflow.com',
  // Package registries and repos (not APIs you consume)
  'github.com', 'gitlab.com', 'npmjs.com', 'npmjs.org',
  'pypi.org', 'crates.io', 'pkg.go.dev',
  // CDNs for static assets
  'cdnjs.cloudflare.com', 'unpkg.com', 'cdnjs.com',
  'cdn.jsdelivr.net', 'esm.sh',
  'fonts.googleapis.com', 'fonts.gstatic.com',
  // Social media and content links
  'policies.google.com', 'support.google.com', 'accounts.google.com',
  'wa.me', 'whatsapp.com', 't.me',
  'reddit.com', 'www.reddit.com',
  'linkedin.com', 'www.linkedin.com',
  'facebook.com', 'www.facebook.com',
  'instagram.com', 'www.instagram.com',
  'youtube.com', 'www.youtube.com',
  'twitter.com', 'x.com',
  'raw.githubusercontent.com',
  // Social media CDNs (images, not APIs)
  'pbs.twimg.com', 'abs.twimg.com',
  'scontent.cdninstagram.com', 'fbcdn.net',
  // Avatar and placeholder services
  'unavatar.io', 'gravatar.com', 'ui-avatars.com',
  'picsum.photos', 'placeholder.com', 'via.placeholder.com', 'placehold.co',
])

/** Patterns that indicate a line contains a real network call, not just a content URL */
const API_CALL_PATTERNS = [
  // fetch() and variants
  /fetch\s*\(\s*[`'"](https?:\/\/[^`'"]+)[`'"]/,
  /fetch\s*\(\s*`[^`]*\$\{[^}]+\}[^`]*(https?:\/\/[^`'"]+)`/,
  // axios
  /axios\s*\.\s*(?:get|post|put|patch|delete|request|head|options)\s*\(\s*[`'"](https?:\/\/[^`'"]+)[`'"]/,
  /axios\s*\(\s*\{[^}]*url\s*:\s*[`'"](https?:\/\/[^`'"]+)[`'"]/,
  // new URL() — endpoint construction
  /new\s+URL\s*\(\s*[`'"](https?:\/\/[^`'"]+)[`'"]/,
  // baseURL / baseUrl in config objects
  /baseURL\s*:\s*[`'"](https?:\/\/[^`'"]+)[`'"]/,
  /baseUrl\s*:\s*[`'"](https?:\/\/[^`'"]+)[`'"]/,
  // url: in SDK/client config
  /\burl\s*:\s*[`'"](https?:\/\/[^`'"]+)[`'"]/,
  // endpoint: in config
  /\bendpoint\s*:\s*[`'"](https?:\/\/[^`'"]+)[`'"]/,
  // Generic http client patterns
  /\.get\s*\(\s*[`'"](https?:\/\/[^`'"]+)[`'"]/,
  /\.post\s*\(\s*[`'"](https?:\/\/[^`'"]+)[`'"]/,
  /\.put\s*\(\s*[`'"](https?:\/\/[^`'"]+)[`'"]/,
  /\.delete\s*\(\s*[`'"](https?:\/\/[^`'"]+)[`'"]/,
  /\.patch\s*\(\s*[`'"](https?:\/\/[^`'"]+)[`'"]/,
  // XMLHttpRequest
  /\.open\s*\(\s*['"][A-Z]+['"]\s*,\s*[`'"](https?:\/\/[^`'"]+)[`'"]/,
  // URLs assigned to constants/variables (e.g., const BASE_URL = 'https://api.service.com/...')
  /(?:const|let|var|=)\s*\w*(?:URL|Url|url|ENDPOINT|endpoint|BASE|base|API|api|HOST|host)\w*\s*=\s*[`'"](https?:\/\/[^`'"]+)[`'"]/,
]

/** Patterns for process.env references that look like service config (URLs, keys, tokens) */
const ENV_URL_PATTERN = /process\.env\.[A-Z_]*(URL|HOST|ENDPOINT|DSN|KEY|SECRET|TOKEN|BEARER|API_KEY|CREDENTIALS)[A-Z_]*/g

/** Lines matching these patterns contain content URLs, not API calls */
const CONTENT_LINE_PATTERNS = [
  /href\s*=\s*[`'"]/,       // <a href="..."> — navigation links
  /src\s*=\s*[`'"]/,        // <img src="..."> — images
  /action\s*=\s*[`'"]/,     // <form action="...">
  /^\s*\/\//,                // single-line comments
  /^\s*\*/,                  // block comment lines
  /^\s*\{?\s*\/\*/,          // start of block comments
]

const URL_REGEX = /https?:\/\/[^\s'"`,)}\]>]+/g
const IMPORT_FROM_REGEX = /from\s+['"]([^./][^'"]+)['"]/g
const REQUIRE_REGEX = /require\(\s*['"]([^./][^'"]+)['"]\s*\)/g
const CI_SECRET_REGEX = /\$\{\{\s*secrets\.(\w+)\s*\}\}/g
const CI_ENV_VAR_REGEX = /\$([A-Z][A-Z_]*_[A-Z_]{2,})/g

interface ExtractionResult {
  evidences: Evidence[]
  dependencies: Dependency[]
  projectName: string
  ecosystems: string[]
}

export async function extractEvidences(
  repoPath: string,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
): Promise<ExtractionResult> {
  const evidences: Evidence[] = []
  const dependencies: Dependency[] = []
  const projectDomain = await detectProjectDomain(repoPath)
  const projectName = await getProjectName(repoPath)

  const ig = ignore()
  try {
    const gitignoreContent = await fs.readFile(path.join(repoPath, '.gitignore'), 'utf-8')
    ig.add(gitignoreContent)
  } catch {
    // Expected: .gitignore may not exist
  }

  // Walk the repo
  onProgress?.({ phase: 'Walking file tree...', percent: 8, counts: { evidences: 0, services: 0, vulns: 0 } })
  if (signal?.aborted) throw new DOMException('Scan cancelled', 'AbortError')
  const files = await walkRepo(repoPath, repoPath, ig)

  // Emit progress every 50 files for smooth UI updates on large repos
  const PROGRESS_EVERY = 50
  for (let i = 0; i < files.length; i++) {
    const filePath = files[i]! // bounded by i < files.length
    if (signal?.aborted) throw new DOMException('Scan cancelled', 'AbortError')
    if (i > 0 && i % PROGRESS_EVERY === 0) {
      const filePercent = 10 + Math.round((i / files.length) * 32)
      onProgress?.({ phase: `Processing files (${i}/${files.length})...`, percent: filePercent, counts: { evidences: evidences.length, services: 0, vulns: 0 } })
    }
    const relPath = path.relative(repoPath, filePath)
    const basename = path.basename(filePath)
    const ext = path.extname(filePath)

    try {
      // package.json files
      if (basename === 'package.json') {
        const content = await readFileSafe(filePath)
        if (content) extractFromPackageJson(content, relPath, evidences, dependencies)
        continue
      }

      // .env files
      if (basename.startsWith('.env')) {
        const content = await readFileSafe(filePath)
        if (content) extractFromEnvFile(content, relPath, evidences, projectDomain)
        continue
      }

      // Docker compose
      if (basename === 'docker-compose.yml' || basename === 'docker-compose.yaml') {
        const content = await readFileSafe(filePath)
        if (content) extractFromDockerCompose(content, relPath, evidences)
        continue
      }

      // CI/CD workflow files
      if (relPath.includes('.github/workflows/') && (ext === '.yml' || ext === '.yaml')) {
        const content = await readFileSafe(filePath)
        if (content) extractFromCIWorkflow(content, relPath, evidences)
        continue
      }
      if (basename === '.gitlab-ci.yml' || basename === '.circleci') {
        const content = await readFileSafe(filePath)
        if (content) extractFromCIWorkflow(content, relPath, evidences)
        continue
      }

      // Config files at root
      if (isConfigFile(basename)) {
        evidences.push({ type: 'config_file', value: basename, file: relPath })
        continue
      }

      // Python deps
      if (basename === 'requirements.txt') {
        const content = await readFileSafe(filePath)
        if (content) extractFromRequirementsTxt(content, relPath, dependencies)
        continue
      }
      if (basename === 'pyproject.toml') {
        const content = await readFileSafe(filePath)
        if (content) extractFromPyprojectToml(content, relPath, dependencies)
        continue
      }
      if (basename === 'setup.py') {
        const content = await readFileSafe(filePath)
        if (content) extractFromSetupPy(content, relPath, dependencies)
        continue
      }

      // Rust deps
      if (basename === 'Cargo.toml') {
        const content = await readFileSafe(filePath)
        if (content) extractFromCargoToml(content, relPath, dependencies)
        continue
      }

      // Go deps
      if (basename === 'go.mod') {
        const content = await readFileSafe(filePath)
        if (content) extractFromGoMod(content, relPath, dependencies)
        continue
      }

      // .NET — *.csproj (NuGet packages)
      if (ext === '.csproj') {
        const content = await readFileSafe(filePath)
        if (content) extractFromCsproj(content, relPath, evidences, dependencies)
        continue
      }

      // .NET — appsettings*.json (connection strings, service config)
      if (basename.startsWith('appsettings') && ext === '.json') {
        const content = await readFileSafe(filePath)
        if (content) extractFromAppsettings(content, relPath, evidences)
        continue
      }

      // .NET — web.config (connection strings, endpoints)
      if (basename === 'web.config') {
        const content = await readFileSafe(filePath)
        if (content) extractFromWebConfig(content, relPath, evidences)
        continue
      }

      // Java — pom.xml (Maven dependencies)
      if (basename === 'pom.xml') {
        const content = await readFileSafe(filePath)
        if (content) extractFromPomXml(content, relPath, evidences, dependencies)
        continue
      }

      // Java — build.gradle / build.gradle.kts (Gradle dependencies)
      if (basename === 'build.gradle' || basename === 'build.gradle.kts') {
        const content = await readFileSafe(filePath)
        if (content) extractFromBuildGradle(content, relPath, evidences, dependencies)
        continue
      }

      // Java — application.properties / application-*.properties
      if (/^application(-\w+)?\.properties$/.test(basename)) {
        const content = await readFileSafe(filePath)
        if (content) extractFromApplicationProperties(content, relPath, evidences)
        continue
      }

      // Java — application.yml / application-*.yml
      if (/^application(-\w+)?\.ya?ml$/.test(basename)) {
        const content = await readFileSafe(filePath)
        if (content) extractFromApplicationYml(content, relPath, evidences)
        continue
      }

      // Ruby — Gemfile
      if (basename === 'Gemfile') {
        const content = await readFileSafe(filePath)
        if (content) extractFromGemfile(content, relPath, evidences, dependencies)
        continue
      }

      // Ruby — config/database.yml
      if (basename === 'database.yml' && relPath.includes('config')) {
        const content = await readFileSafe(filePath)
        if (content) extractFromDatabaseYml(content, relPath, evidences)
        continue
      }

      // PHP — composer.json
      if (basename === 'composer.json') {
        const content = await readFileSafe(filePath)
        if (content) extractFromComposerJson(content, relPath, evidences, dependencies)
        continue
      }

      // Python — Pipfile
      if (basename === 'Pipfile') {
        const content = await readFileSafe(filePath)
        if (content) extractFromPipfile(content, relPath, dependencies)
        continue
      }

      // Python — setup.cfg
      if (basename === 'setup.cfg') {
        const content = await readFileSafe(filePath)
        if (content) extractFromSetupCfg(content, relPath, dependencies)
        continue
      }

      // Terraform files
      if (ext === '.tf') {
        const content = await readFileSafe(filePath)
        if (content) extractFromTerraform(content, relPath, evidences)
        continue
      }

      // Source code files — extract URLs, imports, domains
      if (CODE_EXTENSIONS.has(ext)) {
        const content = await readFileSafe(filePath)
        if (content) extractFromSourceCode(content, relPath, evidences, projectDomain)
      }
    } catch {
      // Skip unreadable files
    }
  }

  // Detect ecosystems from dependencies
  const ecosystems = detectEcosystems(dependencies, files)

  return { evidences, dependencies, projectName, ecosystems }
}

const MAX_WALK_DEPTH = 15

async function walkRepo(
  root: string,
  dir: string,
  ig: ReturnType<typeof ignore>,
  depth: number = 0,
  visitedDirs: Set<string> = new Set(),
): Promise<string[]> {
  if (depth > MAX_WALK_DEPTH) return []

  const results: string[] = []

  // Detect circular symlinks by tracking visited real paths
  let realDir: string
  try {
    realDir = await fs.realpath(dir)
  } catch {
    return results
  }
  if (visitedDirs.has(realDir)) return results
  visitedDirs.add(realDir)

  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    // Expected: directory may not be readable
    return results
  }

  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry.name)) continue
    if (entry.name.startsWith('.') && entry.name !== '.env' && entry.name !== '.env.example'
        && entry.name !== '.env.local' && entry.name !== '.github' && entry.name !== '.gitlab-ci.yml'
        && entry.name !== '.circleci' && entry.name !== '.sentryclirc') continue

    const fullPath = path.join(dir, entry.name)
    const relPath = path.relative(root, fullPath)

    if (ig.ignores(relPath)) continue

    if (entry.isDirectory()) {
      // Check if symlink escapes root
      if (entry.isSymbolicLink()) {
        try {
          const realTarget = await fs.realpath(fullPath)
          const realRoot = await fs.realpath(root)
          if (!realTarget.startsWith(realRoot + path.sep) && realTarget !== realRoot) {
            continue // Symlink points outside repo root — skip
          }
        } catch {
          continue // Broken symlink — skip
        }
      }
      const nested = await walkRepo(root, fullPath, ig, depth + 1, visitedDirs)
      results.push(...nested)
    } else if (entry.isFile()) {
      // Skip test files — they contain example URLs/env vars that produce false positives
      if (/\.(test|spec)\.[jt]sx?$/.test(entry.name)) continue
      results.push(fullPath)
    }
  }

  return results
}

function extractFromPackageJson(
  content: string,
  file: string,
  evidences: Evidence[],
  deps: Dependency[],
): void {
  try {
    const pkg = JSON.parse(content)
    const processGroup = (group: Record<string, string> | undefined, type: Dependency['type']) => {
      if (!group) return
      for (const [name, version] of Object.entries(group)) {
        deps.push({ name, version, type, ecosystem: 'npm' })
        evidences.push({ type: 'npm_package', value: name, file })
      }
    }
    processGroup(pkg.dependencies, 'production')
    processGroup(pkg.devDependencies, 'development')
    processGroup(pkg.peerDependencies, 'peer')
  } catch {
    // invalid JSON
  }
}

function extractFromEnvFile(content: string, file: string, evidences: Evidence[], projectDomain: string | null): void {
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? ''
    if (!line || line.startsWith('#')) continue
    const eqIndex = line.indexOf('=')
    if (eqIndex <= 0) continue
    const key = line.substring(0, eqIndex).trim()
    const value = line.substring(eqIndex + 1).trim()
    evidences.push({ type: 'env_var', value: key, file, line: i + 1 })

    // Also extract URLs from env values
    if (value.startsWith('http://') || value.startsWith('https://')) {
      const domain = extractDomainFromUrl(value)
      if (domain && !IGNORED_DOMAINS.has(domain) && !isOwnDomain(domain, projectDomain)) {
        evidences.push({ type: 'url', value, file, line: i + 1 })
      }
    }

    // Detect DB from DATABASE_URL
    if (key === 'DATABASE_URL' || key.endsWith('_DATABASE_URL')) {
      if (value.startsWith('postgres')) {
        evidences.push({ type: 'domain', value: 'postgresql', file, line: i + 1 })
      } else if (value.startsWith('mysql')) {
        evidences.push({ type: 'domain', value: 'mysql', file, line: i + 1 })
      } else if (value.startsWith('mongodb')) {
        evidences.push({ type: 'domain', value: 'mongodb', file, line: i + 1 })
      }
    }
  }
}

function extractFromDockerCompose(content: string, file: string, evidences: Evidence[]): void {
  // Extract image names from docker-compose
  const imageRegex = /image:\s*['"]?([^\s'"#]+)/g
  let match
  while ((match = imageRegex.exec(content)) !== null) {
    const image = match[1]!.split(':')[0]! // strip tag; match[1] guaranteed by regex capture group
    evidences.push({ type: 'domain', value: image, file })
  }

  // Extract service names
  const servicesBlock = content.match(/^services:\s*\n((?:[ \t].*\n?)*)/m)
  if (servicesBlock) {
    const svcRegex = /^\s{2}(\w[\w-]*):/gm
    while ((match = svcRegex.exec(servicesBlock[1]!)) !== null) {
      evidences.push({ type: 'config_file', value: `docker-service:${match[1]!}`, file })
    }
  }
}

function extractFromCIWorkflow(content: string, file: string, evidences: Evidence[]): void {
  // GitHub Actions
  evidences.push({ type: 'config_file', value: 'github-actions', file })

  // Extract secrets references
  let match
  const secretsRegex = new RegExp(CI_SECRET_REGEX.source, 'g')
  while ((match = secretsRegex.exec(content)) !== null) {
    evidences.push({ type: 'ci_secret', value: match[1]!, file })
  }

  // Extract environment variable references
  const envRegex = new RegExp(CI_ENV_VAR_REGEX.source, 'g')
  while ((match = envRegex.exec(content)) !== null) {
    evidences.push({ type: 'ci_secret', value: match[1]!, file })
  }

  // Extract action uses
  const usesRegex = /uses:\s*['"]?([^@\s'"]+)/g
  while ((match = usesRegex.exec(content)) !== null) {
    const action = match[1]!
    if (action.includes('/')) {
      evidences.push({ type: 'config_file', value: `action:${action}`, file })
    }
  }
}

function isConfigFile(basename: string): boolean {
  const configFiles = new Set([
    'vercel.json', 'netlify.toml', 'firebase.json', '.sentryclirc',
    'wrangler.toml', 'railway.toml', 'fly.toml', 'render.yaml',
    'supabase', 'amplify.yml', '.firebaserc', 'appspec.yml',
    'Procfile', 'app.yaml', 'now.json',
  ])
  return configFiles.has(basename)
}

function extractFromSourceCode(content: string, file: string, evidences: Evidence[], projectDomain: string | null): void {
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]! // bounded by i < lines.length

    // Skip content lines (comments, href=, src=, action=)
    if (!isContentLine(line)) {
      // Extract URLs only from real API call patterns (stop at first match to avoid duplicates)
      for (const pattern of API_CALL_PATTERNS) {
        const match = line.match(pattern)
        if (match?.[1]) {
          const url = match[1]!.replace(/[),;'"}\]]+$/, '')
          const domain = extractDomainFromUrl(url)
          if (domain && !shouldIgnoreDomain(domain) && !isOwnDomain(domain, projectDomain)) {
            evidences.push({ type: 'url', value: url, file, line: i + 1 })
            evidences.push({ type: 'domain', value: domain, file, line: i + 1 })
          }
          break
        }
      }

      // Extract process.env references that look like service URLs
      let envMatch
      const envRegex = new RegExp(ENV_URL_PATTERN.source, 'g')
      while ((envMatch = envRegex.exec(line)) !== null) {
        evidences.push({ type: 'env_var', value: envMatch[0]!.replace('process.env.', ''), file, line: i + 1 })
      }
    }

    // Extract imports (from '...') — always, regardless of content context
    let importMatch
    const importRegex = new RegExp(IMPORT_FROM_REGEX.source, 'g')
    while ((importMatch = importRegex.exec(line)) !== null) {
      evidences.push({ type: 'import', value: importMatch[1]!, file, line: i + 1 })
    }

    // Extract requires
    let reqMatch
    const reqRegex = new RegExp(REQUIRE_REGEX.source, 'g')
    while ((reqMatch = reqRegex.exec(line)) !== null) {
      evidences.push({ type: 'import', value: reqMatch[1]!, file, line: i + 1 })
    }
  }
}

function isContentLine(line: string): boolean {
  return CONTENT_LINE_PATTERNS.some(p => p.test(line))
}

function shouldIgnoreDomain(domain: string): boolean {
  // api.* subdomains of social/content sites ARE real API calls (e.g. api.github.com, api.twitter.com)
  if (domain.startsWith('api.')) return false

  if (IGNORED_DOMAINS.has(domain)) return true
  // Check if any ignored domain is a suffix (e.g., 'x.fbcdn.net' matches 'fbcdn.net')
  for (const ignored of IGNORED_DOMAINS) {
    if (domain.endsWith('.' + ignored)) return true
  }
  return false
}

function extractDomainFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname
    if (!hostname || hostname === 'localhost' || /^[\d.]+$/.test(hostname)) return null
    return hostname
  } catch {
    // Expected: invalid URL format
    return null
  }
}

// --- Python dependency parsers ---

function extractFromRequirementsTxt(content: string, file: string, deps: Dependency[]): void {
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) continue
    const match = trimmed.match(/^([a-zA-Z0-9_.-]+)\s*(?:[><=!~]+\s*(.+))?/)
    if (match) {
      deps.push({ name: match[1]!, version: match[2] ?? '*', type: 'production', ecosystem: 'pip' })
    }
  }
}

function extractFromPyprojectToml(content: string, file: string, deps: Dependency[]): void {
  const depsMatch = content.match(/\[project\][\s\S]*?dependencies\s*=\s*\[([\s\S]*?)\]/)
  if (!depsMatch) return
  const entries = depsMatch[1]!.match(/"([^"]+)"|'([^']+)'/g) ?? []
  for (const entry of entries) {
    const clean = entry.replace(/["']/g, '')
    const match = clean.match(/^([a-zA-Z0-9_.-]+)/)
    if (match) {
      deps.push({ name: match[1]!, version: '*', type: 'production', ecosystem: 'pip' })
    }
  }
}

function extractFromSetupPy(content: string, file: string, deps: Dependency[]): void {
  const match = content.match(/install_requires\s*=\s*\[([\s\S]*?)\]/)
  if (!match) return
  const entries = match[1]!.match(/'([^']+)'|"([^"]+)"/g) ?? []
  for (const entry of entries) {
    const clean = entry.replace(/["']/g, '')
    const nameMatch = clean.match(/^([a-zA-Z0-9_.-]+)/)
    if (nameMatch) {
      deps.push({ name: nameMatch[1]!, version: '*', type: 'production', ecosystem: 'pip' })
    }
  }
}

// --- Rust dependency parser ---

function extractFromCargoToml(content: string, file: string, deps: Dependency[]): void {
  const sections = [
    { regex: /\[dependencies\]([\s\S]*?)(?=\n\[|$)/g, type: 'production' as const },
    { regex: /\[dev-dependencies\]([\s\S]*?)(?=\n\[|$)/g, type: 'development' as const },
    { regex: /\[build-dependencies\]([\s\S]*?)(?=\n\[|$)/g, type: 'development' as const },
  ]
  for (const section of sections) {
    let sectionMatch
    while ((sectionMatch = section.regex.exec(content)) !== null) {
      const block = sectionMatch[1]!
      const lineRegex = /^([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]+)"|\{.*?version\s*=\s*"([^"]+)".*\})/gm
      let lineMatch
      while ((lineMatch = lineRegex.exec(block)) !== null) {
        deps.push({
          name: lineMatch[1]!,
          version: lineMatch[2] ?? lineMatch[3] ?? '*',
          type: section.type,
          ecosystem: 'cargo',
        })
      }
    }
  }
}

// --- Go dependency parser ---

function extractFromGoMod(content: string, file: string, deps: Dependency[]): void {
  // Block require
  const blockRegex = /require\s*\(([\s\S]*?)\)/g
  let blockMatch
  while ((blockMatch = blockRegex.exec(content)) !== null) {
    const lines = blockMatch[1]!.split('\n')
    for (const line of lines) {
      const match = line.trim().match(/^(\S+)\s+(v[\d.]+\S*)/)
      if (match) {
        deps.push({ name: match[1]!, version: match[2]!, type: 'production', ecosystem: 'go' })
      }
    }
  }

  // Single-line require
  const singleRegex = /^require\s+(\S+)\s+(v[\d.]+\S*)/gm
  let singleMatch
  while ((singleMatch = singleRegex.exec(content)) !== null) {
    deps.push({ name: singleMatch[1]!, version: singleMatch[2]!, type: 'production', ecosystem: 'go' })
  }
}

// --- Terraform evidence ---

function extractFromTerraform(content: string, file: string, evidences: Evidence[]): void {
  // Provider blocks
  const providerRegex = /provider\s+"([^"]+)"/g
  let match
  while ((match = providerRegex.exec(content)) !== null) {
    const name = match[1]!
    if (!['random', 'null', 'local', 'template'].includes(name)) {
      evidences.push({ type: 'config_file', value: `terraform:${name}`, file })
    }
  }

  // Required providers
  const reqRegex = /(\w+)\s*=\s*\{[^}]*source\s*=\s*"([^"]+)"/g
  while ((match = reqRegex.exec(content)) !== null) {
    evidences.push({ type: 'config_file', value: `terraform:${match[1]!}`, file })
  }

  // Resource prefixes
  const resourceRegex = /resource\s+"(\w+?)_/g
  while ((match = resourceRegex.exec(content)) !== null) {
    const prefix = match[1]!
    if (!['random', 'null', 'local', 'template'].includes(prefix)) {
      evidences.push({ type: 'config_file', value: `terraform:${prefix}`, file })
    }
  }
}

// GitHub repo extraction using Octokit
export async function extractEvidencesFromGitHub(
  fetchFile: (path: string) => Promise<string | null>,
  listDir: (path: string) => Promise<string[]>,
): Promise<ExtractionResult> {
  const evidences: Evidence[] = []
  const dependencies: Dependency[] = []

  // package.json
  const pkgContent = await fetchFile('package.json')
  if (pkgContent) {
    extractFromPackageJson(pkgContent, 'package.json', evidences, dependencies)
  }

  // Detect own domain and project name from fetched content
  const projectDomain = detectProjectDomainFromContent(pkgContent)
  const projectName = getProjectNameFromContent(pkgContent)

  // .env files
  for (const envFile of ['.env', '.env.example', '.env.local']) {
    const content = await fetchFile(envFile)
    if (content) extractFromEnvFile(content, envFile, evidences, projectDomain)
  }

  // docker-compose
  for (const dcFile of ['docker-compose.yml', 'docker-compose.yaml']) {
    const content = await fetchFile(dcFile)
    if (content) extractFromDockerCompose(content, dcFile, evidences)
  }

  // GitHub workflows
  const workflowFiles = await listDir('.github/workflows')
  for (const wf of workflowFiles) {
    if (wf.endsWith('.yml') || wf.endsWith('.yaml')) {
      const content = await fetchFile(`.github/workflows/${wf}`)
      if (content) extractFromCIWorkflow(content, `.github/workflows/${wf}`, evidences)
    }
  }

  // Config files
  const configFileNames = [
    'vercel.json', 'netlify.toml', 'firebase.json', '.sentryclirc',
    'wrangler.toml', 'railway.toml', 'fly.toml', 'render.yaml',
  ]
  for (const cf of configFileNames) {
    const content = await fetchFile(cf)
    if (content) evidences.push({ type: 'config_file', value: cf, file: cf })
  }

  // Python deps
  for (const pyFile of ['requirements.txt', 'pyproject.toml', 'setup.py']) {
    const content = await fetchFile(pyFile)
    if (content) {
      if (pyFile === 'requirements.txt') extractFromRequirementsTxt(content, pyFile, dependencies)
      else if (pyFile === 'pyproject.toml') extractFromPyprojectToml(content, pyFile, dependencies)
      else extractFromSetupPy(content, pyFile, dependencies)
    }
  }

  // Rust deps
  const cargoContent = await fetchFile('Cargo.toml')
  if (cargoContent) extractFromCargoToml(cargoContent, 'Cargo.toml', dependencies)

  // Go deps
  const goModContent = await fetchFile('go.mod')
  if (goModContent) extractFromGoMod(goModContent, 'go.mod', dependencies)

  // .NET deps
  const rootFiles = await listDir('.')
  for (const file of rootFiles) {
    if (file.endsWith('.csproj')) {
      const content = await fetchFile(file)
      if (content) extractFromCsproj(content, file, evidences, dependencies)
    }
  }
  // .NET config
  for (const cfgFile of ['appsettings.json', 'appsettings.Development.json', 'web.config']) {
    const content = await fetchFile(cfgFile)
    if (content) {
      if (cfgFile === 'web.config') extractFromWebConfig(content, cfgFile, evidences)
      else extractFromAppsettings(content, cfgFile, evidences)
    }
  }

  // Java — Maven
  const pomContent = await fetchFile('pom.xml')
  if (pomContent) extractFromPomXml(pomContent, 'pom.xml', evidences, dependencies)

  // Java — Gradle
  for (const gradleFile of ['build.gradle', 'build.gradle.kts']) {
    const content = await fetchFile(gradleFile)
    if (content) extractFromBuildGradle(content, gradleFile, evidences, dependencies)
  }

  // Java — Spring config
  const springConfigDirs = ['src/main/resources', 'src/main/resources']
  for (const dir of springConfigDirs) {
    for (const propFile of ['application.properties', 'application.yml', 'application.yaml']) {
      const content = await fetchFile(`${dir}/${propFile}`)
      if (content) {
        if (propFile.endsWith('.properties')) extractFromApplicationProperties(content, `${dir}/${propFile}`, evidences)
        else extractFromApplicationYml(content, `${dir}/${propFile}`, evidences)
      }
    }
  }

  // Ruby — Gemfile
  const gemfileContent = await fetchFile('Gemfile')
  if (gemfileContent) extractFromGemfile(gemfileContent, 'Gemfile', evidences, dependencies)

  // Ruby — config files
  for (const rbConfig of ['config/database.yml', 'config/application.yml']) {
    const content = await fetchFile(rbConfig)
    if (content) {
      if (rbConfig.includes('database')) extractFromDatabaseYml(content, rbConfig, evidences)
      else extractFromApplicationYml(content, rbConfig, evidences)
    }
  }

  // PHP — Composer
  const composerContent = await fetchFile('composer.json')
  if (composerContent) extractFromComposerJson(composerContent, 'composer.json', evidences, dependencies)

  // Python — Pipfile, setup.cfg
  const pipfileContent = await fetchFile('Pipfile')
  if (pipfileContent) extractFromPipfile(pipfileContent, 'Pipfile', dependencies)
  const setupCfgContent = await fetchFile('setup.cfg')
  if (setupCfgContent) extractFromSetupCfg(setupCfgContent, 'setup.cfg', dependencies)

  // Terraform
  for (const file of rootFiles) {
    if (file.endsWith('.tf')) {
      const content = await fetchFile(file)
      if (content) extractFromTerraform(content, file, evidences)
    }
  }

  // Source code from key directories (limited depth for GitHub to avoid too many API calls)
  const codeDirs = ['src', 'lib', 'app', 'pages', 'api', 'server', 'backend', 'frontend']
  for (const dir of codeDirs) {
    const files = await listDir(dir)
    for (const f of files) {
      const ext = path.extname(f)
      if (CODE_EXTENSIONS.has(ext)) {
        const content = await fetchFile(`${dir}/${f}`)
        if (content) extractFromSourceCode(content, `${dir}/${f}`, evidences, projectDomain)
      }
    }
  }

  // Detect ecosystems
  const allFetchedFiles = [...rootFiles]
  const ecosystems = detectEcosystems(dependencies, allFetchedFiles)

  return { evidences, dependencies, projectName, ecosystems }
}

// --- Project domain detection (filters own domain from services) ---

async function detectProjectDomain(repoPath: string): Promise<string | null> {
  // 1. From .env files — domain variables
  const envFiles = ['.env', '.env.local', '.env.production', '.env.example']
  const domainVars = [
    'NEXT_PUBLIC_URL', 'NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_APP_URL',
    'PUBLIC_URL', 'APP_URL', 'SITE_URL', 'VERCEL_URL',
  ]

  for (const envFile of envFiles) {
    try {
      const content = await fs.readFile(path.join(repoPath, envFile), 'utf-8')
      const vars = parseEnvVars(content)
      for (const v of domainVars) {
        const val = vars[v]
        if (val) {
          const apex = extractApexDomain(val)
          if (apex) return apex
        }
      }
    } catch { /* Expected: file may not exist */ }
  }

  // 2. From vercel.json alias
  try {
    const vercelContent = await fs.readFile(path.join(repoPath, 'vercel.json'), 'utf-8')
    const vercelConfig = JSON.parse(vercelContent)
    if (vercelConfig?.alias?.[0]) {
      const apex = extractApexDomain(vercelConfig.alias[0])
      if (apex) return apex
    }
  } catch { /* Expected: file may not exist */ }

  // 3. Fallback: package.json name
  try {
    const pkgContent = await fs.readFile(path.join(repoPath, 'package.json'), 'utf-8')
    const pkg = JSON.parse(pkgContent)
    if (pkg?.name) return pkg.name.replace(/[^a-z0-9]/gi, '').toLowerCase()
  } catch { /* Expected: file may not exist */ }

  return null
}

function detectProjectDomainFromContent(pkgContent: string | null): string | null {
  if (!pkgContent) return null
  try {
    const pkg = JSON.parse(pkgContent)
    if (pkg?.name) return pkg.name.replace(/[^a-z0-9]/gi, '').toLowerCase()
  } catch { /* invalid JSON */ }
  return null
}

function extractApexDomain(urlOrDomain: string): string | null {
  try {
    const url = urlOrDomain.includes('://') ? urlOrDomain : `https://${urlOrDomain}`
    const { hostname } = new URL(url)
    return hostname.replace(/^www\./, '').split('.')[0]!.toLowerCase()
  } catch {
    // Expected: invalid URL format
    return null
  }
}

function isOwnDomain(domain: string, projectDomain: string | null): boolean {
  if (!projectDomain) return false
  const apex = domain.replace(/^www\./, '').split('.')[0]!.toLowerCase()
  return apex === projectDomain.toLowerCase()
}

function parseEnvVars(content: string): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex <= 0) continue
    vars[trimmed.substring(0, eqIndex).trim()] = trimmed.substring(eqIndex + 1).trim().replace(/^["']|["']$/g, '')
  }
  return vars
}

// --- Project name detection (for graph node label) ---

async function getProjectName(repoPath: string): Promise<string> {
  // 1. stackwatch.config.json
  try {
    const content = await fs.readFile(path.join(repoPath, 'stackwatch.config.json'), 'utf-8')
    const config = JSON.parse(content)
    if (config?.project?.name) return config.project.name
  } catch { /* Expected: file may not exist */ }

  // 2. package.json name
  try {
    const content = await fs.readFile(path.join(repoPath, 'package.json'), 'utf-8')
    const pkg = JSON.parse(content)
    if (pkg?.name) return formatProjectName(pkg.name)
  } catch { /* Expected: file may not exist */ }

  // 3. Folder name fallback
  return formatProjectName(path.basename(repoPath))
}

function getProjectNameFromContent(pkgContent: string | null): string {
  if (pkgContent) {
    try {
      const pkg = JSON.parse(pkgContent)
      if (pkg?.name) return formatProjectName(pkg.name)
    } catch { /* invalid JSON */ }
  }
  return 'App'
}

function formatProjectName(raw: string): string {
  return raw
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\s*(temp|dev|test|local)\s*/gi, '')
    .trim() || 'App'
}

// --- Ecosystem detection ---

/** Ecosystem markers: file basenames/extensions that identify a project's technology */
const ECOSYSTEM_FILE_MARKERS: Record<string, string> = {
  'package.json': 'node',
  'requirements.txt': 'python',
  'pyproject.toml': 'python',
  'Pipfile': 'python',
  'setup.py': 'python',
  'setup.cfg': 'python',
  'Cargo.toml': 'rust',
  'go.mod': 'go',
  'Gemfile': 'ruby',
  'composer.json': 'php',
  'pom.xml': 'java',
  'build.gradle': 'java',
  'build.gradle.kts': 'java',
}

const ECOSYSTEM_EXT_MARKERS: Record<string, string> = {
  '.csproj': 'dotnet',
  '.sln': 'dotnet',
}

function detectEcosystems(deps: Dependency[], files: string[]): string[] {
  const ecosystems = new Set<string>()

  // From dependencies
  const depEcoMap: Record<string, string> = {
    npm: 'node', pip: 'python', cargo: 'rust', go: 'go',
    gem: 'ruby', composer: 'php', maven: 'java', gradle: 'java',
    nuget: 'dotnet', dart: 'dart',
  }
  for (const d of deps) {
    const eco = depEcoMap[d.ecosystem]
    if (eco) ecosystems.add(eco)
  }

  // From file markers
  for (const f of files) {
    const basename = path.basename(f)
    const ext = path.extname(f)
    const byName = ECOSYSTEM_FILE_MARKERS[basename]
    if (byName) ecosystems.add(byName)
    const byExt = ECOSYSTEM_EXT_MARKERS[ext]
    if (byExt) ecosystems.add(byExt)
  }

  return Array.from(ecosystems).sort()
}

// --- .NET parsers ---

function extractFromCsproj(content: string, file: string, evidences: Evidence[], deps: Dependency[]): void {
  // Parse <PackageReference Include="PackageName" Version="1.0.0" />
  const pkgRefRegex = /<PackageReference\s+Include="([^"]+)"(?:\s+Version="([^"]*)")?/gi
  let match
  while ((match = pkgRefRegex.exec(content)) !== null) {
    const name = match[1]!
    const version = match[2] ?? '*'
    deps.push({ name, version, type: 'production', ecosystem: 'nuget' })
    // Generate evidence for heuristic classification
    evidences.push({ type: 'import', value: name, file })
  }

  // Also handle <DotNetCliToolReference> and <PackageVersion>
  const toolRefRegex = /<DotNetCliToolReference\s+Include="([^"]+)"(?:\s+Version="([^"]*)")?/gi
  while ((match = toolRefRegex.exec(content)) !== null) {
    deps.push({ name: match[1]!, version: match[2] ?? '*', type: 'development', ecosystem: 'nuget' })
  }
}

function extractFromAppsettings(content: string, file: string, evidences: Evidence[]): void {
  try {
    const config = JSON.parse(content)
    extractFromJsonConfig(config, file, evidences, '')
  } catch {
    // Invalid JSON — skip
  }
}

/** Recursively extract evidences from JSON config objects (appsettings.json, etc.) */
function extractFromJsonConfig(obj: unknown, file: string, evidences: Evidence[], prefix: string): void {
  if (obj === null || obj === undefined || typeof obj !== 'object') return

  if (Array.isArray(obj)) {
    for (const item of obj) {
      extractFromJsonConfig(item, file, evidences, prefix)
    }
    return
  }

  const record = obj as Record<string, unknown>
  for (const [key, value] of Object.entries(record)) {
    const fullKey = prefix ? `${prefix}:${key}` : key

    if (typeof value === 'string' && value.length > 0) {
      // Connection strings — detect database protocols
      if (/^(ConnectionStrings?|connectionString)/i.test(prefix) || /^(ConnectionStrings?)/i.test(key)) {
        if (/Server=|Data Source=/i.test(value)) {
          evidences.push({ type: 'domain', value: 'sqlserver', file })
        } else if (value.startsWith('mongodb')) {
          evidences.push({ type: 'domain', value: 'mongodb', file })
        } else if (value.startsWith('postgres')) {
          evidences.push({ type: 'domain', value: 'postgresql', file })
        } else if (value.startsWith('mysql')) {
          evidences.push({ type: 'domain', value: 'mysql', file })
        } else if (value.startsWith('redis')) {
          evidences.push({ type: 'domain', value: 'redis', file })
        } else if (/amqp:\/\//i.test(value)) {
          evidences.push({ type: 'domain', value: 'rabbitmq', file })
        }
      }

      // URLs in config values
      if (value.startsWith('http://') || value.startsWith('https://')) {
        const domain = extractDomainFromUrl(value)
        if (domain && !IGNORED_DOMAINS.has(domain)) {
          evidences.push({ type: 'url', value, file })
        }
      }

      // Treat config keys that look like API key / secret / token as env_var evidence
      const upperKey = key.toUpperCase()
      if (/_KEY$|_SECRET$|_TOKEN$|KEY$|SECRET$|TOKEN$|DSN$/i.test(key) && value.length > 5) {
        evidences.push({ type: 'env_var', value: fullKey.replace(/:/g, '_').toUpperCase(), file })
      }
      // Treat keys named after services as config_file evidence
      if (/^(ApiKey|SecretKey|AccessKey|ConnectionString)$/i.test(key) && prefix) {
        evidences.push({ type: 'env_var', value: `${prefix.replace(/:/g, '_').toUpperCase()}_${upperKey}`, file })
      }
    } else if (typeof value === 'object' && value !== null) {
      extractFromJsonConfig(value, file, evidences, fullKey)
    }
  }
}

function extractFromWebConfig(content: string, file: string, evidences: Evidence[]): void {
  // Connection strings: <add name="..." connectionString="..." />
  const connStrRegex = /connectionString="([^"]+)"/gi
  let match
  while ((match = connStrRegex.exec(content)) !== null) {
    const cs = match[1]!
    if (/Server=|Data Source=/i.test(cs)) {
      evidences.push({ type: 'domain', value: 'sqlserver', file })
    } else if (cs.startsWith('mongodb')) {
      evidences.push({ type: 'domain', value: 'mongodb', file })
    } else if (cs.startsWith('postgres')) {
      evidences.push({ type: 'domain', value: 'postgresql', file })
    }
  }

  // appSettings keys
  const appSettingRegex = /<add\s+key="([^"]+)"\s+value="([^"]*)"\s*\/>/gi
  while ((match = appSettingRegex.exec(content)) !== null) {
    const key = match[1]!
    const value = match[2] ?? ''
    if (/_KEY$|_SECRET$|_TOKEN$|_URL$|_DSN$/i.test(key)) {
      evidences.push({ type: 'env_var', value: key, file })
    }
    if (value.startsWith('http://') || value.startsWith('https://')) {
      const domain = extractDomainFromUrl(value)
      if (domain && !IGNORED_DOMAINS.has(domain)) {
        evidences.push({ type: 'url', value, file })
      }
    }
  }
}

// --- Java parsers ---

function extractFromPomXml(content: string, file: string, evidences: Evidence[], deps: Dependency[]): void {
  // Parse <dependency> blocks: <groupId>...</groupId> <artifactId>...</artifactId> <version>...</version>
  const depBlockRegex = /<dependency>\s*([\s\S]*?)<\/dependency>/gi
  let match
  while ((match = depBlockRegex.exec(content)) !== null) {
    const block = match[1]!
    const groupId = block.match(/<groupId>([^<]+)<\/groupId>/)?.[1]
    const artifactId = block.match(/<artifactId>([^<]+)<\/artifactId>/)?.[1]
    const version = block.match(/<version>([^<]+)<\/version>/)?.[1] ?? '*'
    const scope = block.match(/<scope>([^<]+)<\/scope>/)?.[1]

    if (artifactId) {
      const depType = scope === 'test' ? 'development' : 'production'
      deps.push({ name: groupId ? `${groupId}:${artifactId}` : artifactId, version, type: depType, ecosystem: 'maven' })
      // Generate evidence from artifactId (more meaningful than groupId:artifactId)
      evidences.push({ type: 'import', value: artifactId, file })
    }
  }
}

function extractFromBuildGradle(content: string, file: string, evidences: Evidence[], deps: Dependency[]): void {
  // Gradle dependency patterns:
  // implementation 'group:artifact:version'
  // implementation("group:artifact:version")
  // implementation "group:artifact:version"
  // testImplementation ...
  // api ...
  const depRegex = /(?:implementation|api|compileOnly|runtimeOnly|testImplementation|testRuntimeOnly|kapt|annotationProcessor)\s*[\("']([^)"']+)[\)"']/gi
  let match
  while ((match = depRegex.exec(content)) !== null) {
    const parts = match[1]!.split(':')
    if (parts.length >= 2) {
      const groupId = parts[0]!
      const artifactId = parts[1]!
      const version = parts[2] ?? '*'
      const isTest = /^test/i.test(match[0]!)
      deps.push({
        name: `${groupId}:${artifactId}`,
        version,
        type: isTest ? 'development' : 'production',
        ecosystem: 'gradle',
      })
      evidences.push({ type: 'import', value: artifactId, file })
    }
  }
}

function extractFromApplicationProperties(content: string, file: string, evidences: Evidence[]): void {
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex <= 0) continue
    const key = trimmed.substring(0, eqIndex).trim()
    const value = trimmed.substring(eqIndex + 1).trim()

    // Database URLs
    if (key.includes('datasource.url') || key.includes('database.url')) {
      if (value.includes('postgresql') || value.includes('postgres')) {
        evidences.push({ type: 'domain', value: 'postgresql', file })
      } else if (value.includes('mysql')) {
        evidences.push({ type: 'domain', value: 'mysql', file })
      } else if (value.includes('mongodb')) {
        evidences.push({ type: 'domain', value: 'mongodb', file })
      } else if (value.includes('sqlserver') || value.includes('mssql')) {
        evidences.push({ type: 'domain', value: 'sqlserver', file })
      } else if (value.includes('h2') || value.includes('hsqldb')) {
        // In-memory DB — skip
      }
    }

    // Redis
    if (key.includes('redis.host') || key.includes('redis.url')) {
      evidences.push({ type: 'domain', value: 'redis', file })
    }

    // RabbitMQ / AMQP
    if (key.includes('rabbitmq.host') || key.includes('amqp')) {
      evidences.push({ type: 'domain', value: 'rabbitmq', file })
    }

    // Kafka
    if (key.includes('kafka.bootstrap')) {
      evidences.push({ type: 'env_var', value: 'KAFKA_BOOTSTRAP_SERVERS', file })
    }

    // MongoDB
    if (key.includes('mongodb.uri') || key.includes('mongo.uri')) {
      evidences.push({ type: 'domain', value: 'mongodb', file })
    }

    // Generic: API keys, tokens, secrets in properties
    if (/\.(api-key|api_key|secret|token|key)$/i.test(key)) {
      const servicePart = key.split('.').slice(-2, -1)[0] ?? ''
      if (servicePart.length >= 2) {
        evidences.push({ type: 'env_var', value: `${servicePart.toUpperCase()}_KEY`, file })
      }
    }

    // URLs
    if (value.startsWith('http://') || value.startsWith('https://')) {
      const domain = extractDomainFromUrl(value)
      if (domain && !IGNORED_DOMAINS.has(domain)) {
        evidences.push({ type: 'url', value, file })
      }
    }
  }
}

function extractFromApplicationYml(content: string, file: string, evidences: Evidence[]): void {
  // Simple YAML key:value parsing (avoids adding a YAML parser dependency)
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    // Database URL patterns
    if (/url:\s*jdbc:(postgresql|mysql|sqlserver|oracle|mariadb)/i.test(trimmed)) {
      const dbMatch = trimmed.match(/jdbc:(\w+)/i)
      if (dbMatch) {
        const db = dbMatch[1]!.toLowerCase()
        if (db === 'postgresql' || db === 'postgres') evidences.push({ type: 'domain', value: 'postgresql', file })
        else if (db === 'mysql' || db === 'mariadb') evidences.push({ type: 'domain', value: 'mysql', file })
        else if (db === 'sqlserver') evidences.push({ type: 'domain', value: 'sqlserver', file })
      }
    }

    // Redis host
    if (/redis:\s*$/.test(trimmed) || /host:\s*\S+/.test(trimmed) && line.includes('redis')) {
      evidences.push({ type: 'domain', value: 'redis', file })
    }

    // MongoDB URI
    if (/mongodb(\+srv)?:\/\//i.test(trimmed)) {
      evidences.push({ type: 'domain', value: 'mongodb', file })
    }

    // RabbitMQ
    if (/rabbitmq:/i.test(trimmed)) {
      evidences.push({ type: 'domain', value: 'rabbitmq', file })
    }

    // Kafka
    if (/kafka:/i.test(trimmed) && /bootstrap/i.test(trimmed)) {
      evidences.push({ type: 'env_var', value: 'KAFKA_BOOTSTRAP_SERVERS', file })
    }

    // URLs in values
    const urlMatch = trimmed.match(/:\s*(https?:\/\/\S+)/i)
    if (urlMatch) {
      const domain = extractDomainFromUrl(urlMatch[1]!)
      if (domain && !IGNORED_DOMAINS.has(domain)) {
        evidences.push({ type: 'url', value: urlMatch[1]!, file })
      }
    }
  }
}

// --- Ruby parsers ---

function extractFromGemfile(content: string, file: string, evidences: Evidence[], deps: Dependency[]): void {
  // gem 'name', '~> 1.0'
  // gem "name", ">= 2.0", "< 3.0"
  // gem 'name', group: :development
  const gemRegex = /^\s*gem\s+['"]([^'"]+)['"]\s*(?:,\s*['"]([^'"]*)['"]\s*)?(?:,\s*['"]([^'"]*)['"]\s*)?/gm
  let match
  while ((match = gemRegex.exec(content)) !== null) {
    const name = match[1]!
    const version = match[2] ?? '*'
    // Check if it's a dev/test group
    const lineEnd = content.substring(match.index!, content.indexOf('\n', match.index!))
    const isDev = /group:\s*(?::development|:test|\[:development|:dev)/i.test(lineEnd)
    deps.push({ name, version, type: isDev ? 'development' : 'production', ecosystem: 'gem' })
    evidences.push({ type: 'import', value: name, file })
  }

  // group :development block
  const groupBlockRegex = /group\s+(?::development|:test)\s+do\s*([\s\S]*?)end/gi
  while ((match = groupBlockRegex.exec(content)) !== null) {
    const block = match[1]!
    const innerGemRegex = /gem\s+['"]([^'"]+)['"](?:\s*,\s*['"]([^'"]*)['"]\s*)?/g
    let innerMatch
    while ((innerMatch = innerGemRegex.exec(block)) !== null) {
      const name = innerMatch[1]!
      // Mark as dev if not already added
      const existing = deps.find(d => d.name === name && d.ecosystem === 'gem')
      if (!existing) {
        deps.push({ name, version: innerMatch[2] ?? '*', type: 'development', ecosystem: 'gem' })
        evidences.push({ type: 'import', value: name, file })
      }
    }
  }
}

function extractFromDatabaseYml(content: string, file: string, evidences: Evidence[]): void {
  // Rails database.yml — detect adapter types
  const adapterRegex = /adapter:\s*['"]?(\w+)['"]?/gi
  let match
  while ((match = adapterRegex.exec(content)) !== null) {
    const adapter = match[1]!.toLowerCase()
    if (adapter === 'postgresql' || adapter === 'postgres') {
      evidences.push({ type: 'domain', value: 'postgresql', file })
    } else if (adapter === 'mysql2' || adapter === 'mysql') {
      evidences.push({ type: 'domain', value: 'mysql', file })
    } else if (adapter === 'sqlite3') {
      // SQLite is local — skip
    } else if (adapter === 'mongodb' || adapter === 'mongoid') {
      evidences.push({ type: 'domain', value: 'mongodb', file })
    }
  }

  // URLs in database.yml
  const urlRegex = /url:\s*['"]?((?:postgres|mysql|mongodb)\w*:\/\/[^\s'"]+)/gi
  while ((match = urlRegex.exec(content)) !== null) {
    const url = match[1]!
    if (url.startsWith('postgres')) evidences.push({ type: 'domain', value: 'postgresql', file })
    else if (url.startsWith('mysql')) evidences.push({ type: 'domain', value: 'mysql', file })
    else if (url.startsWith('mongodb')) evidences.push({ type: 'domain', value: 'mongodb', file })
  }

  // Redis URL in database config
  if (/redis:\/\//i.test(content)) {
    evidences.push({ type: 'domain', value: 'redis', file })
  }
}

// --- PHP parsers ---

function extractFromComposerJson(content: string, file: string, evidences: Evidence[], deps: Dependency[]): void {
  try {
    const composer = JSON.parse(content)
    const processGroup = (group: Record<string, string> | undefined, type: Dependency['type']) => {
      if (!group || typeof group !== 'object') return
      for (const [name, version] of Object.entries(group)) {
        // Skip PHP platform requirements
        if (name === 'php' || name.startsWith('ext-')) continue
        deps.push({ name, version, type, ecosystem: 'composer' })
        // Use the package part after vendor/ for evidence
        const pkgName = name.includes('/') ? name.split('/')[1]! : name
        evidences.push({ type: 'import', value: pkgName, file })
        // Also push full vendor/package as import for better brand matching
        evidences.push({ type: 'import', value: name, file })
      }
    }
    processGroup(composer.require, 'production')
    processGroup(composer['require-dev'], 'development')
  } catch {
    // Invalid JSON
  }
}

// --- Additional Python parsers ---

function extractFromPipfile(content: string, file: string, deps: Dependency[]): void {
  let currentSection: 'packages' | 'dev-packages' | null = null

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '[packages]') { currentSection = 'packages'; continue }
    if (trimmed === '[dev-packages]') { currentSection = 'dev-packages'; continue }
    if (trimmed.startsWith('[')) { currentSection = null; continue }

    if (currentSection && trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^([a-zA-Z0-9_.-]+)\s*=/)
      if (match) {
        deps.push({
          name: match[1]!,
          version: '*',
          type: currentSection === 'dev-packages' ? 'development' : 'production',
          ecosystem: 'pip',
        })
      }
    }
  }
}

function extractFromSetupCfg(content: string, file: string, deps: Dependency[]): void {
  // Look for install_requires section
  const installReqMatch = content.match(/install_requires\s*=\s*([\s\S]*?)(?=\n\[|\n\S+\s*=|$)/)
  if (!installReqMatch) return

  for (const line of installReqMatch[1]!.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([a-zA-Z0-9_.-]+)/)
    if (match) {
      deps.push({ name: match[1]!, version: '*', type: 'production', ecosystem: 'pip' })
    }
  }
}
