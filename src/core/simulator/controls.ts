import type { BacktestRequest } from '../types/generated/domain';

/**
 * Simulator control model (Phase 6).
 *
 * Pure, dependency-free mapping from the control panel to the run contract. The
 * rules are pinned to the Rust resolver in `crates/honba-api/src/run_resolve.rs`:
 * `strategy`, `universe`, `start`, `end` and a non-zero `seed` are **required**;
 * dates are `YYYY-MM-DD`; `bar_spec` is `<n><s|m|h|d|w|mo>`; `fill_model` is one
 * of the four server spellings. `commission_per_fill` and `slippage_bps` are
 * transmitted directly (Phase 6 contract gap closed); the request denies unknown
 * fields, so any control without a wire field is surfaced in `notModelled`, never
 * fabricated (risk R5).
 */

export type PeriodPreset = '1M' | '3M' | '6M' | '1Y' | '2Y' | '3Y' | '5Y' | 'YTD' | 'Custom';

export const PERIOD_PRESETS: ReadonlyArray<PeriodPreset> = ['1M', '3M', '6M', '1Y', '2Y', '3Y', '5Y', 'YTD', 'Custom'];

/** Server spellings, pinned equal to `honba-api`'s `FILL_MODELS`. */
export const FILL_MODELS: ReadonlyArray<string> = ['bar_fill', 'bar_fill_through', 'l2', 'none'];

export interface FillModelDescriptor {
  id: string;
  name: string;
  label: string;
  description: string;
  badge: string;
}

export const FILL_MODEL_DESCRIPTORS: Record<string, FillModelDescriptor> = {
  bar_fill: {
    id: 'bar_fill',
    name: 'Bar Fill (Close / Market)',
    label: 'Bar Fill',
    description: 'Fills immediately at bar close / current tick. Standard execution baseline.',
    badge: 'Standard',
  },
  bar_fill_through: {
    id: 'bar_fill_through',
    name: 'Bar Fill Through (Limit / Penetration)',
    label: 'Bar Fill Through',
    description: 'Strict limit execution: requires intra-bar price to trade strictly through the limit level.',
    badge: 'Realistic',
  },
  l2: {
    id: 'l2',
    name: 'L2 Order Book Simulation',
    label: 'L2 Simulation',
    description: 'Simulates micro-ticks with adverse bid/ask spread and order-size depth slippage.',
    badge: 'High Fidelity',
  },
  none: {
    id: 'none',
    name: 'None (Signals Only / Paperless)',
    label: 'Signals Only',
    description: 'Evaluates all indicators and confluence signals without executing trades or fills.',
    badge: 'Signal Test',
  },
};

export function formatFillModel(model: string): string {
  return FILL_MODEL_DESCRIPTORS[model]?.name ?? model;
}

/** Bar specifications the run contract accepts (`parse_timeframe`). */
export const TIMEFRAMES: ReadonlyArray<string> = [
  '1m',
  '2m',
  '3m',
  '5m',
  '10m',
  '15m',
  '30m',
  '45m',
  '1h',
  '2h',
  '3h',
  '4h',
  '1d',
  '1w',
  '1mo',
];

export function formatTimeframe(tf: string): string {
  switch (tf) {
    case '1m': return '1m (1 Min)';
    case '2m': return '2m (2 Mins)';
    case '3m': return '3m (3 Mins)';
    case '5m': return '5m (5 Mins)';
    case '10m': return '10m (10 Mins)';
    case '15m': return '15m (15 Mins)';
    case '30m': return '30m (30 Mins)';
    case '45m': return '45m (45 Mins)';
    case '1h': return '1h (1 Hour)';
    case '2h': return '2h (2 Hours)';
    case '3h': return '3h (3 Hours)';
    case '4h': return '4h (4 Hours)';
    case '1d': return '1d (Daily)';
    case '1w': return '1w (Weekly)';
    case '1mo': return '1mo (Monthly)';
    default: return tf;
  }
}

export const DEFAULT_BENCHMARK = 'NIFTY 50';
export const DEFAULT_CAPITAL = 100_000;
export const DEFAULT_SEED = 42;
export const DEFAULT_FILL_MODEL = 'bar_fill';
/** `DEFAULT_BAR_SPEC` in `honba-api`. */
export const DEFAULT_TIMEFRAME = '1d';
/** `MAX_COMMISSION_PER_FILL` in `honba-api` (flat cost per fill). */
export const MAX_COMMISSION_PER_FILL = 1e9;
/** `MAX_SLIPPAGE_BPS` in `honba-api`. */
export const MAX_SLIPPAGE_BPS = 10_000;

export interface SimulatorControls {
  symbol: string;
  exchange: string;
  benchmark: string;
  period: PeriodPreset;
  /** Bar specification, e.g. `5m`. */
  timeframe: string;
  capital: number;
  /** Flat commission charged per fill, in the quote currency (`commission_per_fill`). */
  commission: number;
  /** Slippage applied to every fill, in basis points and adverse to the side (`slippage_bps`). */
  slippage: number;
  fillModel: string;
  /** Inclusive window, used only when `period === 'Custom'`. */
  start: string | null;
  /** Exclusive window, used only when `period === 'Custom'`. */
  end: string | null;
}

