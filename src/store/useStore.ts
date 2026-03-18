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
  ScoreHistoryEntry,
  DiscardedItem,
  ScanProgressData,
  StackCheck,
  DepVulnResult,
} from '../types';
import { demoServices, demoDependencies, demoFlowNodes, demoFlowEdges } from '../demoData';
import { computeScanDiff } from '../utils/scanDiff';
import { calculateHealthScore } from '../utils/healthScore';
import { useToastStore } from './toastStore';
import { useGraphStore, registerServiceGetter, registerServiceDeleter, registerRepoPathGetter, registerScoreRecalculator } from './graphStore';
import { storeMutex } from './mutex';
import { themes } from '../themes';
import type { ThemeName } from '../themes';

export type ActivePanel = 'services' | 'dependencies' | 'discarded' | 'flow' | 'costs' | 'settings';
export type StoreMode = 'scan' | 'blank';

// Timer for scan diff cleanup (task 1.7)
let diffCleanupTimer: ReturnType<typeof setTimeout> | null = null;

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
  showScoreHistory: boolean;
  showScoreBreakdown: boolean;
  showDoctor: boolean;
  discardedItems: DiscardedItem[];
  /** Service IDs added in last scan (for graph diff highlight). Cleared after 3s. */
  scanDiffAdded: Set<string>;
  /** Service IDs removed in last scan (for graph diff highlight). Cleared after 3s. */
  scanDiffRemoved: Set<string>;
  stackScore: number;
  healthChecks: StackCheck[];
  vulnResults: DepVulnResult[];
  vulnScanned: boolean;
  scoreHistory: ScoreHistoryEntry[];
  theme: ThemeName;
  mode: StoreMode;
  scanProgress: ScanProgressData | null;

  recalculateScore: () => void;
  cancelScan: () => void;
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
  setBudget: (budget: { monthly: number; currency: string; alertThreshold?: number } | null) => Promise<void>;
  importStandalone: () => Promise<void>;
  loadDemo: () => void;
  initBlankStack: () => void;
  dismissTutorial: () => void;
  loadScoreHistory: () => Promise<void>;
  openScoreHistory: () => void;
  closeScoreHistory: () => void;
  openScoreBreakdown: () => void;
  closeScoreBreakdown: () => void;
  openDoctor: () => void;
  closeDoctor: () => void;
  restoreDiscardedItem: (item: DiscardedItem) => Promise<void>;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
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
  showScoreHistory: false,
  showScoreBreakdown: false,
  showDoctor: false,
  discardedItems: [],
  scanDiffAdded: new Set<string>(),
  scanDiffRemoved: new Set<string>(),
  stackScore: 0,
  healthChecks: [],
  vulnResults: [],
  vulnScanned: false,
  scoreHistory: [],
  theme: (localStorage.getItem('stackwatch-theme') as ThemeName) || 'dark',
  mode: 'scan' as StoreMode,
  scanProgress: null,

  cancelScan: () => {
    if (window.stackwatch?.cancelScan) {
      window.stackwatch.cancelScan();
    }
    set({ scanProgress: null, isAnalyzing: false, analysisPhase: null });
    useToastStore.getState().addToast('Scan cancelled', 'info');
  },

  recalculateScore: () => {
    const { services, flowNodes, flowEdges, vulnResults, vulnScanned } = get();
    const health = calculateHealthScore(services, flowNodes, flowEdges, vulnScanned ? vulnResults : undefined);
    set({ stackScore: health.score, healthChecks: health.checks });
  },

  analyzeLocal: async (path: string) => {
    if (!window.stackwatch) {
      set({ error: 'StackWatch must run inside Electron. Launch with: npm run dev' });
      return;
    }

    // Load config before scanning to check for saved data
    let existingConfig: UserConfig | null = null;
    try {
      existingConfig = await window.stackwatch.loadConfig(path);
    } catch {
      // Config may not exist yet
    }

    const hasBeenScanned = existingConfig !== null;

    let scanMode: 'merge' | 'fresh' = 'merge';

    if (hasBeenScanned) {
      const repoName = path.split(/[\\/]/).pop() || path;
      const decision = await useDialogStore.getState().confirm({
        title: `Re-scanning ${repoName}`,
        message: 'This project has been scanned before. How do you want to proceed?',
        detail: 'Fresh scan will discard all previous results, manual changes and graph positions.',
        buttons: [
          { label: 'Merge (keep manual changes)', value: 'merge', primary: true },
          { label: '\u26A0\uFE0F Fresh Scan', value: 'fresh', danger: true },
          { label: 'Cancel', value: 'cancel' },
        ],
      });
      if (decision === 'cancel') return;
      scanMode = decision as 'merge' | 'fresh';
    }

    set({ isAnalyzing: true, error: null, repoPath: path, deepAnalysis: null, analysisPhase: 'Scanning repository...', mode: 'scan', scanProgress: { phase: 'Initializing...', percent: 0, counts: { evidences: 0, services: 0, vulns: 0 } }, vulnResults: [], vulnScanned: false });
    try {
      const result = await window.stackwatch.analyzeLocal(path);

      // Handle cancellation
      if (result.cancelled) {
        set({ isAnalyzing: false, analysisPhase: null, scanProgress: null });
        if (result.services.length > 0) {
          useToastStore.getState().addToast('Scan cancelled — showing partial results', 'info');
        }
        return;
      }

      set({ analysisPhase: 'Loading configuration...', scanProgress: null });

      let config = existingConfig;

      if (scanMode === 'fresh') {
        // Fresh: discard manual services and graph positions
        if (config) {
          const { graph: _discard, ...rest } = config;
          config = { ...rest, services: [] } as UserConfig;
        }
        set({ config: config ?? null });
      } else {
        // Merge: keep manual services and graph positions for existing nodes
        if (config) {
          set({ config });
        }
      }

      const manualServices = scanMode === 'merge' ? (config?.services ?? []) : [];
      const confidenceOverrides = scanMode === 'merge' ? config?.confidenceOverrides : undefined;
      const allServices = mergeServices(result.services, manualServices, confidenceOverrides);

      // Ensure every service has a flow node (manual services aren't in pipeline output)
      const { nodes: extraNodes, edges: extraEdges } = ensureFlowNodes(allServices, result.flowNodes);

      // Compute scan diff for graph highlighting (compare previous vs new service IDs)
      const previousIds = get().services.map(s => s.id);
      const currentIds = allServices.map(s => s.id);
      const diff = computeScanDiff(previousIds, currentIds);

      set({
        services: allServices,
        dependencies: result.dependencies,
        flowNodes: [...result.flowNodes, ...extraNodes],
        flowEdges: [...result.flowEdges, ...extraEdges],
        deepAnalysis: result.deepAnalysis ?? null,
        discardedItems: result.discardedItems ?? [],
        scanDiffAdded: diff.added,
        scanDiffRemoved: diff.removed,
        isAnalyzing: false,
        analysisPhase: null,
        activePanel: 'flow',
        error: result.aiError ? `AI analysis failed: ${result.aiError}. Showing heuristic results.` : null,
      });

      get().recalculateScore();

      // Toast for AI fallback
      if (result.aiError) {
        const msg = result.aiError.includes('timed out') || result.aiError.includes('429')
          ? 'AI analysis unavailable, using heuristic results'
          : `AI analysis failed: ${result.aiError}`;
        useToastStore.getState().addToast(msg, 'error');
      }

      // Toast for no services
      if (allServices.length === 0) {
        useToastStore.getState().addToast('No services detected. Try adding services manually.', 'info', 8000);
      }

      // Clear diff highlight after 3 seconds (cancel previous timer if re-scanning)
      if (diff.added.size > 0 || diff.removed.size > 0) {
        if (diffCleanupTimer) clearTimeout(diffCleanupTimer);
        diffCleanupTimer = setTimeout(() => {
          diffCleanupTimer = null;
          set({ scanDiffAdded: new Set(), scanDiffRemoved: new Set() });
        }, 3000);
      }

      localStorage.setItem('stackwatch-last-repo', path);

      // Show onboarding tutorial on first scan
      if (!get().hasSeenTutorial) {
        set({ showTutorial: true });
      }

      // Write source reference to config (use the resolved config, not existingConfig)
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

      // Load score history after analysis completes
      get().loadScoreHistory();
    } catch (err) {
      set({
        isAnalyzing: false,
        analysisPhase: null,
        scanProgress: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  analyzeGitHub: async (repo: string, token: string) => {
    if (!window.stackwatch) {
      set({ error: 'StackWatch must run inside Electron. Launch with: npm run dev' });
      return;
    }

    // Check if this repo has been scanned before
    const existingConfig = get().config;
    const hasBeenScanned = existingConfig !== null;

    let scanMode: 'merge' | 'fresh' = 'merge';

    if (hasBeenScanned) {
      const decision = await useDialogStore.getState().confirm({
        title: `Re-scanning ${repo}`,
        message: 'This project has been scanned before. How do you want to proceed?',
        detail: 'Fresh scan will discard all previous results, manual changes and graph positions.',
        buttons: [
          { label: 'Merge (keep manual changes)', value: 'merge', primary: true },
          { label: '\u26A0\uFE0F Fresh Scan', value: 'fresh', danger: true },
          { label: 'Cancel', value: 'cancel' },
        ],
      });
      if (decision === 'cancel') return;
      scanMode = decision as 'merge' | 'fresh';
    }

    set({ isAnalyzing: true, error: null, repoPath: `github:${repo}`, deepAnalysis: null, analysisPhase: 'Scanning repository...', mode: 'scan', scanProgress: { phase: 'Initializing...', percent: 0, counts: { evidences: 0, services: 0, vulns: 0 } }, vulnResults: [], vulnScanned: false });
    try {
      const result = await window.stackwatch.analyzeGitHub(repo, token);

      // Handle cancellation
      if (result.cancelled) {
        set({ isAnalyzing: false, analysisPhase: null, scanProgress: null });
        return;
      }

      set({ analysisPhase: 'Loading configuration...', scanProgress: null });

      let config = existingConfig;

      if (scanMode === 'fresh') {
        // Fresh: discard manual services and graph positions
        if (config) {
          const { graph: _discard, ...rest } = config;
          config = { ...rest, services: [] } as UserConfig;
        }
        set({ config: config ?? null });
      }
      // Merge: keep config as-is (with graph and manual services)

      const manualServices = scanMode === 'merge' ? (config?.services ?? []) : [];
      const confidenceOverrides = scanMode === 'merge' ? config?.confidenceOverrides : undefined;
      const allGhServices = mergeServices(result.services, manualServices, confidenceOverrides);

      const { nodes: ghExtraNodes, edges: ghExtraEdges } = ensureFlowNodes(allGhServices, result.flowNodes);

      // Compute scan diff for graph highlighting
      const previousIds = get().services.map(s => s.id);
      const currentIds = allGhServices.map(s => s.id);
      const diff = computeScanDiff(previousIds, currentIds);

      set({
        services: allGhServices,
        dependencies: result.dependencies,
        flowNodes: [...result.flowNodes, ...ghExtraNodes],
        flowEdges: [...result.flowEdges, ...ghExtraEdges],
        deepAnalysis: result.deepAnalysis ?? null,
        discardedItems: result.discardedItems ?? [],
        scanDiffAdded: diff.added,
        scanDiffRemoved: diff.removed,
        isAnalyzing: false,
        analysisPhase: null,
        activePanel: 'flow',
        linkStatus: 'linked',
      });

      get().recalculateScore();

      // Clear diff highlight after 3 seconds (cancel previous timer if re-scanning)
      if (diff.added.size > 0 || diff.removed.size > 0) {
        if (diffCleanupTimer) clearTimeout(diffCleanupTimer);
        diffCleanupTimer = setTimeout(() => {
          diffCleanupTimer = null;
          set({ scanDiffAdded: new Set(), scanDiffRemoved: new Set() });
        }, 3000);
      }

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
        scanProgress: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  setActivePanel: (panel: ActivePanel) => {
    set({ activePanel: panel });
  },

  loadConfig: async () => {
    const repoPath = get().repoPath;
    if (!repoPath || repoPath.startsWith('github:')) return;
    try {
      const config = await window.stackwatch.loadConfig(repoPath);
      set({ config });
    } catch {
      // Config may not exist yet
    }
  },

  saveConfig: async (config: UserConfig) => {
    const repoPath = get().repoPath;
    if (!repoPath || repoPath.startsWith('github:')) {
      // GitHub repos: keep config in memory only, don't write to disk
      if (config) set({ config });
      return;
    }
    try {
      await window.stackwatch.saveConfig(repoPath, config);
      set({ config });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const toast = msg.includes('ENOENT') ? 'Could not save config: path not found' : `Save failed: ${msg}`;
      useToastStore.getState().addToast(toast, 'error');
      set({ error: msg });
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
    const { repoPath } = get();
    if (!repoPath || !window.stackwatch) return;

    if (repoPath.startsWith('github:')) {
      // GitHub re-analyze needs repo/token — handled by TopBar opening the GitHub dialog
      return;
    }

    // Dialog is now handled inside analyzeLocal (ScanModeDialog)
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
    const release = await storeMutex.acquire();
    try {
      const currentConfig = ensureConfig(get().config);
      const updatedConfig = {
        ...currentConfig,
        services: [...currentConfig.services, service],
      };
      await get().saveConfig(updatedConfig);
      set((state) => ({
        services: [...state.services, service],
      }));
      get().recalculateScore();
    } finally {
      release();
    }
  },

  updateManualService: async (service: Service) => {
    const release = await storeMutex.acquire();
    try {
      const currentConfig = ensureConfig(get().config);
      const updatedConfig = {
        ...currentConfig,
        services: currentConfig.services.map(s => s.id === service.id ? service : s),
      };
      await get().saveConfig(updatedConfig);
      set((state) => ({
        services: state.services.map(s => s.id === service.id ? service : s),
      }));
      // Sync graph node with updated service data
      const graphNode = useGraphStore.getState().nodes.find(
        n => n.data?.serviceId === service.id
      );
      if (graphNode) {
        useGraphStore.getState().updateNode(graphNode.id, {
          label: service.name,
          category: service.category,
          plan: service.plan,
          confidence: service.confidence,
          url: service.url,
          note: service.notes,
        });
      }
      get().recalculateScore();
    } finally {
      release();
    }
  },

  deleteManualService: async (serviceId: string) => {
    const release = await storeMutex.acquire();
    try {
      const currentConfig = ensureConfig(get().config);
      const updatedConfig = {
        ...currentConfig,
        services: currentConfig.services.filter(s => s.id !== serviceId),
      };
      await get().saveConfig(updatedConfig);
      set((state) => ({
        services: state.services.filter(s => s.id !== serviceId),
      }));
      get().recalculateScore();
    } finally {
      release();
    }
  },

  setBudget: async (budget) => {
    const currentConfig = ensureConfig(get().config);
    const updatedConfig = {
      ...currentConfig,
      budget: budget ?? undefined,
    };
    await get().saveConfig(updatedConfig);
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
          layerColor: n.data.layerColor,
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
        flowNodes.unshift({ id: 'user', label: 'User', type: 'layer', layerColor: '#e2b04a' });
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
        vulnResults: [],
        vulnScanned: false,
      });
      get().recalculateScore();
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
    get().recalculateScore();
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
      discardedItems: [],
      linkStatus: 'unknown',
      activePanel: 'flow',
      error: null,
      mode: 'scan',
    });
    get().recalculateScore();
  },

  initBlankStack: () => {
    const blankConfig: UserConfig = {
      version: '1',
      project: { name: 'Untitled Stack', description: '' },
      services: [],
      accounts: [],
    };
    set({
      services: [],
      dependencies: [],
      flowNodes: [{ id: 'user', label: 'User', type: 'layer', layerColor: '#e2b04a' }],
      flowEdges: [],
      repoPath: null,
      config: blankConfig,
      deepAnalysis: null,
      discardedItems: [],
      linkStatus: 'unknown',
      activePanel: 'flow',
      error: null,
      mode: 'blank',
    });
    get().recalculateScore();
  },

  dismissTutorial: () => {
    localStorage.setItem('stackwatch-tutorial-seen', 'true');
    set({ hasSeenTutorial: true, showTutorial: false });
  },

  loadScoreHistory: async () => {
    const repoPath = get().repoPath;
    if (!repoPath || !window.stackwatch) return;
    try {
      const history = await window.stackwatch.getScoreHistory(repoPath);
      set({ scoreHistory: history });
    } catch {
      // Score history may not exist yet
    }
  },

  openScoreHistory: () => {
    set({ showScoreHistory: true, showScoreBreakdown: false });
    get().loadScoreHistory();
  },

  closeScoreHistory: () => {
    set({ showScoreHistory: false });
  },

  openScoreBreakdown: () => {
    set({ showScoreBreakdown: true, showScoreHistory: false });
  },

  closeScoreBreakdown: () => {
    set({ showScoreBreakdown: false });
  },

  openDoctor: () => {
    set({ showDoctor: true });
  },

  closeDoctor: () => {
    set({ showDoctor: false });
  },

  restoreDiscardedItem: async (item: DiscardedItem) => {
    const id = item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const service: Service = {
      id,
      name: item.name,
      category: item.category ?? 'other',
      plan: 'unknown',
      source: 'manual',
      confidence: 'low',
      needsReview: true,
    };
    await get().addManualService(service);
    set((state) => ({
      discardedItems: state.discardedItems.filter(d => d.name !== item.name),
    }));
  },

  setTheme: (theme: ThemeName) => {
    localStorage.setItem('stackwatch-theme', theme);
    const vars = themes[theme];
    const root = document.documentElement;
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
    set({ theme });
  },

  toggleTheme: () => {
    const current = get().theme;
    get().setTheme(current === 'dark' ? 'light' : 'dark');
  },
}));

