import fs from 'fs/promises'
import path from 'path'
import { load as loadYaml } from 'js-yaml'

const MAX_WORKSPACE_PACKAGES = 500

export interface MonorepoInfo {
  type: 'npm-workspaces' | 'pnpm' | 'lerna' | 'turborepo' | 'nx' | null
  packages: string[]  // resolved absolute paths to each package
  root: string
}

/** Detect monorepo structure and return list of package directories */
export async function detectMonorepo(rootPath: string): Promise<MonorepoInfo> {
  const result: MonorepoInfo = { type: null, packages: [], root: rootPath }

  // 1. Check npm/yarn workspaces in package.json
  try {
    const pkgJson = JSON.parse(await fs.readFile(path.join(rootPath, 'package.json'), 'utf-8'))
    const workspaces = pkgJson.workspaces
    if (workspaces) {
      const patterns = Array.isArray(workspaces) ? workspaces : workspaces.packages ?? []
      result.type = 'npm-workspaces'
      result.packages = await resolveGlobs(rootPath, patterns)
      if (result.packages.length > 0) return result
    }
  } catch { /* no package.json */ }

  // 2. Check pnpm-workspace.yaml
  try {
    const content = await fs.readFile(path.join(rootPath, 'pnpm-workspace.yaml'), 'utf-8')
    const workspace = loadYaml(content) as { packages?: string[] }
    if (workspace?.packages) {
      result.type = 'pnpm'
      result.packages = await resolveGlobs(rootPath, workspace.packages)
      if (result.packages.length > 0) return result
    }
  } catch { /* no pnpm-workspace.yaml */ }

  // 3. Check lerna.json
  try {
    const lerna = JSON.parse(await fs.readFile(path.join(rootPath, 'lerna.json'), 'utf-8'))
    const patterns = lerna.packages ?? ['packages/*']
    result.type = 'lerna'
    result.packages = await resolveGlobs(rootPath, patterns)
    if (result.packages.length > 0) return result
  } catch { /* no lerna.json */ }

  // 4. Check turbo.json (Turborepo)
  try {
    await fs.access(path.join(rootPath, 'turbo.json'))
    // Turbo uses npm/pnpm workspaces — if we got here, workspaces weren't found above
    // Try common patterns
    result.type = 'turborepo'
    result.packages = await resolveGlobs(rootPath, ['packages/*', 'apps/*'])
    if (result.packages.length > 0) return result
  } catch { /* no turbo.json */ }

  // 5. Check nx.json
  try {
    await fs.access(path.join(rootPath, 'nx.json'))
    result.type = 'nx'
    result.packages = await resolveGlobs(rootPath, ['packages/*', 'apps/*', 'libs/*'])
    if (result.packages.length > 0) return result
  } catch { /* no nx.json */ }

  return result
}

/** Resolve workspace glob patterns to actual directories */
async function resolveGlobs(rootPath: string, patterns: string[]): Promise<string[]> {
  const dirs: string[] = []

  for (const pattern of patterns) {
    // Simple glob: "packages/*" or "apps/*" — only support single-level wildcards
    const clean = pattern.replace(/\/\*$/, '').replace(/\*$/, '')

    if (clean.includes('*')) {
      // Complex glob — skip for now
      continue
    }

    const parentDir = path.join(rootPath, clean)
    try {
      const entries = await fs.readdir(parentDir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
        const fullPath = path.join(parentDir, entry.name)
        // Must have at least one manifest file
        if (await hasManifest(fullPath)) {
          dirs.push(fullPath)
          if (dirs.length >= MAX_WORKSPACE_PACKAGES) {
            console.warn(`[Monorepo] Package limit reached (${MAX_WORKSPACE_PACKAGES}). Remaining packages skipped.`)
            return dirs
          }
        }
      }
    } catch {
      // Expected: pattern directory may not exist — try as a direct path
      const directPath = path.join(rootPath, pattern.replace(/\/?\*?$/, ''))
      try {
        const stat = await fs.stat(directPath)
        if (stat.isDirectory() && await hasManifest(directPath)) {
          dirs.push(directPath)
          if (dirs.length >= MAX_WORKSPACE_PACKAGES) {
            console.warn(`[Monorepo] Package limit reached (${MAX_WORKSPACE_PACKAGES}). Remaining packages skipped.`)
            return dirs
          }
        }
      } catch { /* Expected: path may not exist */ }
    }
  }

  return dirs
}

/** Check if a directory has a package manifest */
async function hasManifest(dir: string): Promise<boolean> {
  const manifests = ['package.json', 'Cargo.toml', 'go.mod', 'pyproject.toml', 'requirements.txt', 'setup.py', 'pubspec.yaml', 'Gemfile']
  for (const m of manifests) {
    try {
      await fs.access(path.join(dir, m))
      return true
    } catch { /* next */ }
  }
  return false
}
