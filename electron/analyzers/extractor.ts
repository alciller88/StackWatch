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
  onProgress?.({ phase: 'Walking file tree...', percent: 7, counts: { evidences: 0, services: 0, vulns: 0 } })
  if (signal?.aborted) throw new DOMException('Scan cancelled', 'AbortError')
  const files = await walkRepo(repoPath, repoPath, ig)

  // Emit progress periodically during file processing
  const progressInterval = Math.max(1, Math.floor(files.length / 5))
  for (let i = 0; i < files.length; i++) {
    const filePath = files[i]
    if (signal?.aborted) throw new DOMException('Scan cancelled', 'AbortError')
    if (i > 0 && i % progressInterval === 0) {
      const filePercent = 8 + Math.round((i / files.length) * 10)
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

  return { evidences, dependencies, projectName }
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
    const line = lines[i].trim()
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
    const image = match[1].split(':')[0] // strip tag
    evidences.push({ type: 'domain', value: image, file })
  }

  // Extract service names
  const servicesBlock = content.match(/^services:\s*\n((?:[ \t].*\n?)*)/m)
  if (servicesBlock) {
    const svcRegex = /^\s{2}(\w[\w-]*):/gm
    while ((match = svcRegex.exec(servicesBlock[1])) !== null) {
      evidences.push({ type: 'config_file', value: `docker-service:${match[1]}`, file })
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
    evidences.push({ type: 'ci_secret', value: match[1], file })
  }

  // Extract environment variable references
  const envRegex = new RegExp(CI_ENV_VAR_REGEX.source, 'g')
  while ((match = envRegex.exec(content)) !== null) {
    evidences.push({ type: 'ci_secret', value: match[1], file })
  }

  // Extract action uses
  const usesRegex = /uses:\s*['"]?([^@\s'"]+)/g
  while ((match = usesRegex.exec(content)) !== null) {
    const action = match[1]
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
    const line = lines[i]

    // Skip content lines (comments, href=, src=, action=)
    if (!isContentLine(line)) {
      // Extract URLs only from real API call patterns (stop at first match to avoid duplicates)
      for (const pattern of API_CALL_PATTERNS) {
        const match = line.match(pattern)
        if (match?.[1]) {
          const url = match[1].replace(/[),;'"}\]]+$/, '')
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
        evidences.push({ type: 'env_var', value: envMatch[0].replace('process.env.', ''), file, line: i + 1 })
      }
    }

    // Extract imports (from '...') — always, regardless of content context
    let importMatch
    const importRegex = new RegExp(IMPORT_FROM_REGEX.source, 'g')
    while ((importMatch = importRegex.exec(line)) !== null) {
      evidences.push({ type: 'import', value: importMatch[1], file, line: i + 1 })
    }

    // Extract requires
    let reqMatch
    const reqRegex = new RegExp(REQUIRE_REGEX.source, 'g')
    while ((reqMatch = reqRegex.exec(line)) !== null) {
      evidences.push({ type: 'import', value: reqMatch[1], file, line: i + 1 })
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
      deps.push({ name: match[1], version: match[2] ?? '*', type: 'production', ecosystem: 'pip' })
    }
  }
}

function extractFromPyprojectToml(content: string, file: string, deps: Dependency[]): void {
  const depsMatch = content.match(/\[project\][\s\S]*?dependencies\s*=\s*\[([\s\S]*?)\]/)
  if (!depsMatch) return
  const entries = depsMatch[1].match(/"([^"]+)"|'([^']+)'/g) ?? []
  for (const entry of entries) {
    const clean = entry.replace(/["']/g, '')
    const match = clean.match(/^([a-zA-Z0-9_.-]+)/)
    if (match) {
      deps.push({ name: match[1], version: '*', type: 'production', ecosystem: 'pip' })
    }
  }
}

function extractFromSetupPy(content: string, file: string, deps: Dependency[]): void {
  const match = content.match(/install_requires\s*=\s*\[([\s\S]*?)\]/)
  if (!match) return
  const entries = match[1].match(/'([^']+)'|"([^"]+)"/g) ?? []
  for (const entry of entries) {
    const clean = entry.replace(/["']/g, '')
    const nameMatch = clean.match(/^([a-zA-Z0-9_.-]+)/)
    if (nameMatch) {
      deps.push({ name: nameMatch[1], version: '*', type: 'production', ecosystem: 'pip' })
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
      const block = sectionMatch[1]
      const lineRegex = /^([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]+)"|\{.*?version\s*=\s*"([^"]+)".*\})/gm
      let lineMatch
      while ((lineMatch = lineRegex.exec(block)) !== null) {
        deps.push({
          name: lineMatch[1],
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
    const lines = blockMatch[1].split('\n')
    for (const line of lines) {
      const match = line.trim().match(/^(\S+)\s+(v[\d.]+\S*)/)
      if (match) {
        deps.push({ name: match[1], version: match[2], type: 'production', ecosystem: 'go' })
      }
    }
  }

  // Single-line require
  const singleRegex = /^require\s+(\S+)\s+(v[\d.]+\S*)/gm
  let singleMatch
  while ((singleMatch = singleRegex.exec(content)) !== null) {
    deps.push({ name: singleMatch[1], version: singleMatch[2], type: 'production', ecosystem: 'go' })
  }
}

// --- Terraform evidence ---

function extractFromTerraform(content: string, file: string, evidences: Evidence[]): void {
  // Provider blocks
  const providerRegex = /provider\s+"([^"]+)"/g
  let match
  while ((match = providerRegex.exec(content)) !== null) {
    const name = match[1]
    if (!['random', 'null', 'local', 'template'].includes(name)) {
      evidences.push({ type: 'config_file', value: `terraform:${name}`, file })
    }
  }

  // Required providers
  const reqRegex = /(\w+)\s*=\s*\{[^}]*source\s*=\s*"([^"]+)"/g
  while ((match = reqRegex.exec(content)) !== null) {
    evidences.push({ type: 'config_file', value: `terraform:${match[1]}`, file })
  }

  // Resource prefixes
  const resourceRegex = /resource\s+"(\w+?)_/g
  while ((match = resourceRegex.exec(content)) !== null) {
    const prefix = match[1]
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

  // Terraform
  const rootFiles = await listDir('.')
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

  return { evidences, dependencies, projectName }
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
        if (vars[v]) {
          const apex = extractApexDomain(vars[v])
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
    return hostname.replace(/^www\./, '').split('.')[0].toLowerCase()
  } catch {
    // Expected: invalid URL format
    return null
  }
}

function isOwnDomain(domain: string, projectDomain: string | null): boolean {
  if (!projectDomain) return false
  const apex = domain.replace(/^www\./, '').split('.')[0].toLowerCase()
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
