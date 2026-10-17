import { describe, expect, it } from 'vitest';

import type { LayoutStorage } from '../designer/layout';

import { DEFAULT_CONTROLS } from './controls';
import { SIMULATOR_STORAGE_KEY, loadPersisted, persistSelection } from './persistence';

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

describe('simulator persistence', () => {
  it('round-trips the last selection', () => {
    const storage = fakeStorage();
    const selection = {
      strategyName: 'sma_cross',
      source: 'designer' as const,
      controls: { ...DEFAULT_CONTROLS, symbol: 'TCS', timeframe: '5m' },
    };
    persistSelection(selection, storage);
    expect(loadPersisted(storage)).toEqual(selection);
  });

  it('merges missing control fields with the defaults', () => {
    const storage = fakeStorage();
    storage.data[SIMULATOR_STORAGE_KEY] = JSON.stringify({ strategyName: 'x', source: 'library', controls: { symbol: 'INFY' } });
    const loaded = loadPersisted(storage);
    expect(loaded?.controls.symbol).toBe('INFY');
    expect(loaded?.controls.exchange).toBe(DEFAULT_CONTROLS.exchange);
    expect(loaded?.controls.capital).toBe(DEFAULT_CONTROLS.capital);
  });

  it('tolerates corrupt or absent payloads and missing storage', () => {
    const storage = fakeStorage();
    expect(loadPersisted(storage)).toBeNull();
    expect(loadPersisted(null)).toBeNull();
    storage.data[SIMULATOR_STORAGE_KEY] = '{not json';
    expect(loadPersisted(storage)).toBeNull();
    storage.data[SIMULATOR_STORAGE_KEY] = JSON.stringify({ controls: {} });
    expect(loadPersisted(storage)).toBeNull();
  });
});
