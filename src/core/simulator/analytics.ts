import type { BacktestMetrics } from '../types/generated/domain';

import { IST_OFFSET_SECONDS } from './chart-data';
import type { RoundTrip, RoundTripExitReason } from './trade-pairing';

/**
 * Run analytics (Phase 8).
 *
 * Turns a completed run into the numbers the analytics surface shows. The run
 * payload (`BacktestMetrics`) carries only five fields — `total_return`,
 * `sharpe`, `max_drawdown`, `net_pnl`, `trades` — so everything else is either
 * **derived** deterministically from those plus the journal round trips
 * (`trade-pairing.ts`) and the run window, or reported **unavailable**. Nothing
 * here invents a value the wire did not supply (risk R5): every ribbon metric
 * carries its provenance and, when derived, the rule that produced it.
 *
 * The journal is fills, so "returns" are realised round-trip returns, not a
 * mark-to-market curve. That is why Sharpe (a periodic statistic) comes from the
 * payload while win rate, profit factor and exposure are computed from trades,
 * and why Sortino — which needs a *periodic* return series — is unavailable.
 */

export type MetricKind = 'percent' | 'drawdown' | 'ratio' | 'count' | 'currency';

export type MetricProvenance = 'wire' | 'derived' | 'unavailable';

export interface RibbonMetric {
  key: string;
  label: string;
  /** `null` when the metric cannot be computed (provenance `unavailable`). */
  value: number | null;
  kind: MetricKind;
  provenance: MetricProvenance;
  /** How the value was obtained, or why it is unavailable. */
  note: string;
}

export interface AnalyticsInput {
  metrics: BacktestMetrics | null | undefined;
  trips: readonly RoundTrip[];
  /** Run window, `YYYY-MM-DD` (inclusive start, exclusive end), when known. */
  window?: { start: string; end: string } | null;
  initialCapital?: number | null;
}

const MS_PER_DAY = 86_400;
const DAYS_PER_YEAR = 365.25;

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** `num / den`, or `null` when the ratio is undefined (zero/absent denominator). */
export function safeRatio(num: number | null | undefined, den: number | null | undefined): number | null {
  if (!finite(num) || !finite(den) || den === 0) return null;
  const ratio = num / den;
  return Number.isFinite(ratio) ? ratio : null;
}

