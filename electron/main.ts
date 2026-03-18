import { app, BrowserWindow, dialog, ipcMain, Menu, Notification, safeStorage, shell, session } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import Store from 'electron-store'
import { analyzeLocalRepo, analyzeGitHubRepo } from './analyzers/index'
import { scanVulnerabilities } from './analyzers/vulnScanner'
import { generateCycloneDX, generateSPDX } from './analyzers/sbom'
import { saveScanSnapshot, loadPreviousScan, computeStackDiff } from './analyzers/stackDiff'
import { appendScoreEntry, loadScoreHistory } from './analyzers/scoreHistory'
import { calculateHealthScore } from '../src/utils/healthScore'
import { testConnection, PRESET_PROVIDERS } from './ai/provider'
import { SENSITIVE_FIELDS } from '../shared/types'
import { schemas, validate } from './validation'
import type { UserConfig, AISettings, AIProvider, LinkStatus, Service } from './types'

// --- Global error handlers (stability) ---

process.on('unhandledRejection', (reason, _promise) => {
  console.error('[Main] Unhandled rejection:', reason)
})

process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught exception:', error)
  if (mainWindow && !mainWindow.isDestroyed()) {
    dialog.showErrorBox(
      'Unexpected error',
      `StackWatch encountered an error: ${error.message}\n\nThe app will continue running.`,
    )
  }
})

// electron-store with encryption — Conf's type declarations require moduleResolution: node16+
// which is incompatible with our tsconfig. We type with the methods we actually use.
interface TypedStore {
  store: Record<string, any>
  get(key: string): any
  set(key: string, value: any): void
  set(object: Record<string, any>): void
  delete(key: string): void
}

let store: TypedStore
let mainWindow: BrowserWindow | null = null
let scanAbortController: AbortController | null = null

// --- safeStorage encryption helpers ---

function encryptValue(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) return value
  return safeStorage.encryptString(value).toString('base64')
}

function decryptValue(encrypted: string): string {
  if (!safeStorage.isEncryptionAvailable()) return encrypted
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
  } catch {
    return encrypted
  }
}

function getIconPath(): string {
  // In dev: __dirname = dist-electron/electron/ → ../../build/icon.png
  // In packaged: buildResources contents are at process.resourcesPath
  const devPath = path.join(__dirname, '..', '..', 'build', 'icon.png')
  if (!app.isPackaged) return devPath
  // electron-builder copies buildResources to resources/
  const prodPath = path.join(process.resourcesPath, 'icon.png')
  try { require('fs').accessSync(prodPath); return prodPath } catch { return devPath }
}

function createWindow() {
  Menu.setApplicationMenu(null)

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'StackWatch',
    icon: getIconPath(),
    frame: false,
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // CSP headers — relaxed in dev for Vite HMR, strict in production
  if (app.isPackaged) {
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self' https://api.github.com https://*.openai.com https://*.groq.com https://api.mistral.ai https://api.anthropic.com http://localhost:11434 http://localhost:1234; img-src 'self' data: https://img.shields.io",
          ],
        },
      })
    })
  }

  mainWindow.removeMenu()
  mainWindow.maximize()

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  // Initialize store without custom encryption key — safeStorage handles sensitive values directly
  try {
    store = new (Store as any)()
    // Force a read to detect corrupted data early
    store.store
  } catch {
    // Store corrupted — delete and recreate
    try {
      const storePath = path.join(app.getPath('userData'), 'config.json')
      require('fs').unlinkSync(storePath)
    } catch { /* ignore if file doesn't exist */ }
    store = new (Store as any)()
  }

  // Migrate from legacy deterministic encryption to safeStorage
  migrateLegacyEncryption()

  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('[Main] safeStorage is not available — sensitive values will be stored without encryption. Install a keychain (libsecret/kwallet) on Linux.')
  }

  createWindow()
})

