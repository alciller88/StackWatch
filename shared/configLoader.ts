import fs from 'fs'
import path from 'path'
import type { UserConfig } from './types'

/**
 * Load stackwatch.config.json from a repo path.
 * Works in both CLI and Electron contexts.
 * Note: does NOT handle encrypted fields — Electron adds that layer on top.
 */
export function loadConfigSync(repoPath: string): UserConfig | null {
  const configPath = path.join(repoPath, 'stackwatch.config.json')
  try {
    const content = fs.readFileSync(configPath, 'utf-8')
    return JSON.parse(content) as UserConfig
  } catch {
    return null
  }
}

/**
 * Save stackwatch.config.json to a repo path.
 */
export function saveConfigSync(repoPath: string, config: UserConfig): void {
  const configPath = path.join(repoPath, 'stackwatch.config.json')
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}
