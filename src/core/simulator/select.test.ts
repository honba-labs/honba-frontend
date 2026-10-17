import { describe, expect, it } from 'vitest';

import type { SimulatorHandoff } from '../designer/handoff';
import type { SavedStrategyManifest } from '../designer/library-store';
import { STRATEGY_TEMPLATES } from '../designer/strategy-templates';
import type { StrategyGraphShape } from '../graph/model';

import { DEFAULT_CONTROLS } from './controls';
import { controlsForGraph, graphIsRunnable, resolveSelection, universeString } from './select';

const TEMPLATE = STRATEGY_TEMPLATES[0].graph;
const OTHER_TEMPLATE = STRATEGY_TEMPLATES[1].graph;

function manifest(id: string, graph: StrategyGraphShape): SavedStrategyManifest {
  return {
    id,
    name: graph.name,
    version: '1.0.0',
    category: 'custom',
    description: '',
    tags: [],
    author: 'local',
    updated_at: 0,
    python_source: '',
    graph,
    default_universe: { symbol: 'TCS', exchange: 'NSE', timeframe: '1m' },
    default_params: {},
  };
}

function handoffOf(graph: StrategyGraphShape): SimulatorHandoff {
  return { name: graph.name, graph, source: 'designer', timestamp: 0 };
}

describe('simulator selection — hand-off decode', () => {
  it('adopts the sessionStorage graph when the slug matches', () => {
    const selection = resolveSelection({
      query: '?strategy=sma_cross&source=designer',
      handoff: handoffOf(TEMPLATE),
    });
    expect(selection.origin).toBe('designer');
    expect(selection.graph).toBe(TEMPLATE);
  });

  it('adopts the hand-off when there is no slug (designer navigation lost the query)', () => {
    const selection = resolveSelection({ handoff: handoffOf(TEMPLATE) });
    expect(selection.origin).toBe('designer');
    expect(selection.name).toBe(TEMPLATE.name);
  });

  it('ignores a hand-off whose slug names a different strategy', () => {
    const selection = resolveSelection({
      query: '?strategy=some_other_script&source=designer',
      handoff: handoffOf(TEMPLATE),
      saved: [manifest('some_other_script', OTHER_TEMPLATE)],
    });
    expect(selection.origin).toBe('library');
    expect(selection.graph).toBe(OTHER_TEMPLATE);
  });

  it('rejects a structurally invalid hand-off and falls back to the Library', () => {
    const corrupt = { ...TEMPLATE, nodes: [] };
    const selection = resolveSelection({ handoff: handoffOf(corrupt), saved: [manifest('saved_1', OTHER_TEMPLATE)] });
    expect(selection.origin).toBe('library');
    expect(selection.graph).toBe(OTHER_TEMPLATE);
  });
});

describe('simulator selection — Library fallback', () => {
  it('selects a saved strategy by slug or id', () => {
    const saved = [manifest('momentum_sma', OTHER_TEMPLATE)];
    expect(resolveSelection({ query: '?strategy=momentum_sma', saved }).graph).toBe(OTHER_TEMPLATE);
  });

  it('falls back to the first runnable saved strategy', () => {
    const selection = resolveSelection({ query: '?strategy=unknown', saved: [manifest('x', OTHER_TEMPLATE)] });
    expect(selection.origin).toBe('library');
    expect(selection.graph).toBe(OTHER_TEMPLATE);
  });

  it('falls back to a built-in template when the Library is empty', () => {
    const selection = resolveSelection({ query: '?strategy=nothing' });
    expect(selection.origin).toBe('template');
    expect(graphIsRunnable(selection.graph)).toBe(true);
  });

  it('validates graphs by structural issues', () => {
    expect(graphIsRunnable(TEMPLATE)).toBe(true);
    expect(graphIsRunnable({ ...TEMPLATE, nodes: [] })).toBe(false);
    expect(graphIsRunnable(null)).toBe(false);
  });
});

describe('simulator selection — controls pre-fill', () => {
  it('pre-fills symbol, exchange and timeframe from the strategy graph', () => {
    const { interval, aggregation } = TEMPLATE.driving_timeframe;
    const unit = { minute: 'm', hour: 'h', day: 'd', week: 'w', month: 'mo', second: 's' }[aggregation] ?? 'd';
    const prefill = controlsForGraph(TEMPLATE);
    expect(prefill.symbol).toBe('TCS');
    expect(prefill.exchange).toBe('NSE');
    expect(prefill.timeframe).toBe(`${interval}${unit}`);
  });

  it('prefers the named universe, then explicit subscriptions, then the panel symbol', () => {
    expect(universeString({ ...TEMPLATE, universe: { named: 'nifty50' } }, DEFAULT_CONTROLS)).toBe('nifty50');
    expect(
      universeString({ ...TEMPLATE, universe: { explicit: [{ symbol: 'INFY', exchange: 'NSE' }] } }, DEFAULT_CONTROLS),
    ).toBe('INFY.NSE');
    expect(
      universeString({ ...TEMPLATE, universe: {} }, { ...DEFAULT_CONTROLS, symbol: ' wipro ', exchange: 'nse' }),
    ).toBe('WIPRO.NSE');
  });
});
