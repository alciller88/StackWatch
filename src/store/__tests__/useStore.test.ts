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
