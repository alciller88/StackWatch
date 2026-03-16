import { create } from 'zustand';
import type {
  Service,
  Dependency,
  FlowNode,
  FlowEdge,
  UserConfig,
  AISettings,
  AIProvider,
  DeepAnalysisResult,
  LinkStatus,
} from '../types';

type ActivePanel = 'services' | 'dependencies' | 'flow' | 'settings';

interface StoreState {
  services: Service[];
  dependencies: Dependency[];
  flowNodes: FlowNode[];
  flowEdges: FlowEdge[];
  repoPath: string | null;
  isAnalyzing: boolean;
  activePanel: ActivePanel;
  config: UserConfig | null;
  error: string | null;
  aiSettings: AISettings | null;
  deepAnalysis: DeepAnalysisResult | null;
  linkStatus: LinkStatus;

  analyzeLocal: (path: string) => Promise<void>;
  analyzeGitHub: (repo: string, token: string) => Promise<void>;
  reanalyze: () => Promise<void>;
  checkLinkStatus: () => Promise<void>;
  relinkLocal: () => Promise<void>;
  setActivePanel: (panel: ActivePanel) => void;
  loadConfig: () => Promise<void>;
  saveConfig: (config: UserConfig) => Promise<void>;
  openFolder: () => Promise<void>;
  clearError: () => void;
  loadAISettings: () => Promise<void>;
  saveAISettings: (settings: AISettings) => Promise<void>;
  testAIConnection: (provider: AIProvider) => Promise<{ ok: boolean; error?: string }>;
  addManualService: (service: Service) => Promise<void>;
  updateManualService: (service: Service) => Promise<void>;
  deleteManualService: (serviceId: string) => Promise<void>;
  updateServiceConfidence: (serviceId: string, confidence: 'high' | 'medium' | 'low') => Promise<void>;
}

function mergeServices(
  inferred: Service[],
  manual: Service[],
  confidenceOverrides?: Record<string, 'high' | 'medium' | 'low'>
): Service[] {
  const merged = new Map<string, Service>();
  for (const s of inferred) {
    merged.set(s.id, s);
  }
  for (const s of manual) {
    merged.set(s.id, s);
  }
  if (confidenceOverrides) {
    for (const [id, confidence] of Object.entries(confidenceOverrides)) {
      const s = merged.get(id);
      if (s) merged.set(id, { ...s, confidence });
    }
  }
  return Array.from(merged.values());
}

function ensureConfig(config: UserConfig | null): UserConfig {
  return config ?? {
    version: '1',
    project: { name: '', description: '' },
    services: [],
    accounts: [],
  };
}

