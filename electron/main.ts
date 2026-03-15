import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import Store from 'electron-store'
import { analyzeLocalRepo, analyzeGitHubRepo } from './analyzers/index'
import { testConnection, PRESET_PROVIDERS } from './ai/provider'
import type { UserConfig, AISettings, AIProvider } from './types'

const store = new (Store as any)()
let mainWindow: BrowserWindow | null = null

function createWindow() {
  Menu.setApplicationMenu(null)

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'StackWatch',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.removeMenu()

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

// --- IPC Handlers ---

ipcMain.handle('analyze-local', async (_event, folderPath: string) => {
  const aiSettings = getAISettings()
  return analyzeLocalRepo(folderPath, aiSettings)
})

ipcMain.handle(
  'analyze-github',
  async (_event, { repo, token }: { repo: string; token: string }) => {
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
    return analyzeGitHubRepo(fetchFile, listDir, aiSettings)
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
    const configPath = path.join(repoPath, 'stackwatch.config.json')
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
    const configPath = path.join(repoPath, 'stackwatch.config.json')
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

ipcMain.handle('import-config', async () => {
  if (!mainWindow) return null
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import StackWatch config',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  })
  if (!filePaths[0]) return null
  const content = await fs.readFile(filePaths[0], 'utf-8')
  return content
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
