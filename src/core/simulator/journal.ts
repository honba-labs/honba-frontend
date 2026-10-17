import type { Trade, TradesResponse } from '../types/generated/domain';

/**
 * Run journal loading (Phase 7).
 *
 * `GET /backtests/{id}/journal` answers with **fills**, which the chart pairs
 * into round trips (`trade-pairing.ts`). This module owns the fetch state only;
 * it never pairs, so the pairing rules stay in one tested place.
 *
 * The client seam is narrow and optional, exactly as the run loop's is, so the
 * store degrades gracefully against a client (or a mock) without the route.
 */

export type JournalStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface JournalState {
  status: JournalStatus;
  runId: string | null;
  trades: Trade[];
  error: string | null;
}

export function initialJournalState(): JournalState {
  return { status: 'idle', runId: null, trades: [], error: null };
}

/** The slice of the generated client a journal load needs. */
export interface JournalClient {
  getBacktestsByIdJournal(id: string, signal?: AbortSignal): Promise<{ data?: TradesResponse | null }>;
}

export function hasJournalClient(client: unknown): client is JournalClient {
  return typeof (client as JournalClient | undefined)?.getBacktestsByIdJournal === 'function';
}

export function applyJournalLoading(state: JournalState, runId: string): JournalState {
  return { ...state, status: 'loading', runId, error: null };
}

export function applyJournalResponse(state: JournalState, runId: string, trades: Trade[]): JournalState {
  if (state.runId !== runId || state.status !== 'loading') return state; // a newer load owns the state
  return { status: 'ready', runId, trades, error: null };
}

export function applyJournalError(state: JournalState, runId: string, error: unknown): JournalState {
  if (state.runId !== runId || state.status !== 'loading') return state;
  const message = error instanceof Error ? error.message : String(error);
  return { status: 'error', runId, trades: [], error: message };
}

export interface JournalOptions {
  signal?: AbortSignal;
}

/**
 * Fetch the fills of a finished run.
 *
 * A missing route is not an error the user should see: it resolves to an
 * `error` state with the usual message, and the chart simply renders no
 * markers.
 */
export async function loadJournal(
  client: JournalClient,
  runId: string,
  options: JournalOptions = {},
): Promise<JournalState> {
  const loading = applyJournalLoading(initialJournalState(), runId);
  try {
    const response = await client.getBacktestsByIdJournal(runId, options.signal);
    return applyJournalResponse(loading, runId, response?.data?.trades ?? []);
  } catch (error) {
    return applyJournalError(loading, runId, error);
  }
}
