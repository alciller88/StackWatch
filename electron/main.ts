import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import { analyzeLocalRepo } from './analyzers/index'
import type { UserConfig } from './types'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'StackWatch',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

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

// IPC Handlers

ipcMain.handle('analyze-local', async (_event, folderPath: string) => {
  return analyzeLocalRepo(folderPath)
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

    const { analyzePackageJson } = await import('./analyzers/packageJson')
    const { analyzeEnvFile } = await import('./analyzers/envFile')
    const { analyzeDockerCompose } = await import('./analyzers/dockerCompose')
    const { analyzeGithubWorkflows } = await import('./analyzers/githubWorkflows')
    const { analyzeConfigFile } = await import('./analyzers/configFiles')
    const { inferFlowGraph } = await import('./analyzers/flowInference')

    const allServices: import('./types').Service[] = []
    const allDeps: import('./types').Dependency[] = []

    const pkgContent = await fetchFile('package.json')
    if (pkgContent) {
      const result = analyzePackageJson(pkgContent)
      allServices.push(...result.services)
      allDeps.push(...result.dependencies)
    }

    for (const envFile of ['.env', '.env.example', '.env.local']) {
      const content = await fetchFile(envFile)
      if (content) {
        const result = analyzeEnvFile(content, envFile)
        allServices.push(...result.services)
      }
    }

    for (const dcFile of ['docker-compose.yml', 'docker-compose.yaml']) {
      const content = await fetchFile(dcFile)
      if (content) {
        const result = analyzeDockerCompose(content)
        allServices.push(...result.services)
      }
    }

    const workflowFiles = await listDir('.github/workflows')
    for (const wf of workflowFiles) {
      if (wf.endsWith('.yml') || wf.endsWith('.yaml')) {
        const content = await fetchFile(`.github/workflows/${wf}`)
        if (content) {
          const result = analyzeGithubWorkflows(content, wf)
          allServices.push(...result.services)
        }
      }
    }

    for (const cf of ['vercel.json', 'netlify.toml', 'firebase.json']) {
      const content = await fetchFile(cf)
      if (content) {
        const result = analyzeConfigFile(content, cf)
        allServices.push(...result.services)
      }
    }

    const seenIds = new Set<string>()
    const uniqueServices = allServices.filter((s) => {
      if (seenIds.has(s.id)) return false
      seenIds.add(s.id)
      return true
    })

    const flow = inferFlowGraph(uniqueServices, allDeps)

    return {
      services: uniqueServices,
      dependencies: allDeps,
      flowNodes: flow.nodes,
      flowEdges: flow.edges,
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
