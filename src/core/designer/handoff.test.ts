import { describe, expect, it } from 'vitest';

import { defaultGraph } from './store';
import { SIMULATOR_HANDOFF_KEY, simulatorHandoffUrl, stashHandoff, takeHandoff } from './handoff';
import type { LayoutStorage } from './layout';

function fakeStorage(): LayoutStorage & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

describe('designer -> simulator hand-off (Phase 1/6 boundary)', () => {
  it('builds a simulator URL that carries the strategy slug and provenance', () => {
    const url = simulatorHandoffUrl('momentum sma/cross & co');
    expect(url.startsWith('/simulator.html?')).toBe(true);
    expect(url).toContain('strategy=momentum%20sma%2Fcross%20%26%20co');
    expect(url).toContain('source=designer');
  });

  it('stashes the graph in sessionStorage and reads it back', () => {
    const storage = fakeStorage();
    expect(stashHandoff(defaultGraph(), storage)).toBe(true);
    const handoff = takeHandoff(storage);
    expect(handoff?.name).toBe('sma_cross');
    expect(handoff?.source).toBe('designer');
    expect(handoff?.graph.nodes).toHaveLength(defaultGraph().nodes.length);
  });

  it('returns null without storage or without a stashed payload', () => {
    expect(stashHandoff(defaultGraph(), null)).toBe(false);
    expect(takeHandoff(null)).toBeNull();
    expect(takeHandoff(fakeStorage())).toBeNull();
  });

  it('rejects a corrupt or structurally invalid payload', () => {
    const storage = fakeStorage();
    storage.data[SIMULATOR_HANDOFF_KEY] = '{not json';
    expect(takeHandoff(storage)).toBeNull();
    storage.data[SIMULATOR_HANDOFF_KEY] = JSON.stringify({ name: 'x', graph: { nodes: 'nope' } });
    expect(takeHandoff(storage)).toBeNull();
  });
});
