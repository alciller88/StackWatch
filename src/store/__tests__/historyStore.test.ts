import { describe, it, expect, beforeEach } from 'vitest';
import type { Node, Edge } from 'reactflow';
import type { Service } from '../../types';
import { useHistoryStore } from '../historyStore';

function makeSnapshot(label = 'test') {
  const nodes: Node[] = [{ id: `n-${label}`, position: { x: 0, y: 0 }, data: { label } }];
  const edges: Edge[] = [{ id: `e-${label}`, source: 'a', target: 'b' }];
  const services: Service[] = [{
    id: `s-${label}`,
    name: label,
    category: 'other',
    plan: 'unknown',
    source: 'inferred',
  }];
  return { nodes, edges, services };
}

describe('historyStore', () => {
  beforeEach(() => {
    useHistoryStore.setState({ past: [], future: [] });
  });

  describe('pushSnapshot', () => {
    it('adds snapshot to past stack', () => {
      const current = makeSnapshot('s1');

      useHistoryStore.getState().pushSnapshot('action1', current);

      const { past } = useHistoryStore.getState();
      expect(past).toHaveLength(1);
      expect(past[0].label).toBe('action1');
      expect(past[0].nodes).toHaveLength(1);
      expect(past[0].edges).toHaveLength(1);
      expect(past[0].services).toHaveLength(1);
    });

    it('clears future stack on new push', () => {
      useHistoryStore.setState({
        past: [],
        future: [{ label: 'old-future', ...makeSnapshot('future') }],
      });

      useHistoryStore.getState().pushSnapshot('new-action', makeSnapshot('new'));

      expect(useHistoryStore.getState().future).toHaveLength(0);
    });

    it('drops oldest when exceeding 50 snapshots', () => {
      const snapshots = Array.from({ length: 50 }, (_, i) => ({
        label: `action-${i}`,
        ...makeSnapshot(`s${i}`),
      }));
      useHistoryStore.setState({ past: snapshots, future: [] });

      useHistoryStore.getState().pushSnapshot('action-50', makeSnapshot('s50'));

      const { past } = useHistoryStore.getState();
      expect(past).toHaveLength(50);
      expect(past[0].label).toBe('action-1');
      expect(past[49].label).toBe('action-50');
    });
  });

  describe('undo', () => {
    it('moves last past item to return value and pushes current to future', () => {
      useHistoryStore.getState().pushSnapshot('first', makeSnapshot('first'));
      const current = makeSnapshot('current');

      const result = useHistoryStore.getState().undo(current);

      expect(result).not.toBeNull();
      expect(result!.label).toBe('first');
      expect(useHistoryStore.getState().past).toHaveLength(0);
      expect(useHistoryStore.getState().future).toHaveLength(1);
    });

    it('returns null when past is empty', () => {
      const result = useHistoryStore.getState().undo(makeSnapshot('current'));

      expect(result).toBeNull();
      expect(useHistoryStore.getState().future).toHaveLength(0);
    });
  });

  describe('redo', () => {
    it('moves first future item to return value and pushes current to past', () => {
      useHistoryStore.getState().pushSnapshot('first', makeSnapshot('first'));
      const current = makeSnapshot('current');
      useHistoryStore.getState().undo(current);

      const result = useHistoryStore.getState().redo(makeSnapshot('after-undo'));

      expect(result).not.toBeNull();
      expect(useHistoryStore.getState().future).toHaveLength(0);
      expect(useHistoryStore.getState().past).toHaveLength(1);
    });

    it('returns null when future is empty', () => {
      const result = useHistoryStore.getState().redo(makeSnapshot('current'));

      expect(result).toBeNull();
      expect(useHistoryStore.getState().past).toHaveLength(0);
    });
  });

  describe('canUndo', () => {
    it('returns false when past is empty', () => {
      expect(useHistoryStore.getState().canUndo()).toBe(false);
    });

    it('returns true when past has items', () => {
      useHistoryStore.getState().pushSnapshot('action', makeSnapshot('a'));

      expect(useHistoryStore.getState().canUndo()).toBe(true);
    });
  });

  describe('canRedo', () => {
    it('returns false when future is empty', () => {
      expect(useHistoryStore.getState().canRedo()).toBe(false);
    });

    it('returns true when future has items', () => {
      useHistoryStore.getState().pushSnapshot('action', makeSnapshot('a'));
      useHistoryStore.getState().undo(makeSnapshot('current'));

      expect(useHistoryStore.getState().canRedo()).toBe(true);
    });
  });

  describe('clear', () => {
    it('resets both stacks', () => {
      useHistoryStore.getState().pushSnapshot('a', makeSnapshot('a'));
      useHistoryStore.getState().pushSnapshot('b', makeSnapshot('b'));
      useHistoryStore.getState().undo(makeSnapshot('current'));

      useHistoryStore.getState().clear();

      expect(useHistoryStore.getState().past).toHaveLength(0);
      expect(useHistoryStore.getState().future).toHaveLength(0);
    });
  });
});
