import type { Bar as DomainBar, UnixNanos } from '../types/generated/domain';

/**
 * Chart data plumbing (Phase 7).
 *
 * Converts the wire `Bar` (`ts_event: UnixNanos`) into the shape
 * `openalgo-charts` draws (`{ time: UTCSeconds, ... }`), folds bars to the
 * run's `bar_spec`, and derives trade-marker timestamps.
 *
 * Two rules are load-bearing for the Phase 7 acceptance criteria:
 *
 * 1. **Never synthesise a candle.** Resampling folds *bars that exist* into
 *    buckets; a bucket with no source bar is not emitted, so an NSE holiday or
 *    an overnight gap stays a gap (no phantom candles).
 * 2. **Markers land on bar timestamps.** Journal fills carry their own
 *    `ts_event`; `snapToBars` maps each one onto the closest bar inside one bar
 *    step so an entry/exit triangle sits on the candle it belongs to.
 *
 * Day/week/month bucketing and the preview session are **NSE / Asia-Kolkata**
 * shaped, matching the chart's timezone; the run contract's `bar_spec`
 * (`<n><s|m|h|d|w|mo>`) is parsed exactly as `honba-api` does.
 */

/** IST is the session the Simulator charts; UTC+5:30 has no DST. */
export const IST_OFFSET_SECONDS = 5.5 * 3600;

/** NSE regular session, in seconds past IST midnight (09:15 → 15:30). */
export const SESSION_OPEN_SECONDS = 9 * 3600 + 15 * 60;
export const SESSION_CLOSE_SECONDS = 15 * 3600 + 30 * 60;

/** The same window measured past **UTC** midnight (03:45 → 10:00), for UTC-anchored day maths. */
export const SESSION_OPEN_UTC = SESSION_OPEN_SECONDS - IST_OFFSET_SECONDS;
export const SESSION_CLOSE_UTC = SESSION_CLOSE_SECONDS - IST_OFFSET_SECONDS;

/** Safety valve for the preview generator (mirrors `MAX_BAR_ROWS` in spirit). */
export const MAX_PREVIEW_BARS = 4_000;

/** A bar as `openalgo-charts` draws it: integer UTC seconds. */
export interface ChartBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type BarSpecUnit = 's' | 'm' | 'h' | 'd' | 'w' | 'mo';

export interface ParsedBarSpec {
  step: number;
  unit: BarSpecUnit;
}

const BAR_SPEC_RE = /^(\d+)(s|m|h|d|w|mo)$/;

/**
 * Parse a `bar_spec` such as `5m` or `1d`.
 *
 * The unit is matched longest-first so `1mo` is not read as `1m` + `o`.
 */
export function parseBarSpec(spec: string | null | undefined): ParsedBarSpec | null {
  const match = BAR_SPEC_RE.exec((spec ?? '').trim());
  if (!match) return null;
  const step = Number(match[1]);
  if (!Number.isFinite(step) || step <= 0) return null;
  return { step, unit: match[2] as BarSpecUnit };
}

const UNIT_SECONDS: Record<BarSpecUnit, number> = { s: 1, m: 60, h: 3600, d: 86_400, w: 604_800, mo: 0 };

/** Fixed width of one bucket in seconds; `null` for `mo`, which is calendar-sized. */
export function barSpecSeconds(spec: string | null | undefined): number | null {
  const parsed = parseBarSpec(spec);
  if (!parsed) return null;
  const unit = UNIT_SECONDS[parsed.unit];
  if (unit === 0) return null;
  return unit * parsed.step;
}

/**
 * `ts_event` → whole UTC seconds.
 *
 * The wire value is a nanosecond count held as a **string** (`1.7e18` overflows
 * `Number.MAX_SAFE_INTEGER`), so the sub-second digits are dropped as text
 * rather than via a lossy `Number` conversion; `iso` is the fallback.
 */
export function unixNanosToSeconds(ts: UnixNanos | null | undefined): number | null {
  if (!ts) return null;
  const raw = typeof ts.unix_nanos === 'string' ? ts.unix_nanos.trim() : '';
  if (/^\d+$/.test(raw)) {
    if (raw.length > 9) return Number(raw.slice(0, raw.length - 9));
    return 0;
  }
  if (typeof ts.iso === 'string' && ts.iso.length > 0) {
    const ms = Date.parse(ts.iso);
    if (Number.isFinite(ms)) return Math.floor(ms / 1000);
  }
  return null;
}

function finite(value: number): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Normalise wire bars for the chart: seconds-based `time`, ascending order, one
 * bar per timestamp (the later row wins) and invalid rows dropped.
 *
 * Bars a source never emitted are simply absent, which is what keeps holidays
 * and weekends visible as gaps.
 */
