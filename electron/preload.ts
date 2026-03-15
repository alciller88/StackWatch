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

  getAISettings: () =>
    ipcRenderer.invoke('get-ai-settings'),

  setAISettings: (settings) =>
    ipcRenderer.invoke('set-ai-settings', settings),

  testAIConnection: (provider) =>
    ipcRenderer.invoke('test-ai-connection', provider),

  getAIPresets: () =>
    ipcRenderer.invoke('get-ai-presets'),

  importConfig: () =>
    ipcRenderer.invoke('import-config'),

  exportConfig: (content: string) =>
    ipcRenderer.invoke('export-config', content),

  exportServicesMd: (content: string) =>
    ipcRenderer.invoke('export-services-md', content),
}

contextBridge.exposeInMainWorld('stackwatch', api)
