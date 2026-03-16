import { create } from 'zustand';
import { useDialogStore } from './dialogStore';
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
import { demoServices, demoDependencies, demoFlowNodes, demoFlowEdges } from '../demoData';

type ActivePanel = 'services' | 'dependencies' | 'flow' | 'costs' | 'settings';

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
  analysisPhase: string | null;
  hasSeenTutorial: boolean;
  showTutorial: boolean;

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
  importStandalone: () => Promise<void>;
  loadDemo: () => void;
  dismissTutorial: () => void;
}

export function mergeServices(
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

export function ensureFlowNodes(
  services: Service[],
  existingNodes: FlowNode[],
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const existingServiceIds = new Set(
    existingNodes.map((n) => n.serviceId).filter(Boolean)
  );
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  for (const svc of services) {
    if (!existingServiceIds.has(svc.id)) {
      nodes.push({
        id: `svc-${svc.id}`,
        label: svc.name,
        type: svc.category === 'cdn' ? 'cdn' : svc.category === 'database' ? 'database' : 'external',
        serviceId: svc.id,
      });
      edges.push({
        source: 'user',
        target: `svc-${svc.id}`,
        flowType: svc.category === 'payments' ? 'payment' : svc.category === 'auth' ? 'auth' : 'data',
      });
    }
  }
  return { nodes, edges };
}

export function ensureConfig(config: UserConfig | null): UserConfig {
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
  analysisPhase: null,
  hasSeenTutorial: localStorage.getItem('stackwatch-tutorial-seen') === 'true',
  showTutorial: false,

  analyzeLocal: async (path: string) => {
    if (!window.stackwatch) {
      set({ error: 'StackWatch must run inside Electron. Launch with: npm run dev' });
      return;
    }
    set({ isAnalyzing: true, error: null, repoPath: path, deepAnalysis: null, analysisPhase: 'Scanning repository...' });
    try {
      const result = await window.stackwatch.analyzeLocal(path);
      set({ analysisPhase: 'Loading configuration...' });
      // Always reload config from disk to pick up imports and manual edits
      let config: UserConfig | null = null;
      try {
        config = await window.stackwatch.loadConfig(path);
        if (config) set({ config });
      } catch {
        // Config may not exist yet
      }
      const manualServices = config?.services ?? [];
      const allServices = mergeServices(result.services, manualServices, config?.confidenceOverrides);

      // Ensure every service has a flow node (manual services aren't in pipeline output)
      const { nodes: extraNodes, edges: extraEdges } = ensureFlowNodes(allServices, result.flowNodes);

      set({
        services: allServices,
        dependencies: result.dependencies,
        flowNodes: [...result.flowNodes, ...extraNodes],
        flowEdges: [...result.flowEdges, ...extraEdges],
        deepAnalysis: result.deepAnalysis ?? null,
        isAnalyzing: false,
        analysisPhase: null,
        activePanel: 'flow',
        error: result.aiError ? `AI analysis failed: ${result.aiError}. Showing heuristic results.` : null,
      });

      localStorage.setItem('stackwatch-last-repo', path);

      // Show onboarding tutorial on first scan
      if (!get().hasSeenTutorial) {
        set({ showTutorial: true });
      }

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
        analysisPhase: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  analyzeGitHub: async (repo: string, token: string) => {
    if (!window.stackwatch) {
      set({ error: 'StackWatch must run inside Electron. Launch with: npm run dev' });
      return;
    }
    set({ isAnalyzing: true, error: null, repoPath: `github:${repo}`, deepAnalysis: null, analysisPhase: 'Scanning repository...' });
    try {
      const result = await window.stackwatch.analyzeGitHub(repo, token);
      set({ analysisPhase: 'Loading configuration...' });
      const config = get().config;
      const manualServices = config?.services ?? [];
      const allGhServices = mergeServices(result.services, manualServices, config?.confidenceOverrides);

      const { nodes: ghExtraNodes, edges: ghExtraEdges } = ensureFlowNodes(allGhServices, result.flowNodes);

      set({
        services: allGhServices,
        dependencies: result.dependencies,
        flowNodes: [...result.flowNodes, ...ghExtraNodes],
        flowEdges: [...result.flowEdges, ...ghExtraEdges],
        deepAnalysis: result.deepAnalysis ?? null,
        isAnalyzing: false,
        analysisPhase: null,
        activePanel: 'flow',
        linkStatus: 'linked',
      });

      // Show onboarding tutorial on first scan
      if (!get().hasSeenTutorial) {
        set({ showTutorial: true });
      }

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
        analysisPhase: null,
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
      const count = manualServices.length;
      const decision = await useDialogStore.getState().confirm({
        title: 'Re-analyze project',
        message: `You have ${count} manually added service${count > 1 ? 's' : ''}.`,
        detail: 'Do you want to keep your manual services after re-analysis?',
        buttons: [
          { label: 'Keep', value: 'keep', primary: true },
          { label: 'Overwrite all', value: 'overwrite', danger: true },
          { label: 'Cancel', value: 'cancel' },
        ],
      });
      if (decision === 'cancel') return;

      if (decision === 'overwrite') {
        const updatedConfig = ensureConfig(config);
        updatedConfig.services = [];
        await get().saveConfig(updatedConfig);
      }
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

  importStandalone: async () => {
    if (!window.stackwatch) return;
    try {
      const config = await window.stackwatch.importConfig();
      if (!config) return;
      const services = config.services ?? [];

      // Build flow nodes from graph config (with serviceId linkage)
      const flowNodes: FlowNode[] = (config.graph?.nodes ?? []).map((n) => {
        // Match graph node to a service by ID pattern (svc-{serviceId})
        const svcId = n.id.startsWith('svc-') ? n.id.slice(4) : undefined;
        return {
          id: n.id,
          label: n.data.label,
          type: n.data.nodeType ?? 'external',
          serviceId: svcId,
        };
      });
      const flowEdges: FlowEdge[] = (config.graph?.edges ?? []).map((e) => ({
        source: e.source,
        target: e.target,
        flowType: e.type,
      }));

      // Ensure every service has a flow node (config may predate this fix)
      const { nodes: importExtraNodes, edges: importExtraEdges } = ensureFlowNodes(services, flowNodes);
      flowNodes.push(...importExtraNodes);
      flowEdges.push(...importExtraEdges);

      // Ensure 'user' node exists
      if (!flowNodes.find(n => n.id === 'user')) {
        flowNodes.unshift({ id: 'user', label: 'User', type: 'user' });
      }

      set({
        config,
        services,
        flowNodes,
        flowEdges,
        dependencies: [],
        repoPath: null,
        linkStatus: 'unlinked',
        activePanel: 'flow',
        deepAnalysis: null,
        error: null,
      });
    } catch (err) {
      if (err instanceof SyntaxError || (err instanceof Error && err.message)) {
        set({ error: `Import failed: ${err instanceof Error ? err.message : 'Invalid file format'}` });
      }
    }
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

  loadDemo: () => {
    set({
      services: demoServices,
      dependencies: demoDependencies,
      flowNodes: demoFlowNodes,
      flowEdges: demoFlowEdges,
      repoPath: null,
      config: null,
      deepAnalysis: null,
      linkStatus: 'unknown',
      activePanel: 'flow',
      error: null,
    });
  },

  dismissTutorial: () => {
    localStorage.setItem('stackwatch-tutorial-seen', 'true');
    set({ hasSeenTutorial: true, showTutorial: false });
  },
}));
