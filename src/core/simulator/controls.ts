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

export type PeriodPreset = '1M' | '3M' | '6M' | '1Y' | 'Custom';

export const PERIOD_PRESETS: ReadonlyArray<PeriodPreset> = ['1M', '3M', '6M', '1Y', 'Custom'];

/** Server spellings, pinned equal to `honba-api`'s `FILL_MODELS`. */
export const FILL_MODELS: ReadonlyArray<string> = ['bar_fill', 'bar_fill_through', 'l2', 'none'];

/** Bar specifications the run contract accepts (`parse_timeframe`). */
export const TIMEFRAMES: ReadonlyArray<string> = ['1m', '5m', '15m', '30m', '1h', '1d'];

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
  const start =
    preset === '1Y'
      ? new Date(Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth(), end.getUTCDate()))
      : minusMonths(end, preset === '1M' ? 1 : preset === '3M' ? 3 : 6);
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
