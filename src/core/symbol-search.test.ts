import { describe, it, expect } from 'vitest';
import {
  getAvailableSymbolPoolSize,
  searchInstruments,
  resolveSymbolMetadata,
  resolveSymbolPrice,
} from './symbol-search';
import { defaultHonbaFeed } from './workbench/openalgo-feed';

describe('Chart Symbol Pool & Search', () => {
  it('exposes the full available symbol pool (>3,700 symbols) across all categories', () => {
    const total = getAvailableSymbolPoolSize('ALL');
    expect(total).toBeGreaterThan(3700);
    expect(getAvailableSymbolPoolSize('Index')).toBeGreaterThanOrEqual(29);
    expect(getAvailableSymbolPoolSize('Cash')).toBeGreaterThan(3500);
    expect(getAvailableSymbolPoolSize('F&O')).toBeGreaterThanOrEqual(25);
    expect(getAvailableSymbolPoolSize('Commodity')).toBeGreaterThanOrEqual(10);
    expect(getAvailableSymbolPoolSize('Crypto')).toBeGreaterThanOrEqual(10);
  });

  it('finds bhavcopy, ETF, SME, Bond, Index, and DuckDB symbols beyond the old 304 list', () => {
    // Symbols from NSE bhavcopy & DuckDB that were not in the hardcoded 304 list
    const suzlon = searchInstruments('SUZLON', 'ALL', 100);
    expect(suzlon.some((r) => r.symbol === 'SUZLON')).toBe(true);

    const ireda = searchInstruments('IREDA', 'ALL', 100);
    expect(ireda.some((r) => r.symbol === 'IREDA')).toBe(true);

    const alphaEtf = searchInstruments('ALPHAETF', 'ALL', 100);
    expect(alphaEtf.some((r) => r.symbol === 'ALPHAETF')).toBe(true);

    const cnxAuto = searchInstruments('CNXAUTO', 'Index', 100);
    expect(cnxAuto.some((r) => r.symbol === 'CNXAUTO' && r.category === 'Index')).toBe(true);

    // Search by multi-token company name
    const dock = searchInstruments('DOCK SHIPBUILDERS', 'ALL', 50);
    expect(dock.some((r) => r.symbol === 'MAZDOCK')).toBe(true);
  });

  it('returns the full unfiltered pool when limit is large rather than truncating at 60', () => {
    const allResults = searchInstruments('', 'ALL', 5000);
    expect(allResults.length).toBeGreaterThan(3700);
  });

  it('resolves real bhavcopy prices and metadata for pool symbols', () => {
    const meta = resolveSymbolMetadata('MAZDOCK');
    expect(meta.symbol).toBe('MAZDOCK');
    expect(meta.isCustom).toBeFalsy();
    expect(resolveSymbolPrice('MAZDOCK')).toBeGreaterThan(0);
  });

  it('maps SymbolMatch fields (name and assetClass) for OpenAlgo DataFeed.searchSymbols', async () => {
    const matches = await defaultHonbaFeed.searchSymbols({ query: 'TATA' });
    expect(matches.length).toBeGreaterThan(15);
    expect(matches[0]).toHaveProperty('symbol');
    expect(matches[0]).toHaveProperty('name');
    expect(matches[0]).toHaveProperty('exchange');
    expect(matches[0]).toHaveProperty('assetClass');
  });
});