export const DEFAULT_CONTROLS: SimulatorControls = {
  symbol: '',
  exchange: 'NSE',
  benchmark: DEFAULT_BENCHMARK,
  period: '6M',
  timeframe: '5m',
  capital: DEFAULT_CAPITAL,
  commission: 0,
  slippage: 0,
  fillModel: DEFAULT_FILL_MODEL,
  start: null,
  end: null,
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BAR_SPEC_RE = /^\d+(s|m|h|d|w|mo)$/;

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Subtract whole months, clamping the day to the target month's length (Jan 31 → Feb 28). */
export function minusMonths(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}

/** Window for a fixed preset, relative to `now` (inclusive start, exclusive end = today). */
export function presetRange(preset: Exclude<PeriodPreset, 'Custom'>, now: Date): { start: string; end: string } {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let start: Date;
  if (preset === '1Y') {
    start = new Date(Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth(), end.getUTCDate()));
  } else if (preset === '2Y') {
    start = new Date(Date.UTC(end.getUTCFullYear() - 2, end.getUTCMonth(), end.getUTCDate()));
  } else if (preset === '3Y') {
    start = new Date(Date.UTC(end.getUTCFullYear() - 3, end.getUTCMonth(), end.getUTCDate()));
  } else if (preset === '5Y') {
    start = new Date(Date.UTC(end.getUTCFullYear() - 5, end.getUTCMonth(), end.getUTCDate()));
  } else if (preset === 'YTD') {
    start = new Date(Date.UTC(end.getUTCFullYear(), 0, 1));
  } else {
    start = minusMonths(end, preset === '1M' ? 1 : preset === '3M' ? 3 : 6);
  }
  return { start: isoDate(start), end: isoDate(end) };
}

/** Resolve the effective window for the current control state. */
export function resolveRange(controls: SimulatorControls, now: Date = new Date()): { start: string; end: string } {
  if (controls.period === 'Custom') {
    return { start: controls.start ?? '', end: controls.end ?? '' };
  }
  return presetRange(controls.period, now);
}

/** The universe string the run contract expects: a named universe or `SYMBOL.EXCHANGE` list. */
export function universeFor(controls: SimulatorControls): string {
  const symbol = controls.symbol.trim().toUpperCase();
  if (!symbol) return '';
  return `${symbol}.${controls.exchange.trim().toUpperCase()}`;
}

function requiredString(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** A non-negative, finite rate within `0..=max`, or a readable complaint. */
function rateIssue(label: string, value: number, max: number): string | null {
  if (!Number.isFinite(value) || value < 0 || value > max) {
    return `${label} must be a number between 0 and ${max}.`;
  }
  return null;
}

/** Human-readable control problems; empty means the run request can be built. */
export function controlIssues(controls: SimulatorControls, now: Date = new Date()): string[] {
  const issues: string[] = [];
  if (!requiredString(controls.symbol)) issues.push('Choose a symbol to simulate.');
  if (!(Number.isFinite(controls.capital) && controls.capital > 0)) {
    issues.push('Initial capital must be a positive number.');
  }
  if (!BAR_SPEC_RE.test(controls.timeframe.trim())) {
    issues.push(`Timeframe must look like 5m or 1d (got ${JSON.stringify(controls.timeframe)}).`);
  }
  if (!FILL_MODELS.includes(controls.fillModel)) {
    issues.push(`Unknown fill model ${JSON.stringify(controls.fillModel)}.`);
  }
  const commission = rateIssue('Commission', controls.commission, MAX_COMMISSION_PER_FILL);
  if (commission) issues.push(commission);
  const slippage = rateIssue('Slippage', controls.slippage, MAX_SLIPPAGE_BPS);
  if (slippage) issues.push(slippage);
  if (controls.period === 'Custom') {
    const { start, end } = resolveRange(controls, now);
    if (!DATE_RE.test(start) || !DATE_RE.test(end)) {
      issues.push('Custom period needs both a start and an end date (YYYY-MM-DD).');
    } else if (start >= end) {
      issues.push('Custom start must be strictly before the end date.');
    }
  }
  return issues;
}

export interface SimulationRequestOptions {
  /** Strategy name or manifest id, as returned by `POST /strategies`. */
  strategy: string;
  /** Overrides the symbol-derived universe. */
  universe?: string;
  seed?: number;
  now?: Date;
}

export interface SimulationRequestPlan {
  request: BacktestRequest;
  range: { start: string; end: string };
  /** Controls with no wire field, deliberately not transmitted (R5). Empty while commission/slippage are carried. */
  notModelled: string[];
  /** Non-empty when the panel is incomplete; `request` is then best-effort. */
  issues: string[];
}

/**
 * Map the control panel to a `BacktestRequest`. Commission and slippage are
 * transmitted as `commission_per_fill` (flat cost per fill) and `slippage_bps`
 * (adverse, in basis points), the fields `honba-api` resolves in Phase 6; any
 * control with no wire field is reported in `notModelled`, never fabricated
 * (§8.2, risk R5).
 */
export function toBacktestRequest(
  controls: SimulatorControls,
  options: SimulationRequestOptions,
): SimulationRequestPlan {
  const now = options.now ?? new Date();
  const range = resolveRange(controls, now);

  const request: BacktestRequest = {
    strategy: options.strategy,
    universe: options.universe ?? universeFor(controls),
    start: range.start || null,
    end: range.end || null,
    bar_spec: controls.timeframe.trim() || null,
    fill_model: controls.fillModel || null,
    initial_capital: controls.capital,
    seed: options.seed ?? DEFAULT_SEED,
    commission_per_fill: controls.commission > 0 ? controls.commission : undefined,
    slippage_bps: controls.slippage > 0 ? controls.slippage : undefined,
  };

  return { request, range, notModelled: [], issues: controlIssues(controls, now) };
}
