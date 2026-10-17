import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CONTROLS,
  MAX_SLIPPAGE_BPS,
  controlIssues,
  minusMonths,
  presetRange,
  resolveRange,
  toBacktestRequest,
  universeFor,
  type SimulatorControls,
} from './controls';

const NOW = new Date('2026-10-17T09:30:00Z');

function controls(patch: Partial<SimulatorControls> = {}): SimulatorControls {
  return { ...DEFAULT_CONTROLS, symbol: 'TCS', ...patch };
}

describe('simulator controls — period presets', () => {
  it('maps each preset to an inclusive start and exclusive end of today', () => {
    expect(presetRange('1M', NOW)).toEqual({ start: '2026-09-17', end: '2026-10-17' });
    expect(presetRange('3M', NOW)).toEqual({ start: '2026-07-17', end: '2026-10-17' });
    expect(presetRange('6M', NOW)).toEqual({ start: '2026-04-17', end: '2026-10-17' });
    expect(presetRange('1Y', NOW)).toEqual({ start: '2025-10-17', end: '2026-10-17' });
    expect(presetRange('2Y', NOW)).toEqual({ start: '2024-10-17', end: '2026-10-17' });
    expect(presetRange('3Y', NOW)).toEqual({ start: '2023-10-17', end: '2026-10-17' });
    expect(presetRange('5Y', NOW)).toEqual({ start: '2021-10-17', end: '2026-10-17' });
    expect(presetRange('YTD', NOW)).toEqual({ start: '2026-01-01', end: '2026-10-17' });
  });

  it('clamps the day when subtracting months (Mar 31 → Feb 28)', () => {
    expect(presetRange('1M', new Date('2026-03-31T00:00:00Z')).start).toBe('2026-02-28');
    expect(minusMonths(new Date('2026-03-31T00:00:00Z'), 1).toISOString().slice(0, 10)).toBe('2026-02-28');
  });

  it('uses the explicit window for a Custom period', () => {
    const range = resolveRange(controls({ period: 'Custom', start: '2024-01-01', end: '2024-06-01' }), NOW);
    expect(range).toEqual({ start: '2024-01-01', end: '2024-06-01' });
  });
});

describe('simulator controls — validation', () => {
  it('flags a missing symbol, bad capital, bad timeframe and bad fill model', () => {
    const issues = controlIssues(
      controls({ symbol: '', capital: 0, timeframe: '5x', fillModel: 'magic' }),
      NOW,
    );
    expect(issues.some((i) => /symbol/i.test(i))).toBe(true);
    expect(issues.some((i) => /capital/i.test(i))).toBe(true);
    expect(issues.some((i) => /timeframe/i.test(i))).toBe(true);
    expect(issues.some((i) => /fill model/i.test(i))).toBe(true);
  });

  it('requires a strictly increasing window for a Custom period', () => {
    expect(controlIssues(controls({ period: 'Custom', start: '2024-06-01', end: '2024-01-01' }), NOW)).toContain(
      'Custom start must be strictly before the end date.',
    );
  });

  it('rejects a commission or slippage the server resolver would refuse', () => {
    const issues = controlIssues(controls({ commission: -1, slippage: MAX_SLIPPAGE_BPS + 1 }), NOW);
    expect(issues.some((i) => /commission/i.test(i))).toBe(true);
    expect(issues.some((i) => /slippage/i.test(i))).toBe(true);
    expect(controlIssues(controls({ commission: Number.NaN }), NOW).some((i) => /commission/i.test(i))).toBe(true);
  });

  it('accepts the default panel', () => {
    expect(controlIssues(controls(), NOW)).toEqual([]);
  });
});

describe('simulator controls — request mapping', () => {
  it('builds the required run fields from the panel', () => {
    const plan = toBacktestRequest(controls({ period: '6M', timeframe: '5m', capital: 250_000 }), {
      strategy: 'sma_cross',
      now: NOW,
    });
    expect(plan.request).toEqual({
      strategy: 'sma_cross',
      universe: 'TCS.NSE',
      start: '2026-04-17',
      end: '2026-10-17',
      bar_spec: '5m',
      fill_model: 'bar_fill',
      initial_capital: 250_000,
      seed: 42,
    });
    expect(plan.range).toEqual({ start: '2026-04-17', end: '2026-10-17' });
    expect(plan.notModelled).toEqual([]);
    expect(plan.issues).toEqual([]);
  });

  it('transmits commission and slippage as the versioned request fields (R5)', () => {
    const plan = toBacktestRequest(controls({ commission: 20, slippage: 5 }), { strategy: 'sma', now: NOW });
    expect(plan.request.commission_per_fill).toBe(20);
    expect(plan.request.slippage_bps).toBe(5);
    expect(plan.notModelled).toEqual([]);
    expect(plan.issues).toEqual([]);
  });

  it('honours an explicit universe and a caller seed', () => {
    const plan = toBacktestRequest(controls(), { strategy: 'sma', universe: 'nifty50', seed: 7, now: NOW });
    expect(plan.request.universe).toBe('nifty50');
    expect(plan.request.seed).toBe(7);
  });

  it('derives an empty universe when no symbol is chosen', () => {
    expect(universeFor(controls({ symbol: '  ' }))).toBe('');
  });
});