// Register callbacks for graphStore (avoids circular dependency)
registerServiceGetter(() => useStore.getState().services);
registerRepoPathGetter(() => useStore.getState().repoPath);
registerScoreRecalculator(() => useStore.getState().recalculateScore());
registerServiceDeleter((serviceId: string) => {
  const store = useStore.getState();
  if (store.services.find((s) => s.id === serviceId)) {
    useStore.setState({
      services: store.services.filter((s) => s.id !== serviceId),
      flowNodes: store.flowNodes.filter((n) => n.serviceId !== serviceId),
      flowEdges: store.flowEdges.filter((e) => {
        const nodeId = `svc-${serviceId}`;
        return e.source !== nodeId && e.target !== nodeId;
      }),
    });
    // Also remove from config if it's a manual service
    const config = store.config;
    if (config && config.services.find((s) => s.id === serviceId)) {
      store.deleteManualService(serviceId);
    }
  }
});

// Debounced score history persistence — saves manual score changes to disk after 2s
let _scoreDebounceTimer: ReturnType<typeof setTimeout> | null = null;

useStore.subscribe(
  (state, prev) => {
    if (state.stackScore !== prev.stackScore && state.stackScore > 0 && !state.isAnalyzing) {
      if (_scoreDebounceTimer) clearTimeout(_scoreDebounceTimer);
      _scoreDebounceTimer = setTimeout(() => {
        const { repoPath, services, dependencies, flowNodes, flowEdges, vulnResults, vulnScanned } = useStore.getState();
        if (!repoPath || !window.stackwatch?.saveScoreEntry) return;
        const health = calculateHealthScore(services, flowNodes, flowEdges, vulnScanned ? vulnResults : undefined);
        const entry: ScoreHistoryEntry = {
          timestamp: new Date().toISOString(),
          score: health.score,
          passingChecks: health.passingChecks,
          totalChecks: health.totalChecks,
          serviceCount: services.length,
          depCount: dependencies.length,
          source: 'manual',
        };
        window.stackwatch.saveScoreEntry(repoPath, entry).then(() => {
          // Reload history so the chart updates
          useStore.getState().loadScoreHistory();
        }).catch(() => {
          // Non-critical
        });
      }, 2000);
    }
  }
);

// Listen for scan-progress IPC events from main process
if (typeof window !== 'undefined' && window.stackwatch?.onScanProgress) {
  window.stackwatch.onScanProgress((data) => {
    useStore.setState({ scanProgress: data });
  });
}