function migrateLegacyEncryption(): void {
  // Re-encrypt all stored encrypted.* values with safeStorage
  // Old format: plaintext values stored under deterministic encryption key
  // New format: safeStorage.encryptString() base64 values
  if (!safeStorage.isEncryptionAvailable()) return

  try {
    const allData = store.store
    let migrated = false
    for (const [key, value] of Object.entries(allData)) {
      if (key.startsWith('encrypted.') && typeof value === 'string') {
        // Check if already migrated (safeStorage produces base64 that's typically longer)
        // Try to decrypt with safeStorage — if it fails, it's still in legacy format
        try {
          safeStorage.decryptString(Buffer.from(value, 'base64'))
          // Already migrated — skip
        } catch {
          // Legacy plaintext value — re-encrypt with safeStorage
          const encrypted = encryptValue(value)
          store.set(key, encrypted)
          migrated = true
        }
      }
    }
    // Also migrate aiSettings apiKey if present
    const aiSettings = store.get('aiSettings') as any
    if (aiSettings?.provider?.apiKey && typeof aiSettings.provider.apiKey === 'string') {
      try {
        safeStorage.decryptString(Buffer.from(aiSettings.provider.apiKey, 'base64'))
      } catch {
        aiSettings.provider.apiKey = encryptValue(aiSettings.provider.apiKey)
        store.set('aiSettings', aiSettings)
        migrated = true
      }
    }
    if (migrated) {
      console.log('[Main] Migrated legacy encrypted values to safeStorage')
    }
  } catch (err) {
    console.error('[Main] Migration failed (non-fatal):', err)
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// --- Window Controls ---

ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.on('window-close', () => mainWindow?.close())
ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() ?? false)

// --- Scan Cancellation ---

ipcMain.on('cancel-scan', () => {
  if (scanAbortController) {
    scanAbortController.abort()
    scanAbortController = null
  }
})

// --- Safe External URL ---

ipcMain.handle('open-external-url', async (_event, args) => {
  const { url } = validate(schemas.openExternalUrl, typeof args === 'string' ? { url: args } : args, 'open-external-url')
  try {
    await shell.openExternal(url)
    return true
  } catch {
    return false
  }
})

// --- Token Sanitization ---

function sanitizeToken(message: string, token: string | undefined): string {
  if (!token || token.length < 4) return message
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return message.replace(new RegExp(escaped, 'g'), token.slice(0, 4) + '****')
}

// --- Path Validation ---

function validateRepoPath(repoPath: string): string {
  if (!repoPath) throw new Error('Repository path cannot be empty')
  if (/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(repoPath)) throw new Error('Invalid repository path: must not contain ".."')
  const resolved = path.resolve(repoPath)
  return resolved
}

// --- Sensitive Field Encryption ---

function encryptServiceField(serviceId: string, fieldName: string, value: string): string {
  const ref = `$encrypted:${serviceId}_${fieldName}`
  store.set(`encrypted.${serviceId}_${fieldName}`, encryptValue(value))
  return ref
}

function decryptServiceField(reference: string): string | undefined {
  if (!reference.startsWith('$encrypted:')) return undefined
  const key = reference.slice('$encrypted:'.length)
  const stored = store.get(`encrypted.${key}`) as string | undefined
  if (!stored) return undefined
  return decryptValue(stored)
}

function encryptConfig(config: UserConfig): UserConfig {
  const encrypted = JSON.parse(JSON.stringify(config)) as UserConfig
  for (const svc of encrypted.services) {
    for (const field of SENSITIVE_FIELDS) {
      const value = svc[field as keyof typeof svc]
      if (typeof value === 'string' && value && !value.startsWith('$encrypted:')) {
        (svc as any)[field] = encryptServiceField(svc.id, field, value)
      }
    }
  }
  return encrypted
}

function decryptConfig(config: UserConfig): UserConfig {
  const decrypted = JSON.parse(JSON.stringify(config)) as UserConfig
  for (const svc of decrypted.services) {
    for (const field of SENSITIVE_FIELDS) {
      const value = svc[field as keyof typeof svc]
      if (typeof value === 'string' && value.startsWith('$encrypted:')) {
        const real = decryptServiceField(value)
        if (real !== undefined) {
          (svc as any)[field] = real
        }
      }
    }
  }
  return decrypted
}

// --- IPC Handlers ---

ipcMain.handle('analyze-local', async (_event, args) => {
  const { folderPath } = validate(schemas.analyzeLocal, typeof args === 'string' ? { folderPath: args } : args, 'analyze-local')
  const safePath = validateRepoPath(folderPath)
  const aiSettings = getAISettings()

  // Load existing config to get excludedServices
  let excludedServices: string[] = []
  try {
    const configPath = path.join(safePath, 'stackwatch.config.json')
    const content = await fs.readFile(configPath, 'utf-8')
    const config = JSON.parse(content) as UserConfig
    excludedServices = config.graph?.excludedServices ?? []
  } catch {
    // No config yet
  }

  // Set up abort controller for cancellation
  scanAbortController = new AbortController()
  const { signal } = scanAbortController

  const onProgress = (data: import('../shared/types').ScanProgressData) => {
    mainWindow?.webContents.send('scan-progress', data)
  }

  let result
  try {
    result = await analyzeLocalRepo(safePath, aiSettings, excludedServices, onProgress, signal)
  } catch (err: any) {
    scanAbortController = null
    if (err?.name === 'AbortError') {
      // Return partial results on cancellation
      return {
        services: [],
        dependencies: [],
        flowNodes: [],
        flowEdges: [],
        discardedItems: [],
        cancelled: true,
      }
    }
    throw err
  }
  scanAbortController = null

  // Save snapshot for future diff comparisons
  try {
    await saveScanSnapshot(safePath, result)
  } catch {
    // Non-critical: don't fail the scan if snapshot save fails
  }

  // Append score history entry
  try {
    const healthResult = calculateHealthScore(result.services, result.flowNodes, result.flowEdges)
    await appendScoreEntry(safePath, {
      timestamp: new Date().toISOString(),
      score: healthResult.score,
      passingChecks: healthResult.passingChecks,
      totalChecks: healthResult.totalChecks,
      serviceCount: result.services.length,
      depCount: result.dependencies.length,
      source: 'scan',
    })
  } catch {
    // Non-critical: don't fail the scan if score history save fails
  }

  return result
})

ipcMain.handle('get-stack-diff', async (_event, args) => {
  const { folderPath } = validate(schemas.getStackDiff, typeof args === 'string' ? { folderPath: args } : args, 'get-stack-diff')
  const safePath = validateRepoPath(folderPath)
  const previousScan = await loadPreviousScan(safePath)
  if (!previousScan) return null

  const aiSettings = getAISettings()

  let excludedServices: string[] = []
  try {
    const configPath = path.join(safePath, 'stackwatch.config.json')
    const content = await fs.readFile(configPath, 'utf-8')
    const config = JSON.parse(content) as UserConfig
    excludedServices = config.graph?.excludedServices ?? []
  } catch {
    // No config yet
  }

  const currentResult = await analyzeLocalRepo(safePath, aiSettings, excludedServices)
  return computeStackDiff(previousScan, {
    timestamp: new Date().toISOString(),
    services: currentResult.services,
    dependencies: currentResult.dependencies,
  })
})

ipcMain.handle(
  'analyze-github',
  async (_event, args) => {
    const { repo, token } = validate(schemas.analyzeGitHub, args, 'analyze-github')

    const { Octokit } = await import('@octokit/rest')
    const [owner, repoName] = repo.split('/')

    // Only pass auth if token is non-empty; empty auth header causes 403
    const hasToken = typeof token === 'string' && token.trim().length > 0
    let octokit = hasToken ? new Octokit({ auth: token.trim() }) : new Octokit()

    // Test auth with a lightweight request; if 403/401, retry unauthenticated (public repo fallback)
    try {
      await octokit.repos.get({ owner, repo: repoName })
    } catch (authErr: any) {
      if (authErr?.status === 403 || authErr?.status === 401) {
        octokit = new Octokit()
      }
    }

    // Track rate limiting to stop wasting requests
    let rateLimited = false

    async function fetchFile(filePath: string): Promise<string | null> {
      if (rateLimited) return null
      try {
        const { data } = await octokit.repos.getContent({
          owner,
          repo: repoName,
          path: filePath,
        })
        if ('content' in data && data.content) {
          return Buffer.from(data.content, 'base64').toString('utf-8')
        }
        return null
      } catch (err: any) {
        if (err?.status === 403) rateLimited = true
        return null
      }
    }

    async function listDir(dirPath: string): Promise<string[]> {
      if (rateLimited) return []
      try {
        const { data } = await octokit.repos.getContent({
          owner,
          repo: repoName,
          path: dirPath,
        })
        if (Array.isArray(data)) {
          return data
            .filter((f) => f.type === 'file')
            .map((f) => f.name)
        }
        return []
      } catch (err: any) {
        if (err?.status === 403) rateLimited = true
        return []
      }
    }

    const aiSettings = getAISettings()

    scanAbortController = new AbortController()
    const { signal } = scanAbortController

    const onProgress = (data: import('../shared/types').ScanProgressData) => {
      mainWindow?.webContents.send('scan-progress', data)
    }

    try {
      const result = await analyzeGitHubRepo(fetchFile, listDir, aiSettings, onProgress, signal)
      scanAbortController = null

      // Compute score entry for GitHub scans (same as local scans)
      // Note: snapshot save skipped for GitHub (no local repo to write to)
      let scoreEntry = undefined
      try {
        const healthResult = calculateHealthScore(result.services, result.flowNodes, result.flowEdges)
        scoreEntry = {
          timestamp: new Date().toISOString(),
          score: healthResult.score,
          passingChecks: healthResult.passingChecks,
          totalChecks: healthResult.totalChecks,
          serviceCount: result.services.length,
          depCount: result.dependencies.length,
          source: 'scan' as const,
        }
      } catch {
        // Non-critical
      }

      return { ...result, scoreEntry }
    } catch (err: any) {
      scanAbortController = null
      if (err?.name === 'AbortError') {
        return {
          services: [],
          dependencies: [],
          flowNodes: [],
          flowEdges: [],
          discardedItems: [],
          cancelled: true,
        }
      }
      // Sanitize error message to avoid leaking the full token
      const message = sanitizeToken(err?.message ?? String(err), token)
      throw new Error(message)
    }
  }
)

ipcMain.handle('open-folder', async () => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select repository folder',
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('load-config', async (_event, args) => {
  const { repoPath } = validate(schemas.loadConfig, typeof args === 'string' ? { repoPath: args } : args, 'load-config')
  try {
    const safePath = validateRepoPath(repoPath)
    const configPath = path.join(safePath, 'stackwatch.config.json')
    const content = await fs.readFile(configPath, 'utf-8')
    const config = JSON.parse(content) as UserConfig
    return decryptConfig(config)
  } catch {
    return null
  }
})

ipcMain.handle(
  'save-config',
  async (
    _event,
    args,
  ) => {
    const validated = validate(schemas.saveConfig, args, 'save-config')
    const repoPath = validated.repoPath
    const config = validated.config as unknown as UserConfig
    const safePath = validateRepoPath(repoPath)
    const configPath = path.join(safePath, 'stackwatch.config.json')
    const encrypted = encryptConfig(config)
    await fs.writeFile(configPath, JSON.stringify(encrypted, null, 2), 'utf-8')
  }
)

// --- AI Settings ---

function getAISettings(): AISettings {
  const settings = store.get('aiSettings') as AISettings | undefined
  if (!settings) {
    return {
      enabled: false,
      provider: { name: 'Ollama (local, free)', baseUrl: 'http://localhost:11434/v1', model: 'llama3.2' },
    }
  }
  // Decrypt API key from safeStorage
  if (settings.provider.apiKey) {
    settings.provider = { ...settings.provider, apiKey: decryptValue(settings.provider.apiKey) }
  }
  return settings
}

ipcMain.handle('get-ai-settings', async () => {
  return getAISettings()
})

ipcMain.handle('set-ai-settings', async (_event, args) => {
  const { settings } = validate(schemas.setAISettings, typeof args === 'object' && args !== null && 'settings' in args ? args : { settings: args }, 'set-ai-settings')
  // Encrypt API key with safeStorage before storing
  const toStore = { ...settings }
  if (toStore.provider.apiKey) {
    toStore.provider = { ...toStore.provider, apiKey: encryptValue(toStore.provider.apiKey) }
  }
  store.set('aiSettings', toStore)
})

ipcMain.handle('test-ai-connection', async (_event, args) => {
  const { provider } = validate(schemas.testAIConnection, typeof args === 'object' && args !== null && 'provider' in args ? args : { provider: args }, 'test-ai-connection')
  return testConnection(provider as AIProvider)
})

ipcMain.handle('get-ai-presets', async () => {
  return PRESET_PROVIDERS
})

// --- Import / Export ---

ipcMain.handle('import-config-standalone', async () => {
  if (!mainWindow) return null
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import StackWatch config',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  })
  if (!filePaths[0]) return null
  const content = await fs.readFile(filePaths[0], 'utf-8')
  try {
    return JSON.parse(content)
  } catch (err: any) {
    throw new Error(`Invalid JSON file: ${err?.message ?? 'could not parse JSON'}`)
  }
})

ipcMain.handle('export-config', async (_event, args) => {
  const { content } = validate(schemas.exportConfig, typeof args === 'string' ? { content: args } : args, 'export-config')
  if (!mainWindow) return false
  const date = new Date().toISOString().split('T')[0]
  let projectName = 'stackwatch'
  try {
    const parsed = JSON.parse(content)
    if (parsed?.project?.name) projectName = parsed.project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  } catch { /* use default */ }
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save StackWatch backup',
    defaultPath: `${projectName}-${date}.stackwatch.json`,
    filters: [{ name: 'StackWatch Config', extensions: ['json'] }],
  })
  if (!filePath) return false
  await fs.writeFile(filePath, content, 'utf-8')
  return true
})

