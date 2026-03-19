import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FlowNode, FlowEdge, GraphConfig, Service } from '../../types';

const { mockStackwatch } = vi.hoisted(() => {
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

  return { mockStackwatch };
});

import { useGraphStore } from '../graphStore';
import { useHistoryStore } from '../historyStore';

function makeFlowNode(id: string, serviceId?: string): FlowNode {
  return {
    id: serviceId ? `svc-${serviceId}` : id,
    label: id,
    type: 'external',
    serviceId,
  };
}

function makeFlowEdge(source: string, target: string, flowType: FlowEdge['flowType'] = 'data'): FlowEdge {
  return { source, target, flowType };
}

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

describe('graphStore', () => {
  beforeEach(() => {
    useGraphStore.setState({ nodes: [], edges: [], excludedServices: [] });
    useHistoryStore.setState({ past: [], future: [] });
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initFromAnalysis', () => {
    it('creates nodes from flow nodes', () => {
      const flowNodes: FlowNode[] = [
        makeFlowNode('redis', 'redis'),
        makeFlowNode('stripe', 'stripe'),
      ];
      const flowEdges: FlowEdge[] = [makeFlowEdge('svc-redis', 'svc-stripe')];
      const services = [makeService('redis'), makeService('stripe')];

      useGraphStore.getState().initFromAnalysis(flowNodes, flowEdges, undefined, services);
      const state = useGraphStore.getState();

      expect(state.nodes).toHaveLength(2);
      expect(state.nodes.map(n => n.id)).toContain('svc-redis');
      expect(state.nodes.map(n => n.id)).toContain('svc-stripe');
    });

    it('creates edges from flow edges', () => {
      const flowNodes: FlowNode[] = [
        makeFlowNode('redis', 'redis'),
        makeFlowNode('stripe', 'stripe'),
      ];
      const flowEdges: FlowEdge[] = [makeFlowEdge('svc-redis', 'svc-stripe')];

      useGraphStore.getState().initFromAnalysis(flowNodes, flowEdges, undefined, []);
      const state = useGraphStore.getState();

      expect(state.edges).toHaveLength(1);
      expect(state.edges[0].source).toBe('svc-redis');
      expect(state.edges[0].target).toBe('svc-stripe');
    });

    it('enriches nodes with service data', () => {
      const flowNodes: FlowNode[] = [makeFlowNode('redis', 'redis')];
      const services = [makeService('redis', { category: 'database', plan: 'paid', confidence: 'high' })];

      useGraphStore.getState().initFromAnalysis(flowNodes, [], undefined, services);
      const node = useGraphStore.getState().nodes[0];

      expect(node.data.category).toBe('database');
      expect(node.data.plan).toBe('paid');
      expect(node.data.confidence).toBe('high');
    });

    it('restores saved positions from graphConfig', () => {
      const flowNodes: FlowNode[] = [makeFlowNode('redis', 'redis')];
      const graphConfig: GraphConfig = {
        nodes: [{
          id: 'svc-redis',
          position: { x: 100, y: 200 },
          data: { label: 'Redis' },
        }],
        edges: [],
        excludedServices: [],
      };

      useGraphStore.getState().initFromAnalysis(flowNodes, [], graphConfig, []);
      const node = useGraphStore.getState().nodes[0];

      expect(node.position).toEqual({ x: 100, y: 200 });
    });

    it('restores excludedServices from graphConfig', () => {
      const graphConfig: GraphConfig = {
        nodes: [],
        edges: [],
        excludedServices: ['svc-old'],
      };

      useGraphStore.getState().initFromAnalysis([], [], graphConfig, []);

      expect(useGraphStore.getState().excludedServices).toEqual(['svc-old']);
    });
  });

  describe('onNodesChange', () => {
    it('applies position changes', () => {
      useGraphStore.setState({
        nodes: [{
          id: 'n1',
          position: { x: 0, y: 0 },
          data: { label: 'Test' },
        }],
      });

      useGraphStore.getState().onNodesChange([{
        type: 'position',
        id: 'n1',
        position: { x: 50, y: 75 },
      }]);

      const node = useGraphStore.getState().nodes.find(n => n.id === 'n1');
      expect(node?.position).toEqual({ x: 50, y: 75 });
    });
  });

  describe('onEdgesChange', () => {
    it('applies edge removal', () => {
      useGraphStore.setState({
        edges: [{ id: 'e1', source: 'a', target: 'b' }],
      });

      useGraphStore.getState().onEdgesChange([{ type: 'remove', id: 'e1' }]);

      expect(useGraphStore.getState().edges).toHaveLength(0);
    });
  });

  describe('onConnect', () => {
    it('creates a new edge between nodes', () => {
      useGraphStore.setState({
        nodes: [
          { id: 'a', position: { x: 0, y: 0 }, data: { label: 'A' } },
          { id: 'b', position: { x: 100, y: 0 }, data: { label: 'B' } },
        ],
        edges: [],
      });

      useGraphStore.getState().onConnect({
        source: 'a',
        target: 'b',
        sourceHandle: null,
        targetHandle: null,
      });

      const edges = useGraphStore.getState().edges;
      expect(edges).toHaveLength(1);
      expect(edges[0].source).toBe('a');
      expect(edges[0].target).toBe('b');
    });

    it('does not connect a node to itself', () => {
      useGraphStore.setState({ nodes: [], edges: [] });

      useGraphStore.getState().onConnect({
        source: 'a',
        target: 'a',
        sourceHandle: null,
        targetHandle: null,
      });

      expect(useGraphStore.getState().edges).toHaveLength(0);
    });

    it('pushes history snapshot before connecting', () => {
      useGraphStore.setState({ nodes: [], edges: [] });

      useGraphStore.getState().onConnect({
        source: 'a',
        target: 'b',
        sourceHandle: null,
        targetHandle: null,
      });

      expect(useHistoryStore.getState().past).toHaveLength(1);
      expect(useHistoryStore.getState().past[0].label).toBe('Connect nodes');
    });
  });

  describe('addNode', () => {
    it('adds a new node to the graph', () => {
      useGraphStore.getState().addNode('new-1', { x: 10, y: 20 }, {
        label: 'New Node',
        nodeType: 'api',
      });

      const nodes = useGraphStore.getState().nodes;
      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe('new-1');
      expect(nodes[0].position).toEqual({ x: 10, y: 20 });
      expect(nodes[0].data.label).toBe('New Node');
      expect(nodes[0].data.nodeType).toBe('api');
      expect(nodes[0].data.source).toBe('manual');
    });

    it('pushes history snapshot', () => {
      useGraphStore.getState().addNode('n', { x: 0, y: 0 }, { label: 'N' });

      expect(useHistoryStore.getState().past).toHaveLength(1);
      expect(useHistoryStore.getState().past[0].label).toBe('Add node');
    });
  });

  describe('updateNode', () => {
    it('updates node data', () => {
      useGraphStore.setState({
        nodes: [{
          id: 'n1',
          position: { x: 0, y: 0 },
          data: { label: 'Old', nodeType: 'external' },
        }],
      });

      useGraphStore.getState().updateNode('n1', { label: 'Updated' });

      expect(useGraphStore.getState().nodes[0].data.label).toBe('Updated');
    });

    it('pushes history snapshot', () => {
      useGraphStore.setState({
        nodes: [{
          id: 'n1',
          position: { x: 0, y: 0 },
          data: { label: 'Old', nodeType: 'external' },
        }],
      });

      useGraphStore.getState().updateNode('n1', { label: 'New' });

      expect(useHistoryStore.getState().past).toHaveLength(1);
      expect(useHistoryStore.getState().past[0].label).toBe('Update node');
    });
  });

  describe('deleteNode', () => {
    it('removes the node and connected edges', () => {
      useGraphStore.setState({
        nodes: [
          { id: 'a', position: { x: 0, y: 0 }, data: { label: 'A' } },
          { id: 'b', position: { x: 100, y: 0 }, data: { label: 'B' } },
        ],
        edges: [
          { id: 'e1', source: 'a', target: 'b' },
          { id: 'e2', source: 'b', target: 'a' },
        ],
      });

      useGraphStore.getState().deleteNode('a');

      const state = useGraphStore.getState();
      expect(state.nodes).toHaveLength(1);
      expect(state.nodes[0].id).toBe('b');
      expect(state.edges).toHaveLength(0);
    });

    it('pushes history snapshot', () => {
      useGraphStore.setState({
        nodes: [{ id: 'a', position: { x: 0, y: 0 }, data: { label: 'A' } }],
        edges: [],
      });

      useGraphStore.getState().deleteNode('a');

      expect(useHistoryStore.getState().past).toHaveLength(1);
      expect(useHistoryStore.getState().past[0].label).toBe('Delete node');
    });
  });

  describe('addEdge', () => {
    it('adds a new edge', () => {
      useGraphStore.getState().addEdge('a', 'b', 'auth');

      const edges = useGraphStore.getState().edges;
      expect(edges).toHaveLength(1);
      expect(edges[0].source).toBe('a');
      expect(edges[0].target).toBe('b');
      expect(edges[0].data.flowType).toBe('auth');
    });
  });

  describe('deleteEdge', () => {
    it('removes the specified edge', () => {
      useGraphStore.setState({
        edges: [
          { id: 'e1', source: 'a', target: 'b' },
          { id: 'e2', source: 'b', target: 'c' },
        ],
      });

      useGraphStore.getState().deleteEdge('e1');

      const edges = useGraphStore.getState().edges;
      expect(edges).toHaveLength(1);
      expect(edges[0].id).toBe('e2');
    });

    it('pushes history snapshot', () => {
      useGraphStore.setState({
        edges: [{ id: 'e1', source: 'a', target: 'b' }],
      });

      useGraphStore.getState().deleteEdge('e1');

      expect(useHistoryStore.getState().past).toHaveLength(1);
      expect(useHistoryStore.getState().past[0].label).toBe('Delete edge');
    });
  });

  describe('updateEdgeType', () => {
    it('changes the flow type of an edge', () => {
      useGraphStore.setState({
        edges: [{
          id: 'e1',
          source: 'a',
          target: 'b',
          data: { flowType: 'data' },
        }],
      });

      useGraphStore.getState().updateEdgeType('e1', 'payment');

      const edge = useGraphStore.getState().edges[0];
      expect(edge.data.flowType).toBe('payment');
    });

    it('pushes history snapshot', () => {
      useGraphStore.setState({
        edges: [{
          id: 'e1',
          source: 'a',
          target: 'b',
          data: { flowType: 'data' },
        }],
      });

      useGraphStore.getState().updateEdgeType('e1', 'auth');

      expect(useHistoryStore.getState().past).toHaveLength(1);
      expect(useHistoryStore.getState().past[0].label).toBe('Change edge type');
    });
  });

  describe('excludeService', () => {
    it('adds service id to excluded list', () => {
      useGraphStore.getState().excludeService('svc-redis');

      expect(useGraphStore.getState().excludedServices).toContain('svc-redis');
    });
  });

  describe('resetLayout', () => {
    it('recalculates node positions', () => {
      useGraphStore.setState({
        nodes: [
          { id: 'a', position: { x: 500, y: 500 }, data: { label: 'A' } },
          { id: 'b', position: { x: 500, y: 500 }, data: { label: 'B' } },
        ],
        edges: [{ id: 'e1', source: 'a', target: 'b' }],
      });

      useGraphStore.getState().resetLayout();

      const nodes = useGraphStore.getState().nodes;
      expect(nodes[0].position.x).not.toBe(500);
      expect(nodes[0].position.y).not.toBe(500);
    });

    it('pushes history snapshot', () => {
      useGraphStore.setState({
        nodes: [{ id: 'a', position: { x: 0, y: 0 }, data: { label: 'A' } }],
        edges: [],
      });

      useGraphStore.getState().resetLayout();

      expect(useHistoryStore.getState().past).toHaveLength(1);
      expect(useHistoryStore.getState().past[0].label).toBe('Reset layout');
    });
  });

  describe('updateServiceNode', () => {
    it('updates the node matching a serviceId', () => {
      useGraphStore.setState({
        nodes: [
          { id: 'svc-redis', position: { x: 0, y: 0 }, data: { label: 'Redis', nodeType: 'database', serviceId: 'redis' } },
          { id: 'layer-custom', position: { x: 0, y: 100 }, data: { label: 'My Layer', nodeType: 'layer' } },
        ],
        edges: [],
      });

      useGraphStore.getState().updateServiceNode('redis', { label: 'Redis Updated', category: 'database' });

      const node = useGraphStore.getState().nodes.find(n => n.id === 'svc-redis');
      expect(node?.data.label).toBe('Redis Updated');
      expect(node?.data.category).toBe('database');
    });

    it('is a no-op when serviceId is not found', () => {
      useGraphStore.setState({
        nodes: [{ id: 'svc-redis', position: { x: 0, y: 0 }, data: { label: 'Redis', serviceId: 'redis' } }],
        edges: [],
      });

      useGraphStore.getState().updateServiceNode('nonexistent', { label: 'X' });

      expect(useGraphStore.getState().nodes[0].data.label).toBe('Redis');
    });

    it('does not affect layer nodes when updating a service node', () => {
      useGraphStore.setState({
        nodes: [
          { id: 'svc-stripe', position: { x: 0, y: 0 }, data: { label: 'Stripe', nodeType: 'external', serviceId: 'stripe' } },
          { id: 'layer-custom-1', position: { x: 100, y: 200 }, data: { label: 'Custom Layer', nodeType: 'layer', layerColor: '#ff0000' } },
          { id: 'user', position: { x: 0, y: -100 }, data: { label: 'User', nodeType: 'layer' } },
        ],
        edges: [],
      });

      useGraphStore.getState().updateServiceNode('stripe', { label: 'Stripe Updated', plan: 'paid' });

      const nodes = useGraphStore.getState().nodes;
      expect(nodes).toHaveLength(3);
      expect(nodes.find(n => n.id === 'layer-custom-1')?.data.label).toBe('Custom Layer');
      expect(nodes.find(n => n.id === 'user')?.data.label).toBe('User');
      expect(nodes.find(n => n.id === 'svc-stripe')?.data.label).toBe('Stripe Updated');
    });
  });

  describe('saveNodePosition', () => {
    it('persists position to the node', () => {
      useGraphStore.setState({
        nodes: [{ id: 'n1', position: { x: 0, y: 0 }, data: { label: 'N' } }],
      });

      useGraphStore.getState().saveNodePosition('n1', { x: 42, y: 99 });

      expect(useGraphStore.getState().nodes[0].position).toEqual({ x: 42, y: 99 });
    });
  });

  describe('persistToConfig', () => {
    it('is a no-op when window.stackwatch is absent', async () => {
      const original = window.stackwatch;
      (window as any).stackwatch = undefined;

      await useGraphStore.getState().persistToConfig();

      (window as any).stackwatch = original;
      expect(mockStackwatch.loadConfig).not.toHaveBeenCalled();
    });

    it('debounces calls with 500ms delay', async () => {
      const { useStore } = await import('../useStore');
      useStore.setState({ repoPath: '/test/repo' });
      mockStackwatch.loadConfig.mockResolvedValue(null);

      useGraphStore.getState().persistToConfig();
      useGraphStore.getState().persistToConfig();

      expect(mockStackwatch.loadConfig).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(500);

      expect(mockStackwatch.loadConfig).toHaveBeenCalledTimes(1);
    });
  });
});