export const useStore = create<StoreState>((set, get) => ({
  services: [],
  dependencies: [],
  flowNodes: [],
  flowEdges: [],
  repoPath: null,
  isAnalyzing: false,
  activePanel: 'services',
  config: null,
  error: null,
  aiSettings: null,
  deepAnalysis: null,
  linkStatus: 'unknown',

  analyzeLocal: async (path: string) => {
    if (!window.stackwatch) {
      set({ error: 'StackWatch must run inside Electron. Launch with: npm run dev' });
      return;
    }
    set({ isAnalyzing: true, error: null, repoPath: path, deepAnalysis: null });
    try {
      const result = await window.stackwatch.analyzeLocal(path);
      // Always reload config from disk to pick up imports and manual edits
      let config: UserConfig | null = null;
      try {
        config = await window.stackwatch.loadConfig(path);
        if (config) set({ config });
      } catch {
        // Config may not exist yet
      }
      const manualServices = config?.services ?? [];
      set({
        services: mergeServices(result.services, manualServices, config?.confidenceOverrides),
        dependencies: result.dependencies,
        flowNodes: result.flowNodes,
        flowEdges: result.flowEdges,
        deepAnalysis: result.deepAnalysis ?? null,
        isAnalyzing: false,
      });

      // Write source reference to config
      const currentConfig = ensureConfig(config);
      if (!currentConfig.source || currentConfig.source.type !== 'local' || currentConfig.source.lastSeenPath !== path) {
        const updatedConfig = {
          ...currentConfig,
          source: { type: 'local' as const, lastSeenPath: path },
        };
        await window.stackwatch.saveConfig(path, updatedConfig);
        set({ config: updatedConfig, linkStatus: 'linked' });
      } else {
        set({ linkStatus: 'linked' });
      }
    } catch (err) {
      set({
        isAnalyzing: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  analyzeGitHub: async (repo: string, token: string) => {
    if (!window.stackwatch) {
      set({ error: 'StackWatch must run inside Electron. Launch with: npm run dev' });
      return;
    }
    set({ isAnalyzing: true, error: null, repoPath: `github:${repo}`, deepAnalysis: null });
    try {
      const result = await window.stackwatch.analyzeGitHub(repo, token);
      const config = get().config;
      const manualServices = config?.services ?? [];
      set({
        services: mergeServices(result.services, manualServices, config?.confidenceOverrides),
        dependencies: result.dependencies,
        flowNodes: result.flowNodes,
        flowEdges: result.flowEdges,
        deepAnalysis: result.deepAnalysis ?? null,
        isAnalyzing: false,
        linkStatus: 'linked',
      });

      // Write source reference if repoPath is available for saving
      const repoPath = get().repoPath;
      if (repoPath && !repoPath.startsWith('github:')) {
        const currentConfig = ensureConfig(config);
        const updatedConfig = {
          ...currentConfig,
          source: { type: 'github' as const, githubRepo: repo, githubBranch: 'main' },
        };
        await window.stackwatch.saveConfig(repoPath, updatedConfig);
        set({ config: updatedConfig });
      }
    } catch (err) {
      set({
        isAnalyzing: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  setActivePanel: (panel: ActivePanel) => {
    set({ activePanel: panel });
  },

  loadConfig: async () => {
    const repoPath = get().repoPath;
    if (!repoPath) return;
    try {
      const config = await window.stackwatch.loadConfig(repoPath);
      set({ config });
    } catch {
      // Config may not exist yet
    }
  },

  saveConfig: async (config: UserConfig) => {
    const repoPath = get().repoPath;
    if (!repoPath) return;
    try {
      await window.stackwatch.saveConfig(repoPath, config);
      set({ config });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  openFolder: async () => {
    try {
      if (!window.stackwatch) {
        set({ error: 'StackWatch must run inside Electron. Launch with: npm run dev' });
        return;
      }
      const folderPath = await window.stackwatch.openFolder();
      if (folderPath) {
        await get().analyzeLocal(folderPath);
      }
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  clearError: () => {
    set({ error: null });
  },

  loadAISettings: async () => {
    if (!window.stackwatch) return;
    try {
      const settings = await window.stackwatch.getAISettings();
      set({ aiSettings: settings });
    } catch {
      // Settings may not exist yet
    }
  },

  saveAISettings: async (settings: AISettings) => {
    if (!window.stackwatch) return;
    try {
      await window.stackwatch.setAISettings(settings);
      set({ aiSettings: settings });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  testAIConnection: async (provider: AIProvider) => {
    if (!window.stackwatch) {
      return { ok: false, error: 'Not running in Electron' };
    }
    return window.stackwatch.testAIConnection(provider);
  },

  reanalyze: async () => {
    const { repoPath, config } = get();
    if (!repoPath || !window.stackwatch) return;

    if (repoPath.startsWith('github:')) {
      // GitHub re-analyze needs repo/token — handled by TopBar opening the GitHub dialog
      return;
    }

    // Check for manual services and show confirmation
    const manualServices = (config?.services ?? []).filter(s => s.source === 'manual');
    if (manualServices.length > 0) {
      set({ isAnalyzing: true });
      const decision = await window.stackwatch.confirmRescan(manualServices.length);
      if (decision === 'cancel') {
        set({ isAnalyzing: false });
        return;
      }

      if (decision === 'overwrite') {
        // Clear manual services from config before re-analyzing
        const updatedConfig = ensureConfig(config);
        updatedConfig.services = [];
        await get().saveConfig(updatedConfig);
      }
      // 'keep' — analyzeLocal will merge manual services back automatically
    }

    await get().analyzeLocal(repoPath);
  },

  checkLinkStatus: async () => {
    const { config } = get();
    if (!config || !window.stackwatch) {
      set({ linkStatus: 'unknown' });
      return;
    }
    const status = await window.stackwatch.checkLinkStatus(config);
    set({ linkStatus: status });
  },

  relinkLocal: async () => {
    if (!window.stackwatch) return;
    const newPath = await window.stackwatch.relinkLocal();
    if (!newPath) return;

    const { config, repoPath } = get();
    const currentConfig = ensureConfig(config);
    const updatedConfig = {
      ...currentConfig,
      source: { type: 'local' as const, lastSeenPath: newPath },
    };

    // Save to old repoPath if available, then switch to new path
    if (repoPath && !repoPath.startsWith('github:')) {
      await window.stackwatch.saveConfig(repoPath, updatedConfig);
    }

    set({ config: updatedConfig, repoPath: newPath, linkStatus: 'linked' });
    await get().analyzeLocal(newPath);
  },

  addManualService: async (service: Service) => {
    const currentConfig = ensureConfig(get().config);
    const updatedConfig = {
      ...currentConfig,
      services: [...currentConfig.services, service],
    };
    await get().saveConfig(updatedConfig);
    // Update services list instantly
    set((state) => ({
      services: [...state.services, service],
    }));
  },

  updateManualService: async (service: Service) => {
    const currentConfig = ensureConfig(get().config);
    const updatedConfig = {
      ...currentConfig,
      services: currentConfig.services.map(s => s.id === service.id ? service : s),
    };
    await get().saveConfig(updatedConfig);
    set((state) => ({
      services: state.services.map(s => s.id === service.id ? service : s),
    }));
  },

  deleteManualService: async (serviceId: string) => {
    const currentConfig = ensureConfig(get().config);
    const updatedConfig = {
      ...currentConfig,
      services: currentConfig.services.filter(s => s.id !== serviceId),
    };
    await get().saveConfig(updatedConfig);
    set((state) => ({
      services: state.services.filter(s => s.id !== serviceId),
    }));
  },

  updateServiceConfidence: async (serviceId: string, confidence: 'high' | 'medium' | 'low') => {
    const currentConfig = ensureConfig(get().config);
    const updatedConfig = {
      ...currentConfig,
      confidenceOverrides: {
        ...currentConfig.confidenceOverrides,
        [serviceId]: confidence,
      },
    };
    await get().saveConfig(updatedConfig);
    set((state) => ({
      services: state.services.map(s =>
        s.id === serviceId ? { ...s, confidence } : s
      ),
    }));
  },
}));
