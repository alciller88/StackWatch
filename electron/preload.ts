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

  importConfig: (repoPath: string) =>
    ipcRenderer.invoke('import-config', repoPath),

  exportConfig: (content: string) =>
    ipcRenderer.invoke('export-config', content),

  exportServicesMd: (content: string) =>
    ipcRenderer.invoke('export-services-md', content),

  checkLinkStatus: (config) =>
    ipcRenderer.invoke('check-link-status', config),

  relinkLocal: () =>
    ipcRenderer.invoke('relink-local'),

  confirmRescan: (manualCount: number) =>
    ipcRenderer.invoke('confirm-rescan', manualCount),
}

contextBridge.exposeInMainWorld('stackwatch', api)
