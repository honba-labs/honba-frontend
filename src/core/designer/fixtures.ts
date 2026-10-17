import type { StrategyGraphShape } from '../graph/model';

/**
 * Frozen regression fixture for the designer's default graph (Phase 0, HBD-2026-DES-004).
 *
 * This is a byte-for-byte snapshot of `defaultGraph()` and MUST NOT be edited to
 * match code drift: a change here is a deliberate, reviewed decision. The lock test
 * `fixtures.test.ts` fails the moment `defaultGraph()` changes, which is the signal
 * that codegen/recognition round-trip fixtures for Phase 3 need re-baselining.
 *
 * Phase 3 will add a recognised round-trip pair (generated source -> graph) beside
 * this file; it is intentionally not included yet because the recognise endpoint
 * does not exist until then.
 */
export const GRAPH_SMA_CROSS: StrategyGraphShape = {
  schema_version: 1,
  name: 'sma_cross',
  universe: { explicit: [{ symbol: 'TCS', exchange: 'NSE' }] },
  driving_timeframe: { interval: 1, aggregation: 'minute' },
  warmup_bars: 2,
  subscriptions: { quotes: false, trades: false },
  nodes: [
    { id: 'n1', type: 'universe', label: 'Universe' },
    { id: 'f', type: 'indicator', indicator: 'sma', label: 'Fast SMA', params: { period: 2 } },
    { id: 's', type: 'indicator', indicator: 'sma', label: 'Slow SMA', params: { period: 4 } },
    { id: 'c', type: 'condition', label: 'Cross', params: { op: 'crosses_above' } },
    { id: 'o', type: 'order', label: 'Entry Long', params: { side: 'buy', quantity: 1 } },
  ],
  edges: [
    { id: 'e1', from_node: 'n1', from_port: 'bars', to_node: 'f', to_port: 'input' },
    { id: 'e2', from_node: 'n1', from_port: 'bars', to_node: 's', to_port: 'input' },
    { id: 'e3', from_node: 'f', from_port: 'value', to_node: 'c', to_port: 'left' },
    { id: 'e4', from_node: 's', from_port: 'value', to_node: 'c', to_port: 'right' },
    { id: 'e5', from_node: 'c', from_port: 'signal', to_node: 'o', to_port: 'signal' },
  ],
};

/**
 * Canonical layout fixture for the frozen graph, matching `DEFAULT_NODE_POSITIONS`
 * for the nodes that have entries there. Used to assert that graph sync does not
 * move existing nodes (Phase 3 stabilisation invariant).
 */
export const GRAPH_SMA_CROSS_POSITIONS: Record<string, { x: number; y: number }> = {
  n1: { x: 40, y: 160 },
  f: { x: 300, y: 70 },
  s: { x: 300, y: 250 },
  c: { x: 570, y: 160 },
  o: { x: 820, y: 160 },
};
