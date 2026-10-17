import type { StrategyGraphShape } from '../graph/model';
import { pythonParams } from '../graph/codegen';
import { defaultLayoutStorage, type LayoutStorage } from './layout';

/**
 * Strategy & indicator library model (Phase 5, HBD-2026-DES-004).
 *
 * A pure, dependency-light module (no store imports, so it can be imported by
 * both the zustand slice and the React drawer without a cycle) that:
 * - defines the saved-strategy manifest (§5.5) used for persistence,
 * - merges the built-in template catalogue with the user's saved strategies,
 * - searches/filters, and
 * - persists the user's strategies to `localStorage` (best-effort, like the
 *   layout slice).
 *
 * Cross-device persistence goes through the profile API from the store; this
 * module stays free of the network so it is unit testable in node.
 */

export const LIBRARY_STORAGE_KEY = 'honba.algodesigner.library';

export type StrategyCategory =
  | 'momentum/trend'
  | 'momentum/breakout'
  | 'mean_reversion'
  | 'volatility'
  | 'options'
  | 'custom';

export const STRATEGY_CATEGORIES: readonly StrategyCategory[] = [
  'momentum/trend',
  'momentum/breakout',
  'mean_reversion',
  'volatility',
  'options',
  'custom',
] as const;

/** §5.5 — compatible with the `honba-strategies` manifest shape. */
export interface SavedStrategyManifest {
  /** Slug, e.g. 'sma_crossover'. */
  id: string;
  name: string;
  /** Semver, e.g. '1.2.0'. */
  version: string;
  category: StrategyCategory;
  description: string;
  tags: string[];
  author: string;
  updated_at: number;
  python_source: string;
  graph: StrategyGraphShape;
  default_universe: { symbol: string; exchange: string; timeframe: string };
  default_params: Record<string, unknown>;
  backtest_benchmark?: { sharpe_ratio: number; max_drawdown_pct: number; win_rate: number };
}

/** A read-only built-in strategy shipped with the Designer. */
export interface StrategyTemplate {
  id: string;
  name: string;
  category: StrategyCategory;
  description: string;
  tags: string[];
  graph: StrategyGraphShape;
}

export interface LibraryEntry {
  id: string;
  name: string;
  category: StrategyCategory;
  description: string;
  tags: string[];
  source: 'builtin' | 'custom';
  graph: StrategyGraphShape;
  manifest?: SavedStrategyManifest;
}

export function slugify(text: string): string {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || 'strategy';
}

function timeframeLabel(graph: StrategyGraphShape): string {
  const { interval, aggregation } = graph.driving_timeframe;
  const unit = aggregation.slice(0, 1);
  return `${interval}${unit}`;
}

export function defaultUniverse(graph: StrategyGraphShape): SavedStrategyManifest['default_universe'] {
  const first = graph.universe.explicit?.[0];
  return {
    symbol: first?.symbol ?? graph.universe.named ?? '',
    exchange: first?.exchange ?? '',
    timeframe: timeframeLabel(graph),
  };
}

export function defaultParams(graph: StrategyGraphShape): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const param of pythonParams(graph)) out[param.name] = param.defaultValue;
  return out;
}

/** Build a saveable manifest from the current graph and its generated source. */
export function toSavedManifest(
  graph: StrategyGraphShape,
  code: string,
  meta: Partial<Pick<SavedStrategyManifest, 'id' | 'version' | 'category' | 'description' | 'tags' | 'author'>> = {},
): SavedStrategyManifest {
  return {
    id: meta.id ?? slugify(graph.name),
    name: graph.name,
    version: meta.version ?? '1.0.0',
    category: meta.category ?? 'custom',
    description: meta.description ?? '',
    tags: meta.tags ?? [],
    author: meta.author ?? 'local',
    updated_at: Date.now(),
    python_source: code,
    graph,
    default_universe: defaultUniverse(graph),
    default_params: defaultParams(graph),
  };
}

/** A unique id derived from `base`, suffixed `_2`, `_3`, … when already taken. */
export function uniqueId(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const root = slugify(base);
  if (!used.has(root)) return root;
  let counter = 2;
  while (used.has(`${root}_${counter}`)) counter += 1;
  return `${root}_${counter}`;
}

export function upsertSaved(list: ReadonlyArray<SavedStrategyManifest>, manifest: SavedStrategyManifest): SavedStrategyManifest[] {
  const index = list.findIndex((entry) => entry.id === manifest.id);
  if (index === -1) return [...list, manifest];
  const next = [...list];
  next[index] = manifest;
  return next;
}

export function removeSaved(list: ReadonlyArray<SavedStrategyManifest>, id: string): SavedStrategyManifest[] {
  return list.filter((entry) => entry.id !== id);
}

export function loadSaved(storage: LayoutStorage | null = defaultLayoutStorage()): SavedStrategyManifest[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(LIBRARY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is SavedStrategyManifest => !!entry && typeof (entry as SavedStrategyManifest).id === 'string');
  } catch {
    return [];
  }
}

export function persistSaved(
  list: ReadonlyArray<SavedStrategyManifest>,
  storage: LayoutStorage | null = defaultLayoutStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* persistence is best-effort */
  }
}

/** Merge the built-in templates with the user's saved strategies. */
export function mergeLibrary(
  templates: ReadonlyArray<StrategyTemplate>,
  saved: ReadonlyArray<SavedStrategyManifest>,
): LibraryEntry[] {
  const builtins: LibraryEntry[] = templates.map((template) => ({
    id: template.id,
    name: template.name,
    category: template.category,
    description: template.description,
    tags: template.tags,
    source: 'builtin',
    graph: template.graph,
  }));
  const custom: LibraryEntry[] = saved.map((manifest) => ({
    id: manifest.id,
    name: manifest.name,
    category: manifest.category,
    description: manifest.description,
    tags: manifest.tags,
    source: 'custom',
    graph: manifest.graph,
    manifest,
  }));
  return [...builtins, ...custom];
}

export interface LibraryFilter {
  query?: string;
  category?: StrategyCategory | 'all';
}

export function filterLibrary(entries: ReadonlyArray<LibraryEntry>, filter: LibraryFilter = {}): LibraryEntry[] {
  const term = (filter.query ?? '').trim().toLowerCase();
  const category = filter.category ?? 'all';
  return entries.filter((entry) => {
    if (category !== 'all' && entry.category !== category) return false;
    if (!term) return true;
    return (
      entry.name.toLowerCase().includes(term) ||
      entry.id.toLowerCase().includes(term) ||
      entry.description.toLowerCase().includes(term) ||
      entry.tags.some((tag) => tag.toLowerCase().includes(term))
    );
  });
}

/** Categories actually present in a set of entries, for the filter bar. */
export function presentCategories(entries: ReadonlyArray<LibraryEntry>): StrategyCategory[] {
  const seen = new Set<StrategyCategory>();
  for (const entry of entries) seen.add(entry.category);
  return STRATEGY_CATEGORIES.filter((category) => seen.has(category));
}
