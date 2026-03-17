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
import type { UserConfig, AISettings, AIProvider, LinkStatus, Service } from './types'

let store: any
let mainWindow: BrowserWindow | null = null

function getEncryptionKey(): string {
  if (safeStorage.isEncryptionAvailable()) {
    // Derive a machine-unique key using safeStorage
    const encrypted = safeStorage.encryptString('stackwatch-v1')
    return encrypted.toString('base64').slice(0, 32)
  }
  // Fallback: use the userData path as a machine-specific seed
  return `sw-${Buffer.from(app.getPath('userData')).toString('base64').slice(0, 24)}`
}

function createWindow() {
  Menu.setApplicationMenu(null)

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'StackWatch',
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
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  store = new (Store as any)({
    encryptionKey: getEncryptionKey(),
  })
  createWindow()
})

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

// --- Safe External URL ---

ipcMain.handle('open-external-url', async (_event, url: string) => {
  // Only allow http and https protocols
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      await shell.openExternal(url)
      return true
    }
    return false
  } catch {
    return false
  }
})

// --- Path Validation ---

function validateRepoPath(repoPath: string): string {
  if (!repoPath) throw new Error('Repository path cannot be empty')
  if (/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(repoPath)) throw new Error('Invalid repository path: must not contain ".."')
  const resolved = path.resolve(repoPath)
  return resolved
}

// --- IPC Handlers ---

ipcMain.handle('analyze-local', async (_event, folderPath: string) => {
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

  const result = await analyzeLocalRepo(safePath, aiSettings, excludedServices)

  // Save snapshot for future diff comparisons
  try {
    await saveScanSnapshot(safePath, result)
  } catch {
    // Non-critical: don't fail the scan if snapshot save fails
  }

  // Append score history entry
  try {
    const { score, servicesWithCost, servicesWithOwner, servicesReviewed, graphCompleteness } =
      calculateHealthScore(result.services, result.flowNodes, result.flowEdges)
    await appendScoreEntry(safePath, {
      timestamp: new Date().toISOString(),
      score,
      breakdown: { servicesWithCost, servicesWithOwner, servicesReviewed, graphCompleteness },
      serviceCount: result.services.length,
      depCount: result.dependencies.length,
    })
  } catch {
    // Non-critical: don't fail the scan if score history save fails
  }

  return result
})

ipcMain.handle('get-stack-diff', async (_event, folderPath: string) => {
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
  async (_event, { repo, token }: { repo: string; token: string }) => {
    // Validate repo format: owner/repo with safe characters only
    if (!/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(repo)) {
      throw new Error(`Invalid GitHub repo format: expected "owner/repo", got "${repo}"`)
    }

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
    try {
      return await analyzeGitHubRepo(fetchFile, listDir, aiSettings)
    } catch (err: any) {
      // Sanitize error message to avoid leaking the full token
      let message = err?.message ?? String(err)
      if (token && token.length > 4) {
        message = message.replaceAll(token, token.slice(0, 4) + '****')
      }
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

ipcMain.handle('load-config', async (_event, repoPath: string) => {
  try {
    const safePath = validateRepoPath(repoPath)
    const configPath = path.join(safePath, 'stackwatch.config.json')
    const content = await fs.readFile(configPath, 'utf-8')
    return JSON.parse(content) as UserConfig
  } catch {
    return null
  }
})

ipcMain.handle(
  'save-config',
  async (
    _event,
    { repoPath, config }: { repoPath: string; config: UserConfig }
  ) => {
    const safePath = validateRepoPath(repoPath)
    const configPath = path.join(safePath, 'stackwatch.config.json')
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
  }
)

// --- AI Settings ---

function getAISettings(): AISettings {
  const settings = store.get('aiSettings') as AISettings | undefined
  return settings ?? {
    enabled: false,
    provider: { name: 'Ollama (local, free)', baseUrl: 'http://localhost:11434/v1', model: 'llama3.2' },
  }
}

ipcMain.handle('get-ai-settings', async () => {
  return getAISettings()
})

ipcMain.handle('set-ai-settings', async (_event, settings: AISettings) => {
  store.set('aiSettings', settings)
})

ipcMain.handle('test-ai-connection', async (_event, provider: AIProvider) => {
  return testConnection(provider)
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

ipcMain.handle('export-config', async (_event, content: string) => {
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

ipcMain.handle('export-services-md', async (_event, content: string) => {
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

ipcMain.handle('export-html', async (_event, data: import('./types').HtmlExportData) => {
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

ipcMain.handle('check-link-status', async (_event, config: UserConfig) => {
  return checkLinkStatus(config)
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
    if (!s.renewalDate) return false
    const days = daysUntil(s.renewalDate)
    return days > 0 && days <= 30
  })

  if (upcoming.length === 0) return

  if (upcoming.length <= 3) {
    // Show individual notifications
    for (const s of upcoming) {
      const days = daysUntil(s.renewalDate!)
      new Notification({
        title: 'StackWatch: Renewal Alert',
        body: `${s.name} renews in ${days} days (${s.renewalDate})`,
      }).show()
    }
  } else {
    // Group into a single notification
    const lines = upcoming.map((s) => {
      const days = daysUntil(s.renewalDate!)
      return `${s.name} in ${days}d`
    })
    new Notification({
      title: 'StackWatch: Renewal Alert',
      body: `${upcoming.length} services renewing soon: ${lines.join(', ')}`,
    }).show()
  }
}

ipcMain.handle('check-renewals', async (_event, services: Service[]) => {
  checkRenewalNotifications(services)
})

// --- Score History ---

ipcMain.handle('get-score-history', async (_event, folderPath: string) => {
  const safePath = validateRepoPath(folderPath)
  return loadScoreHistory(safePath)
})

// --- Vulnerability Scanning ---

ipcMain.handle('scan-vulnerabilities', async (_event, deps: import('./types').Dependency[]) => {
  return scanVulnerabilities(deps)
})

// --- SBOM Generation ---

ipcMain.handle('generate-sbom', async (_event, { deps, projectName, format }: {
  deps: import('./types').Dependency[]
  projectName: string
  format: 'cyclonedx' | 'spdx'
}) => {
  if (format === 'cyclonedx') {
    return generateCycloneDX(deps, projectName)
  }
  return generateSPDX(deps, projectName)
})