ipcMain.handle('export-services-md', async (_event, args) => {
  const { content } = validate(schemas.exportServicesMd, typeof args === 'string' ? { content: args } : args, 'export-services-md')
  if (!mainWindow) return false
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export services as Markdown',
    defaultPath: 'SERVICES.md',
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  })
  if (!filePath) return false
  await fs.writeFile(filePath, content, 'utf-8')
  return true
})

ipcMain.handle('export-html', async (_event, args) => {
  const validated = validate(schemas.exportHtml, typeof args === 'object' && args !== null && 'data' in args ? args : { data: args }, 'export-html')
  const data = validated.data as unknown as import('./types').HtmlExportData
  if (!mainWindow) return false
  const { generateHtmlReport } = await import('./exporters/htmlExporter')
  const html = generateHtmlReport(data)
  const safeName = data.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export HTML report',
    defaultPath: `stackwatch-report-${safeName}.html`,
    filters: [{ name: 'HTML', extensions: ['html'] }],
  })
  if (!filePath) return false
  await fs.writeFile(filePath, html, 'utf-8')
  return true
})

// --- Link Status ---

async function checkLinkStatus(config: UserConfig): Promise<LinkStatus> {
  if (!config.source) return 'unknown'

  if (config.source.type === 'local') {
    const localPath = config.source.lastSeenPath
    if (!localPath) return 'unlinked'
    try {
      await fs.access(localPath)
      return 'linked'
    } catch {
      return 'unlinked'
    }
  }

  if (config.source.type === 'github') {
    if (!config.source.githubRepo) return 'unlinked'
    try {
      const res = await fetch(
        `https://api.github.com/repos/${config.source.githubRepo}`,
        { method: 'HEAD', signal: AbortSignal.timeout(5000) },
      )
      return res.ok ? 'linked' : 'unlinked'
    } catch {
      return 'unlinked'
    }
  }

  return 'unknown'
}

