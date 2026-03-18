export const CURRENT_CONFIG_VERSION = '1'

interface Migration {
  fromVersion: string
  toVersion: string
  migrate: (config: Record<string, unknown>) => Record<string, unknown>
}

// Migration chain — add new migrations at the end
const migrations: Migration[] = [
  // Future migrations go here, e.g.:
  // { fromVersion: '1', toVersion: '2', migrate: (config) => { ... } }
]

/**
 * Apply pending migrations to a config object.
 * Returns the config with version set to CURRENT_CONFIG_VERSION.
 */
export function migrateConfig(config: Record<string, unknown>): Record<string, unknown> {
  let current = { ...config }
  let version = (current.version as string) ?? '1'

  for (const migration of migrations) {
    if (migration.fromVersion === version) {
      console.info(`[Config] Migrating from v${migration.fromVersion} to v${migration.toVersion}`)
      current = migration.migrate(current)
      version = migration.toVersion
    }
  }

  current.version = CURRENT_CONFIG_VERSION
  return current
}

/**
 * Check if a config needs migration.
 */
export function needsMigration(config: Record<string, unknown>): boolean {
  return (config.version ?? '1') !== CURRENT_CONFIG_VERSION
}
