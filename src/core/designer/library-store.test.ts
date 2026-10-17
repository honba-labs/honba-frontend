import { describe, expect, it } from 'vitest';

import type { StrategyGraphShape } from '../graph/model';
import { defaultGraph } from './store';
import { STRATEGY_TEMPLATES } from './strategy-templates';
import { graphIssues } from '../graph/validation';
import { generateCode } from '../graph/codegen';
import { canonicalJson, graphHashSync } from '../graph/model';
import { recognizeGeneratedSource } from './code-to-graph';
import {
  filterLibrary,
  loadSaved,
  mergeLibrary,
  persistSaved,
  presentCategories,
  removeSaved,
  slugify,
  toSavedManifest,
  uniqueId,
  upsertSaved,
} from './library-store';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

function manifestFor(graph: StrategyGraphShape) {
  return toSavedManifest(graph, generateCode(graph, graphHashSync(graph)));
}

describe('built-in strategy templates (Phase 5)', () => {
  it('are unique and structurally valid', () => {
    const ids = STRATEGY_TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const template of STRATEGY_TEMPLATES) {
      expect(graphIssues(template.graph), `${template.id} should validate`).toEqual([]);
    }
  });

  it('round-trip through the Phase 3 recogniser (generated subset)', () => {
    for (const template of STRATEGY_TEMPLATES) {
      const source = generateCode(template.graph, graphHashSync(template.graph));
      const recognised = recognizeGeneratedSource(source);
      expect(recognised.graph, `${template.id} should be recognised`).not.toBeNull();
      expect(canonicalJson(recognised.graph as StrategyGraphShape)).toBe(canonicalJson(template.graph));
    }
  });
});

describe('library-store manifest & persistence (Phase 5)', () => {
  it('slugifies names into ids', () => {
    expect(slugify('SMA Cross v2!')).toBe('sma_cross_v2');
    expect(slugify('   ')).toBe('strategy');
  });

  it('uniqueId suffixes when the base is taken', () => {
    expect(uniqueId('sma_cross', [])).toBe('sma_cross');
    expect(uniqueId('sma_cross', ['sma_cross'])).toBe('sma_cross_2');
    expect(uniqueId('sma_cross', ['sma_cross', 'sma_cross_2'])).toBe('sma_cross_3');
  });

  it('builds a §5.5 manifest from a graph and its source', () => {
    const graph = defaultGraph();
    const manifest = manifestFor(graph);
    expect(manifest.id).toBe('sma_cross');
    expect(manifest.category).toBe('custom');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.default_universe).toEqual({ symbol: 'TCS', exchange: 'NSE', timeframe: '1m' });
    // period appears on two nodes, so the generated names are disambiguated.
    expect(manifest.default_params).toEqual({ f_period: 2, s_period: 4 });
    expect(manifest.python_source).toContain('class SmaCross');
  });

  it('upserts and removes by id without mutating the input', () => {
    const a = manifestFor(defaultGraph());
    const b = { ...a, id: 'other' };
    const list = upsertSaved([a], b);
    expect(list.map((entry) => entry.id)).toEqual(['sma_cross', 'other']);
    const updated = upsertSaved(list, { ...a, version: '2.0.0' });
    expect(updated.find((entry) => entry.id === 'sma_cross')?.version).toBe('2.0.0');
    expect(updated).toHaveLength(2);
    expect(removeSaved(updated, 'other').map((entry) => entry.id)).toEqual(['sma_cross']);
  });

  it('persists and reloads through storage', () => {
    const storage = memoryStorage();
    const list = [manifestFor(defaultGraph())];
    persistSaved(list, storage);
    expect(loadSaved(storage).map((entry) => entry.id)).toEqual(['sma_cross']);
  });

  it('tolerates corrupt storage', () => {
    const storage = memoryStorage();
    storage.setItem('honba.algodesigner.library', '{not json');
    expect(loadSaved(storage)).toEqual([]);
  });
});

describe('library merge & filter (Phase 5)', () => {
  const templates = STRATEGY_TEMPLATES;
  const saved = [{ ...manifestFor({ ...defaultGraph(), name: 'my_custom' }), category: 'custom' as const }];

  it('merges built-ins then custom strategies', () => {
    const entries = mergeLibrary(templates, saved);
    expect(entries.filter((entry) => entry.source === 'builtin')).toHaveLength(templates.length);
    expect(entries.filter((entry) => entry.source === 'custom')).toHaveLength(1);
  });

  it('filters by query across name, description and tags', () => {
    const entries = mergeLibrary(templates, saved);
    expect(filterLibrary(entries, { query: 'rsi' }).map((entry) => entry.id)).toContain('rsi_mean_reversion');
    expect(filterLibrary(entries, { query: 'breakout' }).map((entry) => entry.id)).toContain('donchian_breakout');
    expect(filterLibrary(entries, { query: 'nope' })).toEqual([]);
  });

  it('filters by category', () => {
    const entries = mergeLibrary(templates, saved);
    const meanReversion = filterLibrary(entries, { category: 'mean_reversion' });
    expect(meanReversion.every((entry) => entry.category === 'mean_reversion')).toBe(true);
    expect(meanReversion.length).toBeGreaterThan(0);
  });

  it('reports only the categories present', () => {
    const entries = mergeLibrary(templates, saved);
    const categories = presentCategories(entries);
    expect(categories).toContain('momentum/trend');
    expect(categories).toContain('custom');
  });
});
