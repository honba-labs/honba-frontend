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
 * type-consistent — so the Verify button is green on open, and must round-trip
 * through the Phase 3 recogniser.
 *
 * The run engine executes only the three registered Rust strategies
 * (`sma_crossover`, `buy_and_hold`, `rsi_reversal`). The first template is named
 * `sma_crossover` to match one of them, so the Simulator's default selection
 * backtests end to end; the rest run only once a Rust implementation carries
 * their name (owner: `honba`).
 */
export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: 'sma_crossover',
    name: 'sma_crossover',
    category: 'momentum/trend',
    description:
      'Dual moving-average crossover, mirroring the registered Rust `sma_crossover` (fast 3 / slow 8). This is the one built-in whose name matches a run-engine strategy, so it backtests end to end (Phase 6).',
    tags: ['trend', 'sma', 'crossover', 'runnable'],
    graph: {
      schema_version: 1,
      name: 'sma_crossover',
      universe: { explicit: [{ symbol: 'TCS', exchange: 'NSE' }] },
      driving_timeframe: { interval: 1, aggregation: 'day' },
      warmup_bars: 8,
      subscriptions: { quotes: false, trades: false },
      nodes: [
        { id: 'n1', type: 'universe', label: 'Universe' },
        { id: 'f', type: 'indicator', indicator: 'sma', label: 'Fast SMA', params: { period: 3 } },
        { id: 's', type: 'indicator', indicator: 'sma', label: 'Slow SMA', params: { period: 8 } },
        { id: 'c', type: 'condition', label: 'Cross', params: { op: 'crosses_above' } },
        { id: 'o', type: 'order', label: 'Entry Long', params: { side: 'buy', quantity: 10 } },
      ],
      edges: [
        { id: 'e1', from_node: 'n1', from_port: 'bars', to_node: 'f', to_port: 'input' },
        { id: 'e2', from_node: 'n1', from_port: 'bars', to_node: 's', to_port: 'input' },
        { id: 'e3', from_node: 'f', from_port: 'value', to_node: 'c', to_port: 'left' },
        { id: 'e4', from_node: 's', from_port: 'value', to_node: 'c', to_port: 'right' },
        { id: 'e5', from_node: 'c', from_port: 'signal', to_node: 'o', to_port: 'signal' },
      ],
    },
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
  {
    id: 'multi_signal_confluence',
    name: 'multi_signal_confluence',
    category: 'momentum/trend',
    description:
      'Multi-indicator confluence strategy: combines trend confirmation (Dual SMA) with momentum filter (RSI) via logic confluence — the more signals indicating buy/sell the better.',
    tags: ['confluence', 'trend', 'momentum', 'multi-signal', 'sma', 'rsi'],
    graph: {
      schema_version: 1,
      name: 'multi_signal_confluence',
      universe: { explicit: [{ symbol: 'TCS', exchange: 'NSE' }] },
      driving_timeframe: { interval: 5, aggregation: 'minute' },
      warmup_bars: 15,
      subscriptions: { quotes: false, trades: false },
      nodes: [
        { id: 'n1', type: 'universe', label: 'Universe' },
        { id: 'f', type: 'indicator', indicator: 'sma', label: 'Fast SMA', params: { period: 5 } },
        { id: 's', type: 'indicator', indicator: 'sma', label: 'Slow SMA', params: { period: 15 } },
        { id: 'r', type: 'indicator', indicator: 'rsi', label: 'RSI 14', params: { period: 14 } },
        { id: 'c1', type: 'condition', label: 'SMA Cross', params: { op: 'crosses_above' } },
        { id: 'c2', type: 'condition', label: 'RSI < 45', params: { op: 'lt', threshold: 45 } },
        { id: 'gate', type: 'logic', label: 'Confluence Gate', params: { op: 'and' } },
        { id: 'o', type: 'order', label: 'Entry Long', params: { side: 'buy', quantity: 10 } },
      ],
      edges: [
        { id: 'e1', from_node: 'n1', from_port: 'bars', to_node: 'f', to_port: 'input' },
        { id: 'e2', from_node: 'n1', from_port: 'bars', to_node: 's', to_port: 'input' },
        { id: 'e3', from_node: 'n1', from_port: 'bars', to_node: 'r', to_port: 'input' },
        { id: 'e4', from_node: 'f', from_port: 'value', to_node: 'c1', to_port: 'left' },
        { id: 'e5', from_node: 's', from_port: 'value', to_node: 'c1', to_port: 'right' },
        { id: 'e6', from_node: 'r', from_port: 'value', to_node: 'c2', to_port: 'left' },
        { id: 'e7', from_node: 'c1', from_port: 'signal', to_node: 'gate', to_port: 'a' },
        { id: 'e8', from_node: 'c2', from_port: 'signal', to_node: 'gate', to_port: 'b' },
        { id: 'e9', from_node: 'gate', from_port: 'signal', to_node: 'o', to_port: 'signal' },
      ],
    },
  },
];
