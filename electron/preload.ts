import { contextBridge, ipcRenderer } from 'electron'
import type { StackWatchAPI } from './types'

const api: StackWatchAPI = {
  analyzeLocal: (folderPath: string) =>
    ipcRenderer.invoke('analyze-local', folderPath),

  analyzeGitHub: (repo: string, token: string) =>
    ipcRenderer.invoke('analyze-github', { repo, token }),

  openFolder: () => ipcRenderer.invoke('open-folder'),

  loadConfig: (repoPath: string) =>
    ipcRenderer.invoke('load-config', repoPath),

  saveConfig: (repoPath: string, config) =>
    ipcRenderer.invoke('save-config', { repoPath, config }),
}

contextBridge.exposeInMainWorld('stackwatch', api)
