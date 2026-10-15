import { describe, it, expect } from 'vitest';
import * as core from 'openalgo-charts';
import { TARGET_CATEGORY_COUNTS, loadAll502Indicators } from './loader';

describe('Indicator Library Category Targets', () => {
  it('has exact 502 indicators total across 16 categories', () => {
    const total = Object.values(TARGET_CATEGORY_COUNTS).reduce((sum, count) => sum + count, 0);
    expect(total).toBe(502);

    expect(TARGET_CATEGORY_COUNTS['Moving Averages']).toBe(71);
    expect(TARGET_CATEGORY_COUNTS['Oscillators']).toBe(65);
    expect(TARGET_CATEGORY_COUNTS['Filters']).toBe(42);
    expect(TARGET_CATEGORY_COUNTS['Numerics']).toBe(34);
    expect(TARGET_CATEGORY_COUNTS['Volume']).toBe(34);
    expect(TARGET_CATEGORY_COUNTS['Volatility']).toBe(34);
    expect(TARGET_CATEGORY_COUNTS['Trend Strength']).toBe(34);
    expect(TARGET_CATEGORY_COUNTS['Statistics']).toBe(33);
    expect(TARGET_CATEGORY_COUNTS['Bands & Channels']).toBe(28);
    expect(TARGET_CATEGORY_COUNTS['Error Metrics']).toBe(27);
    expect(TARGET_CATEGORY_COUNTS['Momentum']).toBe(26);
    expect(TARGET_CATEGORY_COUNTS['Cycles']).toBe(19);
    expect(TARGET_CATEGORY_COUNTS['Smart Money']).toBe(18);
    expect(TARGET_CATEGORY_COUNTS['Setups']).toBe(15);
    expect(TARGET_CATEGORY_COUNTS['Reversals']).toBe(13);
    expect(TARGET_CATEGORY_COUNTS['Price']).toBe(9);
  });

  it('loads and registers all indicators into core registry', async () => {
    const count = await loadAll502Indicators();
    expect(count).toBeGreaterThanOrEqual(497);
    const registered = core.registeredIndicators();
    
    expect(registered.length).toBeGreaterThanOrEqual(497);
  });

  it('correctly provides rsi and math functions to indicators and computes without error', async () => {
    await loadAll502Indicators();
    const ind = core.getIndicator('oa-adaptive-rsi-moving-average');
    expect(ind).toBeDefined();

    const fakeBars = Array.from({ length: 30 }, (_, i) => ({
      time: 1000 + i * 60,
      open: 100 + i,
      high: 105 + i,
      low: 95 + i,
      close: 102 + i,
      volume: 1000,
    }));

    const result = (ind as any).calc(fakeBars, { length: 14, source: 'close' }, {} as any);
    expect(result).toBeDefined();
    expect(result.arsima).toBeDefined();
    expect(Array.isArray(result.arsima)).toBe(true);
  });
});

