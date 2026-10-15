import { describe, it, expect } from 'vitest';
import { TARGET_CATEGORY_COUNTS } from './loader';

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
});
