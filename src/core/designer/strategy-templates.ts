import { defaultGraph } from './store';
import type { StrategyTemplate } from './library-store';

/**
 * Built-in strategy templates (Phase 5, HBD-2026-DES-004).
 *
 * These are the Designer's out-of-the-box strategies, hand-authored as graphs so
 * they open straight into the canvas and regenerate code. They mirror the shapes
 * in `honba-strategies` but are bundled because the frontend cannot fetch that
 * repo's `registry.json` (see the Phase 5 note in the plan: `GET /strategies`
 * returns the compiled-session catalogue, not the registry).
 *
 * Every template must pass `validateGraph` — universe node present, ports
 * type-consistent — so the Verify button is green on open.
 */
export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: 'sma_crossover',
    name: 'sma_cross',
    category: 'momentum/trend',
    description: 'Classic dual moving-average crossover: go long when the fast SMA crosses above the slow SMA.',
    tags: ['trend', 'sma', 'crossover'],
    graph: defaultGraph(),
  },
  {
    id: 'rsi_mean_reversion',
    name: 'rsi_mean_reversion',
    category: 'mean_reversion',
    description: 'Buy oversold conditions: enter when RSI drops below the threshold.',
    tags: ['mean-reversion', 'rsi', 'oversold'],
    graph: {
      schema_version: 1,
      name: 'rsi_mean_reversion',
      universe: { explicit: [{ symbol: 'TCS', exchange: 'NSE' }] },
      driving_timeframe: { interval: 15, aggregation: 'minute' },
      warmup_bars: 15,
      subscriptions: { quotes: false, trades: false },
      nodes: [
        { id: 'n1', type: 'universe', label: 'Universe' },
        { id: 'r', type: 'indicator', indicator: 'rsi', label: 'RSI 14', params: { period: 14 } },
        { id: 'c', type: 'condition', label: 'RSI < 30', params: { op: 'lt', threshold: 30 } },
        { id: 'o', type: 'order', label: 'Entry Long', params: { side: 'buy', quantity: 1 } },
      ],
      edges: [
        { id: 'e1', from_node: 'n1', from_port: 'bars', to_node: 'r', to_port: 'input' },
        { id: 'e2', from_node: 'r', from_port: 'value', to_node: 'c', to_port: 'left' },
        { id: 'e3', from_node: 'c', from_port: 'signal', to_node: 'o', to_port: 'signal' },
      ],
    },
  },
  {
    id: 'donchian_breakout',
    name: 'donchian_breakout',
    category: 'momentum/breakout',
    description: 'Breakout entry above the Donchian channel upper band.',
    tags: ['breakout', 'donchian', 'channel'],
    graph: {
      schema_version: 1,
      name: 'donchian_breakout',
      universe: { explicit: [{ symbol: 'RELIANCE', exchange: 'NSE' }] },
      driving_timeframe: { interval: 1, aggregation: 'day' },
      warmup_bars: 20,
      subscriptions: { quotes: false, trades: false },
      nodes: [
        { id: 'n1', type: 'universe', label: 'Universe' },
        { id: 'd', type: 'indicator', indicator: 'donchian', label: 'Donchian 20', params: { period: 20 } },
        { id: 'c', type: 'condition', label: 'Close > Upper', params: { op: 'crosses_above' } },
        { id: 'o', type: 'order', label: 'Entry Long', params: { side: 'buy', quantity: 1 } },
      ],
      edges: [
        { id: 'e1', from_node: 'n1', from_port: 'bars', to_node: 'd', to_port: 'input' },
        { id: 'e2', from_node: 'd', from_port: 'value', to_node: 'c', to_port: 'left' },
        { id: 'e3', from_node: 'c', from_port: 'signal', to_node: 'o', to_port: 'signal' },
      ],
    },
  },
  {
    id: 'bollinger_reversion',
    name: 'bollinger_reversion',
    category: 'volatility',
    description: 'Volatility-band reversion: enter long when price pierces the lower Bollinger band.',
    tags: ['volatility', 'bollinger', 'reversion'],
    graph: {
      schema_version: 1,
      name: 'bollinger_reversion',
      universe: { explicit: [{ symbol: 'INFY', exchange: 'NSE' }] },
      driving_timeframe: { interval: 5, aggregation: 'minute' },
      warmup_bars: 20,
      subscriptions: { quotes: false, trades: false },
      nodes: [
        { id: 'n1', type: 'universe', label: 'Universe' },
        { id: 'b', type: 'indicator', indicator: 'bollinger', label: 'Bollinger 20/2', params: { length: 20, std: 2 } },
        { id: 'c', type: 'condition', label: 'Below Lower', params: { op: 'lt' } },
        { id: 'o', type: 'order', label: 'Entry Long', params: { side: 'buy', quantity: 1 } },
      ],
      edges: [
        { id: 'e1', from_node: 'n1', from_port: 'bars', to_node: 'b', to_port: 'input' },
        { id: 'e2', from_node: 'b', from_port: 'value', to_node: 'c', to_port: 'left' },
        { id: 'e3', from_node: 'c', from_port: 'signal', to_node: 'o', to_port: 'signal' },
      ],
    },
  },
];