ipcMain.handle('check-link-status', async (_event, config) => {
  return checkLinkStatus(config as UserConfig)
})

ipcMain.handle('relink-local', async () => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Re-link to local repository',
  })
  return result.canceled ? null : result.filePaths[0]
})

// --- Renewal Notifications ---

function daysUntil(dateStr: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function checkRenewalNotifications(services: Service[]): void {
  // Only show notifications when the app window is NOT focused
  if (mainWindow?.isFocused()) return

  const upcoming = services.filter((s) => {
    if (!s.billing?.nextDate) return false
    const days = daysUntil(s.billing.nextDate)
    return days > 0 && days <= 30
  })

  if (upcoming.length === 0) return

  if (upcoming.length <= 3) {
    // Show individual notifications
    for (const s of upcoming) {
      const days = daysUntil(s.billing!.nextDate!)
      new Notification({
        title: 'StackWatch: Renewal Alert',
        body: `${s.name} renews in ${days} days (${s.billing!.nextDate})`,
      }).show()
    }
  } else {
    // Group into a single notification
    const lines = upcoming.map((s) => {
      const days = daysUntil(s.billing!.nextDate!)
      return `${s.name} in ${days}d`
    })
    new Notification({
      title: 'StackWatch: Renewal Alert',
      body: `${upcoming.length} services renewing soon: ${lines.join(', ')}`,
    }).show()
  }
}

ipcMain.handle('check-renewals', async (_event, args) => {
  const { services } = validate(schemas.checkRenewals, typeof Array.isArray(args) ? { services: args } : (args && typeof args === 'object' && 'services' in args ? args : { services: args }), 'check-renewals')
  checkRenewalNotifications(services as Service[])
})

// --- Score History ---

ipcMain.handle('get-score-history', async (_event, args) => {
  const { folderPath } = validate(schemas.getScoreHistory, typeof args === 'string' ? { folderPath: args } : args, 'get-score-history')
  const safePath = validateRepoPath(folderPath)
  return loadScoreHistory(safePath)
})

ipcMain.handle('save-score-entry', async (_event, args) => {
  const { folderPath, entry } = validate(schemas.saveScoreEntry, args, 'save-score-entry')
  const safePath = validateRepoPath(folderPath)
  await appendScoreEntry(safePath, entry)
})

// --- Vulnerability Scanning ---

ipcMain.handle('scan-vulnerabilities', async (_event, args) => {
  const { deps } = validate(schemas.scanVulnerabilities, Array.isArray(args) ? { deps: args } : args, 'scan-vulnerabilities')
  return scanVulnerabilities(deps as import('./types').Dependency[])
})

// --- SBOM Generation ---

ipcMain.handle('generate-sbom', async (_event, args) => {
  const { deps, projectName, format } = validate(schemas.generateSbom, args, 'generate-sbom') as {
    deps: import('./types').Dependency[]
    projectName: string
    format: 'cyclonedx' | 'spdx'
  }
  if (format === 'cyclonedx') {
    return generateCycloneDX(deps, projectName)
  }
  return generateSPDX(deps, projectName)
})

