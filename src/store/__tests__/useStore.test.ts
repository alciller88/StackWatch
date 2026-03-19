import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Service, FlowNode, UserConfig } from '../../types';

// vi.hoisted runs BEFORE imports — needed because useStore reads localStorage at module load
const { mockStackwatch, localStorageShim } = vi.hoisted(() => {
  const localStorageMock: Record<string, string> = {};
  const localStorageShim = {
    getItem: (key: string) => localStorageMock[key] ?? null,
    setItem: (key: string, value: string) => { localStorageMock[key] = value; },
    removeItem: (key: string) => { delete localStorageMock[key]; },
    clear: () => { Object.keys(localStorageMock).forEach(k => delete localStorageMock[k]); },
    length: 0,
    key: () => null,
  };
  (globalThis as any).localStorage = localStorageShim;

  const mockStackwatch = {
    analyzeLocal: vi.fn(),
    analyzeGitHub: vi.fn(),
    loadConfig: vi.fn().mockResolvedValue(null),
    saveConfig: vi.fn().mockResolvedValue(undefined),
    openFolder: vi.fn(),
    importConfig: vi.fn(),
    getAISettings: vi.fn(),
    setAISettings: vi.fn(),
    testAIConnection: vi.fn(),
    getAIPresets: vi.fn(),
    exportConfig: vi.fn(),
    exportServicesMd: vi.fn(),
    checkLinkStatus: vi.fn(),
    relinkLocal: vi.fn(),
    windowMinimize: vi.fn(),
    windowMaximize: vi.fn(),
    windowClose: vi.fn(),
    windowIsMaximized: vi.fn(),
  };
  (globalThis as any).window = globalThis;
  (globalThis as any).window.stackwatch = mockStackwatch;

  return { mockStackwatch, localStorageShim };
});

import { useStore, mergeServices, ensureFlowNodes, ensureConfig } from '../useStore';
import { useDialogStore } from '../dialogStore';

// ── Helpers ──

function makeService(id: string, overrides?: Partial<Service>): Service {
  return {
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    category: 'other',
    plan: 'unknown',
    source: 'inferred',
    confidence: 'medium',
    ...overrides,
  };
}

function makeNode(serviceId: string): FlowNode {
  return {
    id: `svc-${serviceId}`,
    label: serviceId,
    type: 'external',
    serviceId,
  };
}

// ── mergeServices ──

describe('mergeServices', () => {
  it('combines without duplicates — manual overrides inferred', () => {
    const inferred = [
      makeService('redis'),
      makeService('stripe', { source: 'inferred', confidence: 'low' }),
    ];
    const manual = [
      makeService('stripe', { source: 'manual', confidence: 'high' }),
      makeService('sentry', { source: 'manual' }),
    ];

    const result = mergeServices(inferred, manual);

    expect(result).toHaveLength(3);
    const ids = result.map((s) => s.id);
    expect(ids).toContain('redis');
    expect(ids).toContain('stripe');
    expect(ids).toContain('sentry');
    // Manual stripe should override inferred stripe
    const stripe = result.find((s) => s.id === 'stripe')!;
    expect(stripe.source).toBe('manual');
    expect(stripe.confidence).toBe('high');
  });

  it('applies confidenceOverrides', () => {
    const inferred = [
      makeService('redis', { confidence: 'low' }),
      makeService('stripe', { confidence: 'medium' }),
    ];
    const overrides: Record<string, 'high' | 'medium' | 'low'> = {
      redis: 'high',
    };

    const result = mergeServices(inferred, [], overrides);

    expect(result).toHaveLength(2);
    expect(result.find((s) => s.id === 'redis')!.confidence).toBe('high');
    // Stripe unchanged
    expect(result.find((s) => s.id === 'stripe')!.confidence).toBe('medium');
  });
});

// ── ensureConfig ──

describe('ensureConfig', () => {
  it('returns default config when null', () => {
    const config = ensureConfig(null);

    expect(config).toBeDefined();
    expect(config.version).toBe('1');
    expect(config.project).toEqual({ name: '', description: '' });
    expect(config.services).toEqual([]);
    expect(config.accounts).toEqual([]);
  });

  it('returns the same config when not null', () => {
    const existing: UserConfig = {
      version: '2',
      project: { name: 'Test', description: 'Desc' },
      services: [makeService('redis')],
      accounts: [],
    };

    const config = ensureConfig(existing);

    expect(config).toBe(existing);
  });
});

// ── ensureFlowNodes ──

