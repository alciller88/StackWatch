import path from 'path'
import crypto from 'crypto'
import { app } from 'electron'
import fs from 'fs/promises'

/**
 * Generates a stable, filesystem-safe hash from a repo path.
 * Used to create per-project data directories in app userData.
 */
function hashPath(repoPath: string): string {
  const normalized = path.resolve(repoPath)
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

/**
 * Returns the app-data directory for a given project.
 * All StackWatch data for a project is stored here — never in the project itself.
 *
 * Path: {userData}/projects/{hash}/
 */
export function getProjectDataDir(repoPath: string): string {
  return path.join(app.getPath('userData'), 'projects', hashPath(repoPath))
}

/**
 * Ensures the project data directory exists and returns its path.
 */
export async function ensureProjectDataDir(repoPath: string): Promise<string> {
  const dir = getProjectDataDir(repoPath)
  await fs.mkdir(dir, { recursive: true })
  return dir
}
