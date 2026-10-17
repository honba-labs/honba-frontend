import type { BarsResponse } from '../types/generated/domain';

import { previewBars, toChartBars, type ChartBar } from './chart-data';

/**
 * Bar loading for the Simulator chart (Phase 7).
 *
 * The authoritative source is `GET /bars/{id}` (`SYMBOL.EXCHANGE`, `tf` equal
 * to the run's `bar_spec`, windowed by the run's dates) — the same store the
 * run itself consumes, so candles and fills describe one series. When the
 * store answers with nothing (or the API is down) the chart falls back to the
 * deterministic NSE-session preview so the workspace stays usable; that state
 * is reported as `source: 'preview'` and labelled in the UI, never passed off
 * as served history.
 */

export type BarsSource = 'none' | 'server' | 'preview';

export type BarsStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface BarsState {
  status: BarsStatus;
  bars: ChartBar[];
  source: BarsSource;
  /** Human-readable note for the empty/preview badge. */
  note: string | null;
  error: string | null;
}

export function initialBarsState(): BarsState {
  return { status: 'idle', bars: [], source: 'none', note: null, error: null };
}

export interface BarsClient {
  getBarsById(
    id: string,
    query?: { from?: string | null; tf?: string | null; to?: string | null },
    signal?: AbortSignal,
  ): Promise<{ data?: BarsResponse | null }>;
}

export function hasBarsClient(client: unknown): client is BarsClient {
  return typeof (client as BarsClient | undefined)?.getBarsById === 'function';
}

export interface LoadBarsRequest {
  /** `SYMBOL.EXCHANGE`, the id `GET /bars/{id}` expects. */
  instrumentId: string;
  /** Inclusive start, `YYYY-MM-DD`. */
  from: string;
  /** Exclusive end, `YYYY-MM-DD`. */
  to: string;
  /** Run `bar_spec`, e.g. `5m`. */
  barSpec: string;
  /** Last known price, for the preview fallback. */
  anchor?: number;
}

function secondsOfDate(date: string): number {
  const ms = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

/** Build the preview series for a request (exported so the fallback is testable). */
export function previewFor(request: LoadBarsRequest): ChartBar[] {
  return previewBars({
    instrumentId: request.instrumentId,
    from: secondsOfDate(request.from),
    to: secondsOfDate(request.to),
    barSpec: request.barSpec,
    anchor: request.anchor,
  });
}

/**
 * Load the bars behind a run, falling back to the local preview series.
 *
 * `signal` lets a component cancel a load when the selection changes; a
 * cancelled request resolves to the preview fallback rather than throwing, and
 * the caller's `cancelled` guard decides whether to keep the result.
 */
export async function loadRunBars(
  client: Partial<BarsClient> | null | undefined,
  request: LoadBarsRequest,
  options: { signal?: AbortSignal } = {},
): Promise<BarsState> {
  const fallback = (): BarsState => ({
    status: 'ready',
    bars: previewFor(request),
    source: 'preview',
    note: `No served bars for ${request.instrumentId} at ${request.barSpec}; showing a deterministic NSE-session preview.`,
    error: null,
  });

  if (!hasBarsClient(client)) {
    return { ...fallback(), note: `Bar API unavailable; showing a deterministic NSE-session preview for ${request.instrumentId}.` };
  }

  try {
    const response = await client.getBarsById(
      request.instrumentId,
      { from: request.from, to: request.to, tf: request.barSpec },
      options.signal,
    );
    const bars = toChartBars(response?.data?.bars ?? []);
    if (bars.length > 0) {
      return { status: 'ready', bars, source: 'server', note: null, error: null };
    }
    return {
      ...fallback(),
      note: `The bar store has no ${request.barSpec} bars for ${request.instrumentId} in this window; showing a preview.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ...fallback(), error: message, note: `Bar store unreachable (${message}); showing a preview.` };
  }
}
