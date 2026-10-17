import { describe, expect, it } from 'vitest';
import * as core from 'openalgo-charts';

import type { StrategyGraphShape } from '../graph/model';

import { chartSpecsFor, describeKind, ensureIndicatorRuntime, graphSpecs, registryIdFor, resolveSpecs, settingsFor } from './chart-series';

function graph(nodes: StrategyGraphShape['nodes']): StrategyGraphShape {
  return {
    schema_version: 1,
    name: 'test',
    universe: { explicit: [{ symbol: 'TCS', exchange: 'NSE' }] },
    driving_timeframe: { interval: 1, aggregation: 'day' },
    warmup_bars: 0,
    nodes,
    edges: [],
  };
}

const bar = (close: number) => ({
  time: 1_700_000_000 + close,
  open: close,
  high: close + 1,
  low: close - 1,
  close,
  volume: 100,
});

describe('registryIdFor', () => {
  it('maps graph kinds to registry ids and flags the kinds the registry lacks', () => {
    expect(registryIdFor('sma')).toBe('sma');
    expect(registryIdFor('rsi')).toBe('rsi');
    expect(registryIdFor('rma')).toBeNull();
    expect(registryIdFor('psar')).toBeNull();
    expect(registryIdFor('supertrend')).toBe('supertrend');
  });
});

describe('settingsFor', () => {
  it('renames graph parameters to the registry input keys', () => {
    expect(settingsFor('sma', { period: 3 })).toEqual({ length: 3 });
    expect(settingsFor('rsi', { period: 8 })).toEqual({ length: 8 });
    expect(settingsFor('macd', { fast: 5, slow: 13, signal: 4 })).toEqual({ fastPeriod: 5, slowPeriod: 13, signalPeriod: 4 });
    expect(settingsFor('bollinger', { length: 10, std: 2.5 })).toEqual({ length: 10, stdDev: 2.5 });
    expect(settingsFor('atr', { period: 14 })).toEqual({ period: 14 });
  });

  it('passes unaliased keys through and drops empty or non-finite values', () => {
    expect(settingsFor('sma', { period: 3, unknown: 'x' })).toEqual({ length: 3, unknown: 'x' });
    expect(settingsFor('sma', { period: Number.POSITIVE_INFINITY, other: null, deep: {} })).toEqual({});
  });
});

describe('describeKind', () => {
  it('reads the graph parameters in catalogue order', () => {
    expect(describeKind('sma', { period: 3 })).toBe('SMA 3');
    expect(describeKind('macd', { slow: 26, fast: 12, signal: 9 })).toBe('MACD 12/26/9');
    expect(describeKind('bollinger', { length: 20, std: 2 })).toBe('BOLLINGER 20/2');
    expect(describeKind('sma', {})).toBe('SMA');
  });
});

describe('graphSpecs', () => {
  it('turns every indicator node into a spec, keeping node labels and ids', () => {
    const specs = graphSpecs(
      graph([
        { id: 'u', type: 'universe' },
        { id: 'f', type: 'indicator', indicator: 'sma', label: 'Fast SMA', params: { period: 3 } },
        { id: 's', type: 'indicator', indicator: 'sma', label: 'Slow SMA', params: { period: 8 } },
        { id: 'r', type: 'indicator', indicator: 'rsi', params: { period: 14 } },
      ]),
    );
    expect(specs.map((s) => s.key)).toEqual(['f', 's', 'r']);
    expect(specs[0]).toMatchObject({ indicator: 'sma', label: 'Fast SMA', settings: { length: 3 }, supported: true });
    expect(specs[2]).toMatchObject({ indicator: 'rsi', label: 'RSI 14' });
  });

  it('cycles overlay colours so two periods of one kind are tellable apart', () => {
    const [a, b] = graphSpecs(
      graph([
        { id: 'f', type: 'indicator', indicator: 'sma', params: { period: 3 } },
        { id: 's', type: 'indicator', indicator: 'sma', params: { period: 8 } },
      ]),
    );
    expect(a.settings.color).toBeDefined();
    expect(a.settings.color).not.toBe(b.settings.color);
  });

  it('marks a kind the registry has no descriptor for as unsupported, with a reason', () => {
    const [spec] = graphSpecs(graph([{ id: 'r', type: 'indicator', indicator: 'rma', params: { period: 5 } }]));
    expect(spec.supported).toBe(false);
    expect(spec.indicator).toBeNull();
    expect(spec.reason).toContain('rma');
  });

  it('is empty for a graph with no indicator nodes', () => {
    expect(graphSpecs(graph([]))).toEqual([]);
    expect(graphSpecs(null)).toEqual([]);
  });
});

describe('resolveSpecs — indicator runtime', () => {
  it('loads the registry and completes settings with descriptor defaults', async () => {
    await ensureIndicatorRuntime();
    expect(core.hasIndicator('sma')).toBe(true);

    const resolved = await resolveSpecs(
      graphSpecs(graph([{ id: 'f', type: 'indicator', indicator: 'sma', params: { period: 3 } }])),
    );
    expect(resolved[0].supported).toBe(true);
    expect(resolved[0].settings).toMatchObject({ length: 3, source: 'close' });
  });

  it('agrees with the strategy parameters: the graph period drives the registry length', async () => {
    const [spec] = await chartSpecsFor(
      graph([
        { id: 'f', type: 'indicator', indicator: 'sma', params: { period: 3 } },
        { id: 'x', type: 'indicator', indicator: 'rma', params: { period: 5 } },
      ]),
    );
    expect(spec.supported).toBe(true);

    const bars = [10, 20, 30, 40].map(bar);
    const values = core.getIndicator('sma').calc(bars, spec.settings, new Map() as never);
    expect(values.ma.slice(-2)).toEqual([20, 30]);
  });

  it('reports an unknown kind as unsupported rather than attaching nothing silently', async () => {
    const [spec] = await chartSpecsFor(graph([{ id: 'z', type: 'indicator', indicator: 'not_a_real_indicator' }]));
    expect(spec.supported).toBe(false);
    expect(spec.reason).toContain('not_a_real_indicator');
  });
});
