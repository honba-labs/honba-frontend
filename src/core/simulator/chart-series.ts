import * as core from 'openalgo-charts';

import { cataloguelookup } from '../graph/catalogue';
import type { StrategyGraphShape } from '../graph/model';

/**
 * Strategy-graph → chart-indicator bridge (Phase 7, risk R7).
 *
 * The Simulator chart must show *the strategy's* indicators with *the
 * strategy's* parameters, not a generic overlay set — otherwise the chart
 * disagrees with the run it is describing. Every indicator node of the active
 * `StrategyGraphShape` is mapped onto the `openalgo-charts` indicator registry
 * (the same runtime `core/indicators` loads the 502-catalogue into), with the
 * graph's parameter names translated to the registry's input keys.
 *
 * A kind the registry has no descriptor for (today: `rma`, `psar`) is reported
 * with `supported: false` and skipped by the chart rather than silently
 * dropped — the canvas still shows it, the chart says why it cannot.
 */

export interface ChartIndicatorSpec {
  /** Instance key; the node id, so it is stable across edits. */
  key: string;
  nodeId: string;
  /** Graph kind, e.g. `sma`. */
  kind: string;
  /** Registry id to `addIndicator`, or null when the kind is known-unsupported. */
  indicator: string | null;
  label: string;
  /** Full registry settings: descriptor defaults overridden by the graph's params. */
  settings: Record<string, unknown>;
  supported: boolean;
  /** Why it is unsupported, for the UI. */
  reason?: string;
}

/**
 * Graph kind → registry id.
 *
 * `null` means "no descriptor exists"; an unlisted kind falls through to
 * itself, so a graph kind the registry happens to provide works without a
 * table entry.
 */
const REGISTRY_ID: Record<string, string | null> = {
  rma: null,
  psar: null,
  parabolic_sar: null,
};

/**
 * Graph parameter name → registry input key.
 *
 * The graph catalogue names look-back windows `period` (SMA/EMA/RSI) while the
 * registry calls them `length`; MACD is `fast/slow/signal` on both sides but
 * the registry wants `fastPeriod/slowPeriod/signalPeriod`.
 */
const PARAM_ALIAS: Record<string, Record<string, string>> = {
  sma: { period: 'length' },
  ema: { period: 'length' },
  wma: { period: 'length' },
  rsi: { period: 'length' },
  macd: { fast: 'fastPeriod', slow: 'slowPeriod', signal: 'signalPeriod' },
  bollinger: { length: 'length', std: 'stdDev' },
  donchian: { period: 'length' },
  atr: { period: 'period' },
  supertrend: { period: 'period' },
};

const OVERLAY_COLORS = ['#4f8cff', '#f5a623', '#ab47bc', '#26a69a', '#ef5350', '#787b86'];

/** Registry id a graph kind resolves to, or null when the registry has none. */
export function registryIdFor(kind: string): string | null {
  const mapped = REGISTRY_ID[kind];
  return mapped === undefined ? kind : mapped;
}

/** Translate the graph's parameter names to the registry's input keys. */
export function settingsFor(kind: string, params: Record<string, unknown> | undefined): Record<string, unknown> {
  const aliases = PARAM_ALIAS[kind] ?? {};
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'number' && !Number.isFinite(value)) continue;
    if (typeof value !== 'number' && typeof value !== 'string' && typeof value !== 'boolean') continue;
    out[aliases[name] ?? name] = value;
  }
  return out;
}

/** `SMA 3`, `MACD 12/26/9`, `Bollinger 20/2` — the graph's parameters, in catalogue order. */
export function describeKind(kind: string, params: Record<string, unknown> | undefined): string {
  const entry = cataloguelookup(kind);
  const ordered = entry ? entry.params.map((param) => param.name) : Object.keys(params ?? {});
  const values = ordered
    .map((name) => (params?.[name] === undefined ? null : String(params?.[name])))
    .filter((value): value is string => value !== null);
  const base = kind.toUpperCase();
  return values.length > 0 ? `${base} ${values.join('/')}` : base;
}

function indicatorNodes(graph: StrategyGraphShape | null | undefined) {
  return (graph?.nodes ?? []).filter((node) => node.type === 'indicator' || typeof node.indicator === 'string');
}

/**
 * Graph indicator nodes → chart specs (pure; `supported` is filled in by
 * {@link resolveSpecs} once the indicator registry is loaded).
 *
 * Overlay colours are cycled by node order so two SMAs of different periods are
 * tellable apart on the price pane.
 */
export function graphSpecs(graph: StrategyGraphShape | null | undefined): ChartIndicatorSpec[] {
  const nodes = indicatorNodes(graph);
  const overlayIndex = new Map<string, number>();

  return nodes.map((node) => {
    const kind = node.indicator ?? '';
    const params = node.params ?? {};
    const registryId = kind ? registryIdFor(kind) : null;
    const settings = settingsFor(kind, params);
    const slot = overlayIndex.get(kind) ?? 0;
    overlayIndex.set(kind, slot + 1);
    const color = OVERLAY_COLORS[slot % OVERLAY_COLORS.length];
    if (registryId === 'bollinger' || registryId === 'donchian') {
      settings.basisColor = color;
      settings.bandColor = color;
    } else {
      settings.color = color;
    }
    return {
      key: node.id,
      nodeId: node.id,
      kind,
      indicator: registryId,
      label: node.label && node.label.trim().length > 0 ? node.label.trim() : describeKind(kind, params),
      settings,
      supported: registryId !== null,
      ...(registryId === null ? { reason: `no chart indicator registered for '${kind}'` } : {}),
    };
  });
}

let runtime: Promise<void> | null = null;

/**
 * Load the `openalgo-charts` indicator tier once.
 *
 * Built-in descriptors (`sma`, `rsi`, `macd`, …) live in the lazy
 * `openalgo-charts/indicators` chunk; the registry is empty until it is
 * imported, so anything that computes or attaches indicators awaits this.
 */
export function ensureIndicatorRuntime(): Promise<void> {
  if (!runtime) {
    runtime = import('openalgo-charts/indicators').then(() => undefined);
  }
  return runtime;
}

/**
 * Validate specs against the loaded registry and complete their settings with
 * the descriptor's own defaults.
 */
export async function resolveSpecs(specs: readonly ChartIndicatorSpec[]): Promise<ChartIndicatorSpec[]> {
  await ensureIndicatorRuntime();
  return specs.map((spec) => {
    if (!spec.indicator) return spec;
    if (!core.hasIndicator(spec.indicator)) {
      return { ...spec, supported: false, reason: `no chart indicator registered for '${spec.kind}'` };
    }
    const descriptor = core.getIndicator(spec.indicator);
    return { ...spec, settings: { ...core.indicatorDefaults(descriptor), ...spec.settings } };
  });
}

/** Specs the chart can actually draw, in graph order. */
export function drawableSpecs(specs: readonly ChartIndicatorSpec[]): ChartIndicatorSpec[] {
  return specs.filter((spec) => spec.supported && spec.indicator !== null);
}

/** One-shot helper: graph → validated specs. */
export async function chartSpecsFor(graph: StrategyGraphShape | null | undefined): Promise<ChartIndicatorSpec[]> {
  return resolveSpecs(graphSpecs(graph));
}
