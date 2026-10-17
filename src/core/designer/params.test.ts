import { describe, expect, it } from 'vitest';

import { defaultGraph } from './store';
import { coerceParamValue, extractParamFields, groupParamFields, inferTypeName } from './params';
import type { StrategyGraphShape } from '../graph/model';

describe('parameter introspection (Phase 2)', () => {
  it('extracts indicator params with catalogue metadata', () => {
    const fields = extractParamFields(defaultGraph());
    const fastPeriod = fields.find((f) => f.key === 'f.period');
    expect(fastPeriod).toBeDefined();
    expect(fastPeriod?.typeName).toBe('int');
    expect(fastPeriod?.indicator).toBe('sma');
    expect(fastPeriod?.value).toBe(2);
    // `period` appears on both SMA nodes, so the generated name is node-prefixed.
    expect(fastPeriod?.codeName).toBe('f_period');
  });

  it('prefixes the generated parameter name when a param name collides across nodes', () => {
    const graph: StrategyGraphShape = {
      ...defaultGraph(),
      nodes: [
        { id: 'n1', type: 'universe', label: 'Universe' },
        { id: 'x', type: 'indicator', indicator: 'sma', label: 'X', params: { period: 3 } },
        { id: 'y', type: 'indicator', indicator: 'ema', label: 'Y', params: { period: 9 } },
      ],
      edges: [],
    };
    const fields = extractParamFields(graph);
    expect(fields.find((f) => f.key === 'x.period')?.codeName).toBe('x_period');
    expect(fields.find((f) => f.key === 'y.period')?.codeName).toBe('y_period');
  });

  it('infers types for non-indicator nodes and exposes enum options', () => {
    const fields = extractParamFields(defaultGraph());
    const op = fields.find((f) => f.key === 'c.op');
    expect(op?.typeName).toBe('str');
    expect(op?.options).toContain('crosses_above');
    expect(op?.codeName).toBeNull();

    const qty = fields.find((f) => f.key === 'o.quantity');
    expect(qty?.typeName).toBe('int');

    const side = fields.find((f) => f.key === 'o.side');
    expect(side?.options).toEqual(['buy', 'sell']);
  });

  it('hides structural universe params from the tuner', () => {
    const graph: StrategyGraphShape = {
      ...defaultGraph(),
      nodes: [
        { id: 'n1', type: 'universe', label: 'Universe', params: { symbol: 'TCS', exchange: 'NSE' } },
        { id: 'f', type: 'indicator', indicator: 'sma', label: 'Fast', params: { period: 2 } },
      ],
      edges: [],
    };
    const keys = extractParamFields(graph).map((f) => f.key);
    expect(keys).not.toContain('n1.symbol');
    expect(keys).not.toContain('n1.exchange');
    expect(keys).toContain('f.period');
  });

  it('groups fields per node preserving graph order', () => {
    const groups = groupParamFields(extractParamFields(defaultGraph()));
    expect(groups.map((g) => g.nodeId)).toEqual(['f', 's', 'c', 'o']);
    expect(groups[0].fields.map((f) => f.name)).toEqual(['period']);
  });

  it('coerces raw form values back to the declared type', () => {
    expect(coerceParamValue('int', '12')).toBe(12);
    expect(coerceParamValue('int', 12.9)).toBe(12);
    expect(coerceParamValue('float', '2.5')).toBe(2.5);
    expect(coerceParamValue('int', 'not-a-number')).toBe(0);
    expect(coerceParamValue('bool', 'true')).toBe(true);
    expect(coerceParamValue('bool', false)).toBe(false);
    expect(coerceParamValue('str', 7)).toBe('7');
    expect(coerceParamValue('str', null)).toBe('');
  });

  it('infers a type name from a raw value', () => {
    expect(inferTypeName(3)).toBe('int');
    expect(inferTypeName(3.5)).toBe('float');
    expect(inferTypeName(true)).toBe('bool');
    expect(inferTypeName('buy')).toBe('str');
  });
});
