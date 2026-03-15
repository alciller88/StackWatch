import { create } from 'zustand';
import type {
  Service,
  Dependency,
  FlowNode,
  FlowEdge,
  UserConfig,
  AISettings,
  AIProvider,
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

  analyzeLocal: (path: string) => Promise<void>;
  analyzeGitHub: (repo: string, token: string) => Promise<void>;
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
}

function mergeServices(
  inferred: Service[],
  manual: Service[]
): Service[] {
  const merged = new Map<string, Service>();
  for (const s of inferred) {
    merged.set(s.id, s);
  }
  for (const s of manual) {
    merged.set(s.id, s);
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

  analyzeLocal: async (path: string) => {
    if (!window.stackwatch) {
      set({ error: 'StackWatch must run inside Electron. Launch with: npm run dev' });
      return;
    }
    set({ isAnalyzing: true, error: null, repoPath: path });
    try {
      const result = await window.stackwatch.analyzeLocal(path);
      // Load config to get manual services (may not exist yet)
      let config = get().config;
      if (!config) {
        try {
          config = await window.stackwatch.loadConfig(path);
          if (config) set({ config });
        } catch {
          // Config may not exist yet
        }
      }
      const manualServices = config?.services ?? [];
      set({
        services: mergeServices(result.services, manualServices),
        dependencies: result.dependencies,
        flowNodes: result.flowNodes,
        flowEdges: result.flowEdges,
        isAnalyzing: false,
      });
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
    set({ isAnalyzing: true, error: null, repoPath: `github:${repo}` });
    try {
      const result = await window.stackwatch.analyzeGitHub(repo, token);
      const config = get().config;
      const manualServices = config?.services ?? [];
      set({
        services: mergeServices(result.services, manualServices),
        dependencies: result.dependencies,
        flowNodes: result.flowNodes,
        flowEdges: result.flowEdges,
        isAnalyzing: false,
      });
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
}));
