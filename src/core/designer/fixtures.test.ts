import { describe, expect, it } from 'vitest';

import { DEFAULT_NODE_POSITIONS, defaultGraph } from './store';
import { GRAPH_SMA_CROSS, GRAPH_SMA_CROSS_POSITIONS } from './fixtures';
import { canonicalJson } from '../graph/model';

/**
 * Phase 0 regression lock (HBD-2026-DES-004): the default graph and its canonical
 * layout are frozen fixtures. If this fails, the default graph changed and the
 * Phase 3 code->graph round-trip fixtures must be re-baselined deliberately.
 */
describe('designer fixtures (Phase 0 lock)', () => {
  it('defaultGraph() is byte-identical to the frozen GRAPH_SMA_CROSS fixture', () => {
    expect(canonicalJson(defaultGraph())).toBe(canonicalJson(GRAPH_SMA_CROSS));
  });

  it('DEFAULT_NODE_POSITIONS matches the frozen positions for every frozen node', () => {
    for (const [id, expected] of Object.entries(GRAPH_SMA_CROSS_POSITIONS)) {
      expect(DEFAULT_NODE_POSITIONS[id]).toEqual(expected);
    }
  });

  it('the frozen graph is structurally self-consistent (every edge joins declared nodes)', () => {
    const ids = new Set(GRAPH_SMA_CROSS.nodes.map((n) => n.id));
    for (const edge of GRAPH_SMA_CROSS.edges ?? []) {
      expect(ids.has(edge.from_node)).toBe(true);
      expect(ids.has(edge.to_node)).toBe(true);
    }
  });
});
