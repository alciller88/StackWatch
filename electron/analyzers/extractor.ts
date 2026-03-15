import fs from 'fs/promises'
import path from 'path'
import ignore from 'ignore'
import type { Evidence, Dependency } from '../types'

const EXCLUDED_DIRS = new Set([
  'node_modules', 'dist', '.next', 'build', '.git', 'coverage',
  '.nuxt', '.output', '__pycache__', '.venv', 'venv', 'target',
  '.svelte-kit', '.vercel', '.netlify', '.turbo', '.cache',
])

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.rb',
  '.java', '.kt', '.swift', '.dart', '.cs', '.php',
])

const IGNORED_DOMAINS = new Set([
  'localhost', '127.0.0.1', '0.0.0.0',
  'mozilla.org', 'w3.org', 'w3schools.com', 'unpkg.com', 'cdnjs.com',
  'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com',
  'schema.org', 'example.com', 'example.org', 'placeholder.com',
  'wikipedia.org', 'stackoverflow.com', 'github.com', 'gitlab.com',
  'npmjs.com', 'npmjs.org', 'pypi.org', 'crates.io', 'pkg.go.dev',
  'typescriptlang.org', 'reactjs.org', 'vuejs.org', 'nodejs.org',
  'developer.mozilla.org', 'tc39.es', 'json-schema.org',
])

const URL_REGEX = /https?:\/\/[^\s'"`,)}\]>]+/g
const IMPORT_FROM_REGEX = /from\s+['"]([^./][^'"]+)['"]/g
const REQUIRE_REGEX = /require\(\s*['"]([^./][^'"]+)['"]\s*\)/g
const CI_SECRET_REGEX = /\$\{\{\s*secrets\.(\w+)\s*\}\}/g
const CI_ENV_VAR_REGEX = /\$([A-Z][A-Z_]*_[A-Z_]{2,})/g

interface ExtractionResult {
  evidences: Evidence[]
  dependencies: Dependency[]
}

export async function extractEvidences(repoPath: string): Promise<ExtractionResult> {
  const evidences: Evidence[] = []
  const dependencies: Dependency[] = []

  const ig = ignore()
  try {
    const gitignoreContent = await fs.readFile(path.join(repoPath, '.gitignore'), 'utf-8')
    ig.add(gitignoreContent)
  } catch {
    // no .gitignore
  }

  // Walk the repo
  const files = await walkRepo(repoPath, repoPath, ig)

  for (const filePath of files) {
    const relPath = path.relative(repoPath, filePath)
    const basename = path.basename(filePath)
    const ext = path.extname(filePath)

    try {
      // package.json files
      if (basename === 'package.json') {
        const content = await fs.readFile(filePath, 'utf-8')
        extractFromPackageJson(content, relPath, evidences, dependencies)
        continue
      }

      // .env files
      if (basename.startsWith('.env')) {
        const content = await fs.readFile(filePath, 'utf-8')
        extractFromEnvFile(content, relPath, evidences)
        continue
      }

      // Docker compose
      if (basename === 'docker-compose.yml' || basename === 'docker-compose.yaml') {
        const content = await fs.readFile(filePath, 'utf-8')
        extractFromDockerCompose(content, relPath, evidences)
        continue
      }

      // CI/CD workflow files
      if (relPath.includes('.github/workflows/') && (ext === '.yml' || ext === '.yaml')) {
        const content = await fs.readFile(filePath, 'utf-8')
        extractFromCIWorkflow(content, relPath, evidences)
        continue
      }
      if (basename === '.gitlab-ci.yml' || basename === '.circleci') {
        const content = await fs.readFile(filePath, 'utf-8')
        extractFromCIWorkflow(content, relPath, evidences)
        continue
      }

      // Config files at root
      if (isConfigFile(basename)) {
        evidences.push({ type: 'config_file', value: basename, file: relPath })
        continue
      }

      // Python deps
      if (basename === 'requirements.txt') {
        const content = await fs.readFile(filePath, 'utf-8')
        extractFromRequirementsTxt(content, relPath, dependencies)
        continue
      }
      if (basename === 'pyproject.toml') {
        const content = await fs.readFile(filePath, 'utf-8')
        extractFromPyprojectToml(content, relPath, dependencies)
        continue
      }
      if (basename === 'setup.py') {
        const content = await fs.readFile(filePath, 'utf-8')
        extractFromSetupPy(content, relPath, dependencies)
        continue
      }

      // Rust deps
      if (basename === 'Cargo.toml') {
        const content = await fs.readFile(filePath, 'utf-8')
        extractFromCargoToml(content, relPath, dependencies)
        continue
      }

      // Go deps
      if (basename === 'go.mod') {
        const content = await fs.readFile(filePath, 'utf-8')
        extractFromGoMod(content, relPath, dependencies)
        continue
      }

      // Terraform files
      if (ext === '.tf') {
        const content = await fs.readFile(filePath, 'utf-8')
        extractFromTerraform(content, relPath, evidences)
        continue
      }

      // Source code files — extract URLs, imports, domains
      if (CODE_EXTENSIONS.has(ext)) {
        const content = await fs.readFile(filePath, 'utf-8')
        extractFromSourceCode(content, relPath, evidences)
      }
    } catch {
      // skip files that can't be read
    }
  }

  return { evidences, dependencies }
}

async function walkRepo(
  root: string,
  dir: string,
  ig: ReturnType<typeof ignore>,
): Promise<string[]> {
  const results: string[] = []
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
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
      const nested = await walkRepo(root, fullPath, ig)
      results.push(...nested)
    } else if (entry.isFile()) {
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

function extractFromEnvFile(content: string, file: string, evidences: Evidence[]): void {
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
      if (domain && !IGNORED_DOMAINS.has(domain)) {
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

function extractFromSourceCode(content: string, file: string, evidences: Evidence[]): void {
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Extract URLs
    let urlMatch
    const urlRegex = new RegExp(URL_REGEX.source, 'g')
    while ((urlMatch = urlRegex.exec(line)) !== null) {
      const url = urlMatch[0].replace(/[),;'"}\]]+$/, '') // clean trailing chars
      const domain = extractDomainFromUrl(url)
      if (domain && !IGNORED_DOMAINS.has(domain)) {
        evidences.push({ type: 'url', value: url, file, line: i + 1 })
        evidences.push({ type: 'domain', value: domain, file, line: i + 1 })
      }
    }

    // Extract imports (from '...')
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

function extractDomainFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname
    if (!hostname || hostname === 'localhost' || /^[\d.]+$/.test(hostname)) return null
    return hostname
  } catch {
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

  // .env files
  for (const envFile of ['.env', '.env.example', '.env.local']) {
    const content = await fetchFile(envFile)
    if (content) extractFromEnvFile(content, envFile, evidences)
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
        if (content) extractFromSourceCode(content, `${dir}/${f}`, evidences)
      }
    }
  }

  return { evidences, dependencies }
}
