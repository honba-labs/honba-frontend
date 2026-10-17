import { describe, expect, it, vi } from 'vitest';

import type { Bar as DomainBar, BarsResponse } from '../types/generated/domain';

import { hasBarsClient, initialBarsState, loadRunBars, previewFor, type BarsClient } from './bars';

function domainBar(seconds: number, close: number): DomainBar {
  return {
    bar_type: {
      instrument_id: { symbol: 'TCS', exchange: 'NSE' },
      spec: { aggregation: 'day', price_type: 'last', step: 1 },
    },
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    ts_event: { iso: new Date(seconds * 1000).toISOString(), unix_nanos: `${seconds}000000000` },
    ts_init: { iso: new Date(seconds * 1000).toISOString(), unix_nanos: `${seconds}000000000` },
    volume: 5,
  };
}

const REQUEST = { instrumentId: 'TCS.NSE', from: '2024-01-01', to: '2024-02-01', barSpec: '1d' };

function client(response: BarsResponse): BarsClient {
  return { getBarsById: vi.fn(async () => ({ data: response })) };
}

describe('bars state', () => {
  it('starts idle and empty', () => {
    expect(initialBarsState()).toEqual({ status: 'idle', bars: [], source: 'none', note: null, error: null });
  });
});

describe('loadRunBars', () => {
  it('uses the served bars and marks the source as server', async () => {
    const state = await loadRunBars(client({ bars: [domainBar(1_704_067_200, 100)] }), REQUEST);
    expect(state.source).toBe('server');
    expect(state.status).toBe('ready');
    expect(state.note).toBeNull();
    expect(state.bars).toEqual([{ time: 1_704_067_200, open: 100, high: 101, low: 99, close: 100, volume: 5 }]);
  });

  it('falls back to a labelled preview when the store has no bars in the window', async () => {
    const state = await loadRunBars(client({ bars: [] }), REQUEST);
    expect(state.source).toBe('preview');
    expect(state.bars.length).toBeGreaterThan(0);
    expect(state.note).toContain('no 1d bars');
  });

  it('falls back to a labelled preview when the bar store is unreachable, keeping the error', async () => {
    const failing: BarsClient = {
      getBarsById: vi.fn(async () => {
        throw new Error('market_data_unavailable');
      }),
    };
    const state = await loadRunBars(failing, REQUEST);
    expect(state.source).toBe('preview');
    expect(state.bars.length).toBeGreaterThan(0);
    expect(state.error).toContain('market_data_unavailable');
    expect(state.note).toContain('unreachable');
  });

  it('previews without a client at all', async () => {
    const state = await loadRunBars(null, REQUEST);
    expect(state.source).toBe('preview');
    expect(state.note).toContain('Bar API unavailable');
  });

  it('feature-detects the route', () => {
    expect(hasBarsClient({})).toBe(false);
    expect(hasBarsClient(null)).toBe(false);
    expect(hasBarsClient({ getBarsById: () => {} })).toBe(true);
  });
});

describe('previewFor', () => {
  it('covers the requested window with weekday sessions on the bar_spec grid', () => {
    const bars = previewFor({ ...REQUEST, barSpec: '5m' });
    expect(bars.length).toBeGreaterThan(0);
    const from = Math.floor(Date.parse('2024-01-01T00:00:00Z') / 1000);
    const to = Math.floor(Date.parse('2024-02-01T00:00:00Z') / 1000);
    expect(bars.every((bar) => bar.time >= from && bar.time < to)).toBe(true);
  });
});