export function toChartBars(bars: readonly DomainBar[] | null | undefined): ChartBar[] {
  if (!bars || bars.length === 0) return [];
  const byTime = new Map<number, ChartBar>();
  for (const bar of bars) {
    const time = unixNanosToSeconds(bar?.ts_event);
    if (time === null) continue;
    if (![bar.open, bar.high, bar.low, bar.close].every(finite)) continue;
    byTime.set(time, {
      time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: finite(bar.volume) ? bar.volume : 0,
    });
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

/** Start of the IST day containing `time`, in UTC seconds. */
function istDayStart(time: number): number {
  const day = Math.floor((time + IST_OFFSET_SECONDS) / 86_400);
  return day * 86_400 - IST_OFFSET_SECONDS;
}

/** `0 = Sunday … 6 = Saturday` for the IST day containing `time`. */
function istWeekday(time: number): number {
  const day = Math.floor((time + IST_OFFSET_SECONDS) / 86_400);
  return (day + 4) % 7;
}

/** Canonical bucket start for `time`, aware of IST day/week/month boundaries. */
export function bucketStart(time: number, spec: ParsedBarSpec): number {
  const { step, unit } = spec;
  if (unit === 's' || unit === 'm' || unit === 'h') {
    const width = step * UNIT_SECONDS[unit];
    return Math.floor(time / width) * width;
  }
  const dayStart = istDayStart(time);
  if (unit === 'd') return dayStart;
  if (unit === 'w') {
    const daysSinceMonday = (istWeekday(time) + 6) % 7;
    return dayStart - daysSinceMonday * 86_400;
  }
  const shifted = (time + IST_OFFSET_SECONDS) * 1000;
  const date = new Date(shifted);
  return (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / 1000) - IST_OFFSET_SECONDS;
}

/**
 * Fold bars to a coarser `bar_spec`.
 *
 * Only buckets that contain at least one source bar are emitted — the returned
 * bar keeps the **first source bar's timestamp**, so a daily bar keeps its
 * session anchor rather than a UTC-midnight label. Empty buckets are skipped
 * entirely, so market holidays, weekends and the overnight gap stay gaps.
 */
export function resampleBars(bars: readonly ChartBar[], spec: string | null | undefined): ChartBar[] {
  const parsed = parseBarSpec(spec);
  if (!parsed || bars.length === 0) return [...bars];

  const buckets = new Map<number, ChartBar>();
  const order: number[] = [];
  const sorted = [...bars].sort((a, b) => a.time - b.time);

  for (const bar of sorted) {
    const key = bucketStart(bar.time, parsed);
    const current = buckets.get(key);
    if (!current) {
      order.push(key);
      buckets.set(key, { ...bar });
      continue;
    }
    current.high = Math.max(current.high, bar.high);
    current.low = Math.min(current.low, bar.low);
    current.close = bar.close;
    current.volume += bar.volume;
  }

  return order.sort((a, b) => a - b).map((key) => buckets.get(key)!);
}

/** Stable 32-bit hash → `[0, 1)`, so a preview bar is a pure function of its time. */
function hash01(...parts: number[]): number {
  let h = 2_166_136_261;
  for (const part of parts) {
    h ^= part | 0;
    h = Math.imul(h, 16_777_619);
    h ^= h >>> 13;
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Preview close for one timestamp: a deterministic, window-independent price path. */
function previewClose(time: number, anchor: number, step: number, seed: number): number {
  const cycle30 = Math.sin(time / 2_592_000);
  const cycle7 = Math.sin(time / 604_800 + 1.7);
  const cycle1 = Math.sin(time / 86_400 + 0.4);
  const noise = hash01(seed, Math.floor(time / Math.max(1, step)), 1) - 0.5;
  return anchor * (1 + 0.1 * cycle30 + 0.05 * cycle7 + 0.02 * cycle1 + 0.012 * noise);
}

function previewBar(time: number, step: number, anchor: number, seed: number): ChartBar {
  const close = round2(previewClose(time, anchor, step, seed));
  const open = round2(previewClose(time - step, anchor, step, seed));
  const span = Math.abs(close - open) + anchor * 0.004;
  const hi = hash01(seed, time, 2);
  const lo = hash01(seed, time, 3);
  const high = round2(Math.max(open, close) + span * hi * 0.6);
  const low = round2(Math.min(open, close) - span * lo * 0.6);
  const volume = Math.round(40_000 + 90_000 * hash01(seed, time, 4));
  return { time, open, high, low, close, volume };
}

function seedFor(instrumentId: string, spec: ParsedBarSpec): number {
  let h = 0;
  const key = `${instrumentId}|${spec.step}${spec.unit}`;
  for (let i = 0; i < key.length; i += 1) h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  return h;
}

export interface PreviewBarsRequest {
  instrumentId: string;
  /** Inclusive window start, UTC seconds. */
  from: number;
  /** Exclusive window end, UTC seconds. */
  to: number;
  /** Run `bar_spec`, e.g. `5m`. */
  barSpec: string;
  /** Price the path oscillates around (the instrument's last known price). */
  anchor?: number;
}

/**
 * Deterministic NSE-session bars for when the server has none.
 *
 * This is the Simulator's only local bar source, and it is always surfaced as
 * `source: 'preview'` in the UI. It honours the market calendar as far as the
 * frontend can: **weekends are skipped and only the 09:15–15:30 IST session is
 * emitted** — public holidays are not known client-side, so no bar is invented
 * for a gap the source does have, and none is invented for a weekday either
 * beyond the session.
 *
 * Every bar is a pure function of its own timestamp, so two overlapping windows
 * agree bar-for-bar instead of drifting with the window edges.
 */
export function previewBars(request: PreviewBarsRequest): ChartBar[] {
  const spec = parseBarSpec(request.barSpec);
  if (!spec) return [];
  const { from, to } = request;
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return [];
  const anchor = Number.isFinite(request.anchor) && (request.anchor as number) > 0 ? (request.anchor as number) : 100;
  const seed = seedFor(request.instrumentId, spec);
  const intraday = spec.unit === 's' || spec.unit === 'm' || spec.unit === 'h';
  const step = intraday ? spec.step * UNIT_SECONDS[spec.unit] : 86_400;

  const out: ChartBar[] = [];
  const firstDay = Math.floor((from + IST_OFFSET_SECONDS) / 86_400);
  const lastDay = Math.floor((to - 1 + IST_OFFSET_SECONDS) / 86_400);

  for (let day = firstDay; day <= lastDay && out.length < MAX_PREVIEW_BARS; day += 1) {
    const weekday = (day + 4) % 7;
    if (weekday === 0 || weekday === 6) continue; // weekend

    const dayStart = day * 86_400 - IST_OFFSET_SECONDS;
    const sessionOpen = dayStart + SESSION_OPEN_SECONDS;
    const sessionClose = dayStart + SESSION_CLOSE_SECONDS;

    if (intraday) {
      const start = Math.max(from, sessionOpen);
      const end = Math.min(to, sessionClose);
      if (end <= start) continue;
      const offset = Math.ceil((start - sessionOpen) / step);
      for (let k = offset; ; k += 1) {
        const time = sessionOpen + k * step;
        if (time >= end || out.length >= MAX_PREVIEW_BARS) break;
        if (time < from || time >= to) continue;
        out.push(previewBar(time, step, anchor, seed));
      }
      continue;
    }

    // Daily / weekly / monthly: one bar per bucket, anchored at the open.
    const time = sessionOpen;
    if (time < from || time >= to) continue;
    if (spec.unit === 'w' && weekday !== 1) continue; // one bar per (Monday) week
    if (spec.unit === 'mo') {
      const date = new Date((dayStart + IST_OFFSET_SECONDS) * 1000);
      const firstWeekday = 1 + ((1 - date.getUTCDay()) % 7 + 7) % 7;
      if (date.getUTCDate() !== firstWeekday) continue;
    }
    out.push(previewBar(time, step, anchor, seed));
  }

  return out.slice(-MAX_PREVIEW_BARS);
}

export interface TimestampedMarker {
  ts: number;
  [key: string]: unknown;
}

/**
 * Move each marker onto the closest bar timestamp inside one bar step.
 *
 * A fill's `ts_event` is the bar it executed on, but a rounded or close-of-bar
 * timestamp can sit off the candle by a fraction of a step. Anything further
 * than one step from a bar is left alone rather than dragged onto a candle it
 * did not trade on.
 */
export function snapToBars<T extends { ts: number }>(
  markers: readonly T[],
  bars: readonly ChartBar[],
  toleranceSec: number,
): T[] {
  if (markers.length === 0 || bars.length === 0 || !(toleranceSec > 0)) return [...markers];
  const times = bars.map((bar) => bar.time);
  return markers.map((marker) => {
    let lo = 0;
    let hi = times.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (times[mid] <= marker.ts) lo = mid;
      else hi = mid - 1;
    }
    const candidates = [times[lo], times[Math.min(lo + 1, times.length - 1)]];
    let best = marker.ts;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      const delta = Math.abs(candidate - marker.ts);
      if (delta < bestDelta || (delta === bestDelta && candidate < best)) {
        best = candidate;
        bestDelta = delta;
      }
    }
    return bestDelta <= toleranceSec ? { ...marker, ts: best } : { ...marker };
  });
}

/** Tolerance for `snapToBars`: one whole bar step of the run's `bar_spec`. */
export function markerToleranceSec(barSpec: string | null | undefined): number {
  return barSpecSeconds(barSpec) ?? 0;
}
