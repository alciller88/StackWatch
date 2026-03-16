import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import Store from 'electron-store'
import { analyzeLocalRepo, analyzeGitHubRepo } from './analyzers/index'
import { testConnection, PRESET_PROVIDERS } from './ai/provider'
import type { UserConfig, AISettings, AIProvider, LinkStatus } from './types'

const store = new (Store as any)({
  encryptionKey: 'stackwatch-v1-local-encryption',
})
let mainWindow: BrowserWindow | null = null

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

app.whenReady().then(createWindow)

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

// --- Path Validation ---

function validateRepoPath(repoPath: string): string {
  if (!repoPath) throw new Error('Repository path cannot be empty')
  const resolved = path.resolve(repoPath)
  if (resolved.includes('..')) throw new Error('Invalid repository path: must not contain ".."')
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

  return analyzeLocalRepo(safePath, aiSettings, excludedServices)
})

ipcMain.handle(
  'analyze-github',
  async (_event, { repo, token }: { repo: string; token: string }) => {
    // Validate repo format: owner/repo with safe characters only
    if (!/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(repo)) {
      throw new Error(`Invalid GitHub repo format: expected "owner/repo", got "${repo}"`)
    }

    const { Octokit } = await import('@octokit/rest')
    const octokit = new Octokit({ auth: token })
    const [owner, repoName] = repo.split('/')

    async function fetchFile(filePath: string): Promise<string | null> {
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
      } catch {
        return null
      }
    }

    async function listDir(dirPath: string): Promise<string[]> {
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
      } catch {
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

ipcMain.handle('check-config-exists', async (_event, repoPath: string) => {
  const safePath = validateRepoPath(repoPath)
  const configPath = path.join(safePath, 'stackwatch.config.json')
  try {
    await fs.access(configPath)
    return true
  } catch {
    return false
  }
})

ipcMain.handle('import-config', async (_event, repoPath: string) => {
  if (!mainWindow) return null
  const safePath = validateRepoPath(repoPath)

  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import StackWatch config',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  })
  if (!filePaths[0]) return null
  const content = await fs.readFile(filePaths[0], 'utf-8')

  // Validate JSON before returning
  try {
    JSON.parse(content)
  } catch (err: any) {
    throw new Error(`Invalid JSON file: ${err?.message ?? 'could not parse JSON'}`)
  }

  // Write the imported config to the project
  const configPath = path.join(safePath, 'stackwatch.config.json')
  await fs.writeFile(configPath, content, 'utf-8')
  return content
})

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
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export StackWatch config',
    defaultPath: 'stackwatch.config.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
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