describe('ensureFlowNodes', () => {
  it('generates nodes for services without existing nodes', () => {
    const services = [
      makeService('redis', { category: 'database' }),
      makeService('stripe', { category: 'payments' }),
      makeService('cloudflare', { category: 'cdn' }),
    ];
    // Only redis has a node already
    const existingNodes = [makeNode('redis')];

    const { nodes, edges } = ensureFlowNodes(services, existingNodes);

    expect(nodes).toHaveLength(2);
    expect(edges).toHaveLength(2);

    // Stripe should get a node
    const stripeNode = nodes.find((n) => n.serviceId === 'stripe');
    expect(stripeNode).toBeDefined();
    expect(stripeNode!.id).toBe('svc-stripe');
    expect(stripeNode!.type).toBe('external');

    // Cloudflare (cdn) should get type 'cdn'
    const cfNode = nodes.find((n) => n.serviceId === 'cloudflare');
    expect(cfNode).toBeDefined();
    expect(cfNode!.type).toBe('cdn');

    // Edge types: payments -> payment, cdn -> data
    const stripeEdge = edges.find((e) => e.target === 'svc-stripe');
    expect(stripeEdge!.flowType).toBe('payment');
    const cfEdge = edges.find((e) => e.target === 'svc-cloudflare');
    expect(cfEdge!.flowType).toBe('data');
  });

  it('skips services that already have nodes', () => {
    const services = [makeService('redis'), makeService('stripe')];
    const existingNodes = [makeNode('redis'), makeNode('stripe')];

    const { nodes, edges } = ensureFlowNodes(services, existingNodes);

    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });
});

// ── Store actions ──

describe('useStore actions', () => {
  beforeEach(() => {
    // Reset store to initial state
    useStore.setState({
      services: [],
      dependencies: [],
      flowNodes: [],
      flowEdges: [],
      repoPath: '/test/repo',
      isAnalyzing: false,
      activePanel: 'services',
      config: {
        version: '1',
        project: { name: 'Test', description: '' },
        services: [],
        accounts: [],
      },
      error: null,
      aiSettings: null,
      deepAnalysis: null,
      linkStatus: 'unknown',
      analysisPhase: null,
      hasSeenTutorial: true,
      showTutorial: false,
    });
    vi.clearAllMocks();
    mockStackwatch.saveConfig.mockResolvedValue(undefined);
  });

  it('loadDemo — loads demo data correctly', () => {
    useStore.getState().loadDemo();
    const state = useStore.getState();

    expect(state.services.length).toBeGreaterThan(0);
    expect(state.dependencies.length).toBeGreaterThan(0);
    expect(state.flowNodes.length).toBeGreaterThan(0);
    expect(state.flowEdges.length).toBeGreaterThan(0);
    expect(state.activePanel).toBe('flow');
    expect(state.config).toBeNull();
    expect(state.repoPath).toBeNull();
    expect(state.deepAnalysis).toBeNull();
    expect(state.error).toBeNull();
  });

  it('addManualService — adds to state and saves config', async () => {
    const newService = makeService('new-svc', { source: 'manual' });

    await useStore.getState().addManualService(newService);
    const state = useStore.getState();

    expect(state.services).toContainEqual(newService);
    expect(mockStackwatch.saveConfig).toHaveBeenCalledTimes(1);
    // Verify config was updated with the new service
    const savedConfig = mockStackwatch.saveConfig.mock.calls[0][1] as UserConfig;
    expect(savedConfig.services).toContainEqual(newService);
  });

  it('deleteManualService — removes from state and saves config', async () => {
    const svc = makeService('to-delete', { source: 'manual' });
    // Set up initial state with the service
    useStore.setState({
      services: [svc],
      config: {
        version: '1',
        project: { name: 'Test', description: '' },
        services: [svc],
        accounts: [],
      },
    });

    await useStore.getState().deleteManualService('to-delete');
    const state = useStore.getState();

    expect(state.services.find((s) => s.id === 'to-delete')).toBeUndefined();
    expect(mockStackwatch.saveConfig).toHaveBeenCalledTimes(1);
    const savedConfig = mockStackwatch.saveConfig.mock.calls[0][1] as UserConfig;
    expect(savedConfig.services.find((s) => s.id === 'to-delete')).toBeUndefined();
  });

  it('updateServiceConfidence — updates confidence in state and config', async () => {
    const svc = makeService('redis', { confidence: 'low' });
    useStore.setState({
      services: [svc],
      config: {
        version: '1',
        project: { name: 'Test', description: '' },
        services: [],
        accounts: [],
      },
    });

    await useStore.getState().updateServiceConfidence('redis', 'high');
    const state = useStore.getState();

    expect(state.services.find((s) => s.id === 'redis')!.confidence).toBe('high');
    expect(mockStackwatch.saveConfig).toHaveBeenCalledTimes(1);
    const savedConfig = mockStackwatch.saveConfig.mock.calls[0][1] as UserConfig;
    expect(savedConfig.confidenceOverrides!['redis']).toBe('high');
  });
});

