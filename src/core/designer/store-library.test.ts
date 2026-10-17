import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_NODE_POSITIONS, defaultGraph, useDesignerStore } from './store';
import type { HonbaClient } from '../api/generated/client';
import { generateCode } from '../graph/codegen';
import { canonicalJson, graphHashSync, type StrategyGraphShape } from '../graph/model';
import type { SavedStrategyManifest } from './library-store';

function code(graph: StrategyGraphShape): string {
  return generateCode(graph, graphHashSync(graph));
}

function reset(): void {
  const graph = defaultGraph();
  useDesignerStore.setState({
    graph,
    positions: { ...DEFAULT_NODE_POSITIONS },
    selectedNodeId: null,
    selectedEdgeId: null,
    isModified: true,
    code: code(graph),
    codeEdited: false,
    sync: { status: 'idle', codeOnly: false, spans: [], sourceLines: {}, lastSource: null, error: null },
    savedStrategies: [],
    saveState: 'idle',
    versions: [],
  });
}

describe('designer store library slice (Phase 5)', () => {
  beforeEach(reset);

  it('saves the current strategy, snapshots a revision and clears the dirty flag', async () => {
    await useDesignerStore.getState().saveStrategy();
    const state = useDesignerStore.getState();
    expect(state.savedStrategies.map((entry) => entry.id)).toEqual(['sma_cross']);
    expect(state.saveState).toBe('saved');
    expect(state.isModified).toBe(false);
    expect(state.versions).toHaveLength(1);
  });

  it('records an offline state when the profile write fails (localStorage still holds it)', async () => {
    const client = {
      putProfileLayoutsByName: vi.fn().mockRejectedValue(new Error('network down')),
    } as unknown as HonbaClient;
    await useDesignerStore.getState().saveStrategy(client);
    const state = useDesignerStore.getState();
    expect(state.savedStrategies).toHaveLength(1);
    expect(state.saveState).toBe('offline');
  });

  it('persists through the profile API when available and marks saved', async () => {
    const put = vi.fn().mockResolvedValue({ data: { revision: 1 } });
    const client = { putProfileLayoutsByName: put } as unknown as HonbaClient;
    await useDesignerStore.getState().saveStrategy(client);
    expect(put).toHaveBeenCalledWith('sma_cross', expect.objectContaining({ id: 'sma_cross' }));
    expect(useDesignerStore.getState().saveState).toBe('saved');
  });

  it('forks a saved strategy under a fresh id and name', async () => {
    await useDesignerStore.getState().saveStrategy();
    const original = useDesignerStore.getState().savedStrategies[0] as SavedStrategyManifest;
    await useDesignerStore.getState().forkStrategy(original);

    const state = useDesignerStore.getState();
    expect(state.savedStrategies.map((entry) => entry.id).sort()).toEqual(['sma_cross', 'sma_cross_copy']);
    expect(state.graph.name).toBe('sma_cross_copy');
    // The original is untouched.
    expect(state.savedStrategies.find((entry) => entry.id === 'sma_cross')?.name).toBe('sma_cross');
  });

  it('deletes a saved strategy from the library only', async () => {
    await useDesignerStore.getState().saveStrategy();
    const graphBefore = canonicalJson(useDesignerStore.getState().graph);
    useDesignerStore.getState().deleteSavedStrategy('sma_cross');
    const state = useDesignerStore.getState();
    expect(state.savedStrategies).toEqual([]);
    expect(canonicalJson(state.graph)).toBe(graphBefore);
  });

  it('opens a strategy, regenerating code and resetting the sync slice', async () => {
    const other: StrategyGraphShape = { ...defaultGraph(), name: 'opened_strategy' };
    await useDesignerStore.getState().openStrategy(other);
    const state = useDesignerStore.getState();
    expect(state.graph.name).toBe('opened_strategy');
    expect(state.code).toContain('class OpenedStrategy');
    expect(state.sync.status).toBe('synced');
    expect(state.tab).toBe('canvas');
    expect(state.saveState).toBe('idle');
  });

  it('exportPython returns the current generated source', () => {
    expect(useDesignerStore.getState().exportPython()).toBe(code(defaultGraph()));
  });
});
