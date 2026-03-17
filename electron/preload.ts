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
    ipcRenderer.invoke('import-config-standalone'),

  exportConfig: (content: string) =>
    ipcRenderer.invoke('export-config', content),

  exportServicesMd: (content: string) =>
    ipcRenderer.invoke('export-services-md', content),

  exportHtml: (data: import('../shared/types').HtmlExportData) =>
    ipcRenderer.invoke('export-html', data),

  checkLinkStatus: (config) =>
    ipcRenderer.invoke('check-link-status', config),

  relinkLocal: () =>
    ipcRenderer.invoke('relink-local'),

  scanVulnerabilities: (deps: import('../shared/types').Dependency[]) =>
    ipcRenderer.invoke('scan-vulnerabilities', deps),

  getStackDiff: (folderPath: string) =>
    ipcRenderer.invoke('get-stack-diff', folderPath),

  getScoreHistory: (folderPath: string) =>
    ipcRenderer.invoke('get-score-history', folderPath),

  saveScoreEntry: (folderPath: string, entry: import('../shared/types').ScoreHistoryEntry) =>
    ipcRenderer.invoke('save-score-entry', { folderPath, entry }),

  checkRenewals: (services: import('../shared/types').Service[]) =>
    ipcRenderer.invoke('check-renewals', services),

  openExternalUrl: (url: string) =>
    ipcRenderer.invoke('open-external-url', url),

  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
}

contextBridge.exposeInMainWorld('stackwatch', api)
