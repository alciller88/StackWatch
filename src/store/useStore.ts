import { create } from 'zustand';
import type {
  Service,
  Dependency,
  FlowNode,
  FlowEdge,
  UserConfig,
} from '../types';

type ActivePanel = 'services' | 'dependencies' | 'flow';

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

  analyzeLocal: (path: string) => Promise<void>;
  analyzeGitHub: (repo: string, token: string) => Promise<void>;
  setActivePanel: (panel: ActivePanel) => void;
  loadConfig: () => Promise<void>;
  saveConfig: (config: UserConfig) => Promise<void>;
  openFolder: () => Promise<void>;
  clearError: () => void;
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

  analyzeLocal: async (path: string) => {
    set({ isAnalyzing: true, error: null, repoPath: path });
    try {
      const result = await window.stackwatch.analyzeLocal(path);
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

  analyzeGitHub: async (repo: string, token: string) => {
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
    try {
      const config = await window.stackwatch.loadConfig();
      set({ config });
    } catch {
      // Config may not exist yet — not an error
    }
  },

  saveConfig: async (config: UserConfig) => {
    try {
      await window.stackwatch.saveConfig(config);
      set({ config });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  openFolder: async () => {
    try {
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
}));