// ── ScanModeDialog (analyzeLocal) ──

describe('ScanModeDialog', () => {
  const analysisResult = {
    services: [makeService('redis', { source: 'inferred' })],
    dependencies: [],
    flowNodes: [{ id: 'user', label: 'User', type: 'layer' as const, layerColor: '#e2b04a' }, makeNode('redis')],
    flowEdges: [{ source: 'user', target: 'svc-redis', flowType: 'data' as const }],
  };

  beforeEach(() => {
    useStore.setState({
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
      hasSeenTutorial: true,
      showTutorial: false,
    });
    vi.clearAllMocks();
    mockStackwatch.analyzeLocal.mockResolvedValue(analysisResult);
    mockStackwatch.saveConfig.mockResolvedValue(undefined);
  });

  it('no saved data → no dialog, scans directly', async () => {
    mockStackwatch.loadConfig.mockResolvedValue(null);
    const confirmSpy = vi.spyOn(useDialogStore.getState(), 'confirm');

    await useStore.getState().analyzeLocal('/test/repo');

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(mockStackwatch.analyzeLocal).toHaveBeenCalledWith('/test/repo');
    expect(useStore.getState().services).toHaveLength(1);
    confirmSpy.mockRestore();
  });

  it('saved data → shows dialog', async () => {
    const savedConfig: UserConfig = {
      version: '1',
      project: { name: 'Test', description: '' },
      services: [makeService('sentry', { source: 'manual' })],
      accounts: [],
    };
    mockStackwatch.loadConfig.mockResolvedValue(savedConfig);

    // Auto-resolve dialog with 'merge'
    const confirmSpy = vi.spyOn(useDialogStore.getState(), 'confirm')
      .mockResolvedValue('merge');

    await useStore.getState().analyzeLocal('/test/repo');

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.mock.calls[0][0].title).toContain('Re-scanning');
    expect(mockStackwatch.analyzeLocal).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('cancel → does not scan', async () => {
    const savedConfig: UserConfig = {
      version: '1',
      project: { name: 'Test', description: '' },
      services: [makeService('sentry', { source: 'manual' })],
      accounts: [],
    };
    mockStackwatch.loadConfig.mockResolvedValue(savedConfig);

    const confirmSpy = vi.spyOn(useDialogStore.getState(), 'confirm')
      .mockResolvedValue('cancel');

    await useStore.getState().analyzeLocal('/test/repo');

    expect(mockStackwatch.analyzeLocal).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('merge mode → manual services kept', async () => {
    const manualSvc = makeService('sentry', { source: 'manual' });
    const savedConfig: UserConfig = {
      version: '1',
      project: { name: 'Test', description: '' },
      services: [manualSvc],
      accounts: [],
    };
    mockStackwatch.loadConfig.mockResolvedValue(savedConfig);

    const confirmSpy = vi.spyOn(useDialogStore.getState(), 'confirm')
      .mockResolvedValue('merge');

    await useStore.getState().analyzeLocal('/test/repo');

    const state = useStore.getState();
    // Should have both inferred redis AND manual sentry
    expect(state.services).toHaveLength(2);
    expect(state.services.find(s => s.id === 'sentry')).toBeDefined();
    expect(state.services.find(s => s.id === 'redis')).toBeDefined();
    confirmSpy.mockRestore();
  });

  it('fresh mode → manual services discarded', async () => {
    const manualSvc = makeService('sentry', { source: 'manual' });
    const savedConfig: UserConfig = {
      version: '1',
      project: { name: 'Test', description: '' },
      services: [manualSvc],
      accounts: [],
    };
    mockStackwatch.loadConfig.mockResolvedValue(savedConfig);

    const confirmSpy = vi.spyOn(useDialogStore.getState(), 'confirm')
      .mockResolvedValue('fresh');

    await useStore.getState().analyzeLocal('/test/repo');

    const state = useStore.getState();
    // Should have only inferred redis, no manual sentry
    expect(state.services).toHaveLength(1);
    expect(state.services[0].id).toBe('redis');
    expect(state.services.find(s => s.id === 'sentry')).toBeUndefined();
    confirmSpy.mockRestore();
  });
});

// ── Reactive Stack Score ──

describe('Reactive stackScore', () => {
  beforeEach(() => {
    useStore.setState({
      services: [],
      dependencies: [],
      flowNodes: [],
      flowEdges: [],
      repoPath: '/test/repo',
      isAnalyzing: false,
      stackScore: 0,
      activePanel: 'services',
      config: {
        version: '1',
        project: { name: 'Test', description: '' },
        services: [],
        accounts: [],
      },
      error: null,
    });
    vi.clearAllMocks();
    mockStackwatch.saveConfig.mockResolvedValue(undefined);
  });

  it('recalculates score after addManualService', async () => {
    expect(useStore.getState().stackScore).toBe(0);

    const svc = makeService('stripe', {
      source: 'manual',
      plan: 'paid',
      billing: { type: 'manual', period: 'monthly', amount: 50, lastRenewed: '2026-03-01' },
      owner: 'Alice',
      needsReview: false,
    });

    await useStore.getState().addManualService(svc);

    // Score should be > 0 now (completeness checks pass)
    expect(useStore.getState().stackScore).toBeGreaterThan(0);
  });

  it('recalculates score after updateManualService', async () => {
    const svc = makeService('stripe', { source: 'manual', needsReview: true });
    useStore.setState({
      services: [svc],
      config: {
        version: '1',
        project: { name: 'Test', description: '' },
        services: [svc],
        accounts: [],
      },
    });
    useStore.getState().recalculateScore();
    const scoreBefore = useStore.getState().stackScore;

    // Add owner and billing
    const updated = {
      ...svc,
      owner: 'Bob',
      plan: 'paid' as const,
      billing: { type: 'manual' as const, period: 'monthly' as const, amount: 10, lastRenewed: '2026-03-01' },
      needsReview: false,
    };
    await useStore.getState().updateManualService(updated);

    expect(useStore.getState().stackScore).toBeGreaterThan(scoreBefore);
  });

  it('recalculates score after deleteManualService', async () => {
    const svc = makeService('stripe', {
      source: 'manual',
      plan: 'paid',
      billing: { type: 'manual', period: 'monthly', amount: 50, lastRenewed: '2026-03-01' },
      owner: 'Alice',
      needsReview: false,
    });
    useStore.setState({
      services: [svc],
      config: {
        version: '1',
        project: { name: 'Test', description: '' },
        services: [svc],
        accounts: [],
      },
    });
    useStore.getState().recalculateScore();
    expect(useStore.getState().stackScore).toBeGreaterThan(0);

    await useStore.getState().deleteManualService('stripe');

    // No services → score is 0
    expect(useStore.getState().stackScore).toBe(0);
  });

  it('recalculateScore stores healthChecks alongside stackScore', () => {
    const svc = makeService('stripe', {
      source: 'manual',
      plan: 'paid',
      owner: 'Alice',
      billing: { type: 'manual', period: 'monthly', amount: 50, lastRenewed: '2026-03-01' },
    });
    useStore.setState({
      services: [svc],
      flowNodes: [],
      flowEdges: [],
    });

    useStore.getState().recalculateScore();

    const state = useStore.getState();
    expect(state.stackScore).toBeGreaterThan(0);
    expect(state.healthChecks.length).toBeGreaterThan(0);
  });
});

// ── cancelScan navigation ──

describe('cancelScan navigation', () => {
  beforeEach(() => {
    useStore.setState({
      services: [],
      isAnalyzing: true,
      scanProgress: { phase: 'Scanning...', percent: 50, counts: { evidences: 0, services: 0, vulns: 0 } },
      activePanel: 'flow',
    });
    vi.clearAllMocks();
  });

  it('navigates to dashboard when no services exist', () => {
    useStore.getState().cancelScan();
    expect(useStore.getState().activePanel).toBe('dashboard');
  });

  it('navigates to services when partial results exist', () => {
    useStore.setState({ services: [makeService('redis')] });
    useStore.getState().cancelScan();
    expect(useStore.getState().activePanel).toBe('services');
  });
});

// ── closeStack ──

describe('closeStack', () => {
  beforeEach(() => {
    useStore.setState({
      services: [makeService('redis')],
      dependencies: [{ name: 'express', version: '4.0.0', type: 'npm' }],
      flowNodes: [makeNode('redis')],
      flowEdges: [],
      repoPath: '/test/repo',
      config: { version: '1', project: { name: 'Test', description: '' }, services: [], accounts: [] },
      activePanel: 'services',
    });
  });

  it('clears all state and navigates to dashboard', () => {
    useStore.getState().closeStack();
    const state = useStore.getState();

    expect(state.services).toHaveLength(0);
    expect(state.dependencies).toHaveLength(0);
    expect(state.flowNodes).toHaveLength(0);
    expect(state.flowEdges).toHaveLength(0);
    expect(state.repoPath).toBeNull();
    expect(state.config).toBeNull();
    expect(state.activePanel).toBe('dashboard');
  });
});