function secondsOfDate(date: string | null | undefined): number | null {
  if (typeof date !== 'string' || date.length === 0) return null;
  const ms = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

/** Whole years between two `YYYY-MM-DD` dates (inclusive start, exclusive end). */
export function yearsBetween(start: string | null | undefined, end: string | null | undefined): number | null {
  const from = secondsOfDate(start);
  const to = secondsOfDate(end);
  if (from === null || to === null || to <= from) return null;
  return (to - from) / MS_PER_DAY / DAYS_PER_YEAR;
}

/**
 * CAGR from a period total return: `(1 + r)^(1/years) − 1`.
 *
 * A total return of `−100%` or worse is fully destroyed capital, reported as
 * `−1`; a non-positive window has no annualisation and yields `null`.
 */
export function annualisedReturn(totalReturn: number | null | undefined, years: number | null): number | null {
  if (!finite(totalReturn)) return null;
  if (totalReturn <= -1) return -1;
  if (years === null || years <= 0) return null;
  const cagr = (1 + totalReturn) ** (1 / years) - 1;
  return Number.isFinite(cagr) ? cagr : null;
}

export interface RoundTripStats {
  /** Round trips that have realised at least part of their position. */
  closed: number;
  /** Round trips still holding inventory at the run's end. */
  open: number;
  wins: number;
  losses: number;
  breakeven: number;
  grossProfit: number;
  grossLoss: number;
  /** Sum of realised PnL over closed trips. */
  realizedPnl: number;
  winRate: number | null;
  profitFactor: number | null;
  avgWin: number | null;
  avgLoss: number | null;
}

/** Trade-level statistics over the *derived* round trips (journal). */
export function roundTripStats(trips: readonly RoundTrip[]): RoundTripStats {
  let wins = 0;
  let losses = 0;
  let breakeven = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let realizedPnl = 0;
  let open = 0;

  for (const trip of trips) {
    if (trip.realizedPnl === null) {
      open += 1;
      continue;
    }
    realizedPnl += trip.realizedPnl;
    if (trip.realizedPnl > 0) {
      wins += 1;
      grossProfit += trip.realizedPnl;
    } else if (trip.realizedPnl < 0) {
      losses += 1;
      grossLoss += -trip.realizedPnl;
    } else {
      breakeven += 1;
    }
  }

  const closed = wins + losses + breakeven;
  return {
    closed,
    open,
    wins,
    losses,
    breakeven,
    grossProfit,
    grossLoss,
    realizedPnl,
    winRate: closed > 0 ? wins / closed : null,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    avgWin: wins > 0 ? grossProfit / wins : null,
    avgLoss: losses > 0 ? grossLoss / losses : null,
  };
}

export interface Interval {
  start: number;
  end: number;
}

/** Merge overlapping/adjacent `[start, end)` intervals into a minimal cover. */
export function mergeIntervals(intervals: readonly Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}

/**
 * Fraction of the run window with at least one open position (union of the
 * round trips' holding intervals, clipped to the window). A position still open
 * at the end is counted to the window's end. `null` without a usable window.
 */
export function exposureFraction(input: AnalyticsInput): number | null {
  const from = secondsOfDate(input.window?.start);
  const to = secondsOfDate(input.window?.end);
  if (from === null || to === null || to <= from) return null;
  const span = to - from;
  const intervals: Interval[] = [];
  for (const trip of input.trips) {
    const start = Math.max(from, trip.entryTs);
    const end = Math.min(to, trip.exitTs ?? to);
    if (end > start) intervals.push({ start, end });
  }
  const covered = mergeIntervals(intervals).reduce((sum, i) => sum + (i.end - i.start), 0);
  return Math.min(1, Math.max(0, covered / span));
}

// ---------------------------------------------------------------------------
// Equity, monthly returns & the trade journal table
// ---------------------------------------------------------------------------

export type EquitySampling = 'daily' | 'trade';

export interface EquitySeries {
  /** Index-aligned equity values; `equity[0]` is the starting capital. */
  equity: number[];
  sampling: EquitySampling;
  initial: number;
  final: number;
  /** Number of steps (days for `daily`, closed trips + 1 for `trade`). */
  steps: number;
}

interface DayGrid {
  startSec: number;
  endSec: number;
  /** Whole days between the window edges. */
  days: number;
}

function dayGrid(window: AnalyticsInput['window']): DayGrid | null {
  const startSec = secondsOfDate(window?.start);
  const endSec = secondsOfDate(window?.end);
  if (startSec === null || endSec === null || endSec <= startSec) return null;
  const days = Math.round((endSec - startSec) / MS_PER_DAY);
  if (days <= 0) return null;
  return { startSec, endSec, days };
}

function capitalOf(input: AnalyticsInput): number {
  return finite(input.initialCapital) && input.initialCapital > 0 ? input.initialCapital : 100_000;
}

/**
 * Realised equity from the journal.
 *
 * With a run window the curve is sampled **daily** (one point per calendar day,
 * carrying the last realised value forward), which keeps it time-aligned; without
 * one it is sampled per closed round trip. This is *realised* equity — the
 * journal is fills, so no mark-to-market on open positions is invented.
 */
export function equitySeries(input: AnalyticsInput): EquitySeries {
  const initial = capitalOf(input);
  const closed = input.trips
    .filter((trip): trip is RoundTrip & { realizedPnl: number; exitTs: number } => trip.realizedPnl !== null && trip.exitTs !== null)
    .sort((a, b) => a.exitTs - b.exitTs);

  const grid = dayGrid(input.window);
  if (grid) {
    const equity: number[] = [initial];
    let cumulative = 0;
    let cursor = 0;
    for (let day = 1; day <= grid.days; day += 1) {
      const dayEnd = grid.startSec + day * MS_PER_DAY;
      while (cursor < closed.length && closed[cursor].exitTs < dayEnd) {
        cumulative += closed[cursor].realizedPnl;
        cursor += 1;
      }
      equity.push(initial + cumulative);
    }
    return { equity, sampling: 'daily', initial, final: equity[equity.length - 1], steps: equity.length };
  }

  const equity: number[] = [initial];
  let cumulative = 0;
  for (const trip of closed) {
    cumulative += trip.realizedPnl;
    equity.push(initial + cumulative);
  }
  return { equity, sampling: 'trade', initial, final: equity[equity.length - 1], steps: equity.length };
}

/**
 * Benchmark equity from a benchmark bar series: buy-and-hold, normalised so it
 * starts at the same capital as the run and shares the equity curve's sampling.
 *
 * Returns `null` when the bars cannot be aligned to the equity curve (no window,
 * a different sampling, or no bars), so the caller shows a labelled absence
 * rather than a misleading overlay (R5).
 */
export function benchmarkEquity(
  bars: ReadonlyArray<{ time: number; close: number }>,
  equity: EquitySeries,
  input: AnalyticsInput,
): number[] | null {
  const usable = bars.filter((bar) => finite(bar.close) && bar.close > 0);
  if (usable.length === 0) return null;

  const grid = dayGrid(input.window);
  // Only a daily equity curve can share an axis with a bar series honestly; the
  // trade-sampled fallback has no daily grid to align to, so no overlay is offered.
  if (equity.sampling !== 'daily' || !grid) return null;

  const ordered = [...usable].sort((a, b) => a.time - b.time);
  const first = ordered[0].close;
  const out: number[] = [equity.initial];
  let cursor = 0;
  let lastClose = first;
  for (let day = 1; day <= grid.days; day += 1) {
    const dayEnd = grid.startSec + day * MS_PER_DAY;
    while (cursor < ordered.length && ordered[cursor].time < dayEnd) {
      lastClose = ordered[cursor].close;
      cursor += 1;
    }
    out.push(equity.initial * (lastClose / first));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Monthly heatmap (IST bucketing, matching the NSE reporting convention)
// ---------------------------------------------------------------------------

export interface HeatmapCell {
  year: number;
  /** 0 = January. */
  month: number;
  /** Realised PnL of closed round trips that exited in this month. */
  pnl: number;
  /** PnL ÷ (starting capital + realised PnL before the month). */
  returnPct: number | null;
  trades: number;
}

export interface MonthlyHeatmap {
  cells: HeatmapCell[];
  years: number[];
  /** Sum of every cell's `pnl` (equals realised PnL over closed trips). */
  totalPnl: number;
  totalReturnPct: number | null;
}

/** IST year/month of a UTC-seconds timestamp. */
export function istYearMonth(ts: number): { year: number; month: number } {
  const date = new Date((ts + IST_OFFSET_SECONDS) * 1000);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

/** Realised PnL bucketed by IST calendar month, for the month × year heatmap. */
export function monthlyHeatmap(input: AnalyticsInput): MonthlyHeatmap {
  const initial = capitalOf(input);
  const closed = input.trips
    .filter((trip): trip is RoundTrip & { realizedPnl: number; exitTs: number } => trip.realizedPnl !== null && trip.exitTs !== null)
    .sort((a, b) => a.exitTs - b.exitTs);

  const byMonth = new Map<string, HeatmapCell>();
  let cumulative = 0;
  let totalPnl = 0;
  for (const trip of closed) {
    const { year, month } = istYearMonth(trip.exitTs);
    const key = `${year}-${month}`;
    const cell = byMonth.get(key) ?? { year, month, pnl: 0, returnPct: null, trades: 0 };
    const monthStartEquity = initial + cumulative;
    cell.pnl += trip.realizedPnl;
    cell.trades += 1;
    cell.returnPct = safeRatio(cell.pnl, monthStartEquity);
    cumulative += trip.realizedPnl;
    totalPnl += trip.realizedPnl;
    byMonth.set(key, cell);
  }

  const cells = [...byMonth.values()].sort((a, b) => a.year - b.year || a.month - b.month);
  const years = [...new Set(cells.map((cell) => cell.year))].sort((a, b) => a - b);
  return { cells, years, totalPnl, totalReturnPct: safeRatio(totalPnl, initial) };
}

// ---------------------------------------------------------------------------
// Trade journal table + CSV export
// ---------------------------------------------------------------------------

export interface JournalRow {
  id: string;
  instrument: string;
  direction: 'long' | 'short';
  status: 'closed' | 'open';
  entryTs: number;
  exitTs: number | null;
  quantity: number;
  openQuantity: number;
  avgEntry: number;
  avgExit: number | null;
  realizedPnl: number | null;
  returnPct: number | null;
  fees: number;
  exitReason: RoundTripExitReason;
}

/** Flatten the round trips into the journal table's rows. */
export function journalRows(trips: readonly RoundTrip[]): JournalRow[] {
  return trips.map((trip) => ({
    id: trip.id,
    instrument: trip.instrument,
    direction: trip.direction,
    status: trip.status,
    entryTs: trip.entryTs,
    exitTs: trip.exitTs,
    quantity: trip.quantity,
    openQuantity: trip.openQuantity,
    avgEntry: trip.avgEntry,
    avgExit: trip.avgExit,
    realizedPnl: trip.realizedPnl,
    returnPct: trip.returnPct,
    fees: trip.fees,
    exitReason: trip.exitReason,
  }));
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

/** RFC-4180 field: quoted when it holds a comma, quote, CR or LF; quotes doubled. */
export function csvField(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Serialise rows to CSV (CRLF line endings, so Excel opens it cleanly). */
export function toCsv<T>(rows: readonly T[], columns: ReadonlyArray<CsvColumn<T>>): string {
  const header = columns.map((column) => csvField(column.header)).join(',');
  const body = rows.map((row) => columns.map((column) => csvField(column.value(row))).join(','));
  return [header, ...body].join('\r\n');
}

/** UTC `YYYY-MM-DD HH:MM` for a UTC-seconds timestamp (`—` when absent). */
export function formatTimestamp(ts: number | null | undefined): string {
  if (!finite(ts)) return '—';
  return new Date(ts * 1000).toISOString().replace('T', ' ').slice(0, 16);
}

// ---------------------------------------------------------------------------
// Benchmark instrument
// ---------------------------------------------------------------------------

/**
 * Best-effort `SYMBOL.EXCHANGE` id for the panel's benchmark display name.
 *
 * The run contract has no benchmark and the bars route wants an instrument id,
 * so a display name like `NIFTY 50` is normalised to the symbol convention the
 * repo uses (`NIFTY50.NSE`). The id is only ever used to *attempt* a fetch: if
 * the store has no bars for it the overlay is simply absent and labelled, never
 * fabricated (risk R5).
 */
export function benchmarkInstrumentId(name: string | null | undefined, exchange = 'NSE'): string | null {
  if (typeof name !== 'string') return null;
  const symbol = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (symbol.length === 0) return null;
  return `${symbol}.${exchange.trim().toUpperCase() || 'NSE'}`;
}

// ---------------------------------------------------------------------------
// Ribbon
// ---------------------------------------------------------------------------

function wire(
  key: string,
  label: string,
  kind: MetricKind,
  value: number | null | undefined,
): RibbonMetric {
  return { key, label, kind, value: finite(value) ? value : null, provenance: 'wire', note: 'Reported by the run payload.' };
}

/**
 * The metrics ribbon. Wire values are echoed exactly; derived values are
 * computed from the payload, the window and the journal; Sortino is unavailable
 * because the contract carries no periodic return series.
 */
export function deriveRibbonMetrics(input: AnalyticsInput): RibbonMetric[] {
  const { metrics } = input;
  const years = yearsBetween(input.window?.start, input.window?.end);
  const cagr = annualisedReturn(metrics?.total_return ?? null, years);
  const maxDrawdown = finite(metrics?.max_drawdown) ? metrics!.max_drawdown : null;
  const stats = roundTripStats(input.trips);
  const exposure = exposureFraction(input);

  const windowNote = years === null
    ? 'No run window; annualisation is undefined.'
    : `Compounded from total return over the ${years.toFixed(2)}-year run window.`;

  const metrics_: RibbonMetric[] = [
    wire('total_return', 'Total Return', 'percent', metrics?.total_return),
    {
      key: 'cagr',
      label: 'CAGR',
      kind: 'percent',
      value: cagr,
      provenance: cagr === null ? 'unavailable' : 'derived',
      note: cagr === null ? windowNote : `${windowNote} Formed as (1 + total return)^(1/years) − 1.`,
    },
    wire('sharpe', 'Sharpe', 'ratio', metrics?.sharpe),
    {
      key: 'sortino',
      label: 'Sortino',
      kind: 'ratio',
      value: null,
      provenance: 'unavailable',
      note: 'Needs a periodic return series; the run payload carries none and the journal gives trade-level returns only.',
    },
    {
      key: 'calmar',
      label: 'Calmar',
      kind: 'ratio',
      value: cagr !== null && maxDrawdown !== null && maxDrawdown > 0 ? cagr / maxDrawdown : null,
      provenance: 'derived',
      note: 'CAGR ÷ |max drawdown|.',
    },
    wire('max_drawdown', 'Max Drawdown', 'drawdown', metrics?.max_drawdown),
    {
      key: 'win_rate',
      label: 'Win Rate',
      kind: 'percent',
      value: stats.winRate,
      provenance: 'derived',
      note: `Winning round trips ÷ closed round trips (${stats.wins}/${stats.closed}, journal).`,
    },
    {
      key: 'profit_factor',
      label: 'Profit Factor',
      kind: 'ratio',
      value: stats.profitFactor,
      provenance: 'derived',
      note: stats.grossLoss > 0
        ? 'Gross profit ÷ gross loss over closed round trips (journal).'
        : 'No losing round trips, so profit factor is undefined (not infinite).',
    },
    wire('trades', 'Total Trades', 'count', metrics?.trades),
    {
      key: 'exposure',
      label: 'Exposure',
      kind: 'percent',
      value: exposure,
      provenance: exposure === null ? 'unavailable' : 'derived',
      note: exposure === null
        ? 'Needs a run window; exposure is time in market ÷ window.'
        : 'Time with an open position ÷ run window (journal fills).',
    },
  ];
  return metrics_;
}

/** Presentation helper; `null` renders as an em dash. */
export function formatMetricValue(value: number | null, kind: MetricKind): string {
  if (!finite(value)) return '—';
  switch (kind) {
    case 'percent':
      return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
    case 'drawdown':
      // The wire reports drawdown as a positive fraction; it always reads negative.
      return `-${(Math.abs(value) * 100).toFixed(2)}%`;
    case 'ratio':
      return value.toFixed(2);
    case 'count':
      return String(Math.round(value));
    case 'currency':
      return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
