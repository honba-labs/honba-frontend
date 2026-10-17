import type { BacktestRequest, BacktestResponse, RunStatus } from '../types/generated/domain';
import type { StrategyCompiler } from '../designer/compile';

/**
 * Backtest run state (Phase 6).
 *
 * `RunStatus` on the wire is `pending | running | completed | failed | cancelled`;
 * the simulator folds `pending`/`running` into `running` and keeps the terminal
 * states distinct. The polling loop is deliberately injected (`RunClient`,
 * `sleep`) so it is exercised in vitest without timers or a live server.
 */

export type SimRunStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface SimRunState {
  status: SimRunStatus;
  runId: string | null;
  response: BacktestResponse | null;
  error: string | null;
  /** Progress lines, newest last. */
  logs: string[];
}

export function initialRunState(): SimRunState {
  return { status: 'idle', runId: null, response: null, error: null, logs: [] };
}

export function isTerminalStatus(status: RunStatus | SimRunStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

export function foldStatus(status: RunStatus | SimRunStatus | null | undefined): SimRunStatus {
  switch (status) {
    case 'pending':
    case 'running':
      return 'running';
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    case 'failed':
      return 'failed';
    default:
      return 'idle';
  }
}

function appendLog(state: SimRunState, line: string): string[] {
  return [...state.logs, line];
}

/** Fold a `BacktestResponse` (submit or poll) into the run state. */
export function applyRunResponse(state: SimRunState, response: BacktestResponse | null): SimRunState {
  if (!response) {
    return { ...state, logs: appendLog(state, 'The server returned no run payload.') };
  }
  const runId = response.run_id || state.runId;
  const error = response.error ? `${response.error.code}: ${response.error.message}` : null;
  const status = error ? 'failed' : foldStatus(response.status);
  return {
    ...state,
    status,
    runId,
    response,
    error,
    logs: appendLog(state, `Run ${runId} → ${status}`),
  };
}

/** Fold a transport/client error into the run state. */
export function applyRunError(state: SimRunState, error: unknown): SimRunState {
  const message = error instanceof Error ? error.message : String(error);
  return { ...state, status: 'failed', error: message, logs: appendLog(state, `Run failed: ${message}`) };
}

/** The slice of the generated client the polling loop needs (narrow for mocking). */
export interface RunClient extends StrategyCompiler {
  postBacktests(
    body: BacktestRequest,
    signal?: AbortSignal,
  ): Promise<{ data?: BacktestResponse | null }>;
  getBacktestsById(
    id: string,
    signal?: AbortSignal,
  ): Promise<{ data?: BacktestResponse | null }>;
}

export interface RunOptions {
  /** Milliseconds between polls (default 1s). */
  intervalMs?: number;
  /** Maximum number of polls before giving up (default 120 ⇒ ~2 min at 1s). */
  maxPolls?: number;
  signal?: AbortSignal;
  /** Injected sleep; defaults to `setTimeout`. */
  sleep?: (ms: number) => Promise<void>;
  /** Called on every state transition. */
  onUpdate?: (state: SimRunState) => void;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Submit a backtest and fold the run to a terminal state.
 *
 * The submit response may already be terminal; otherwise the loop polls
 * `GET /backtests/{id}` until the status is terminal or `maxPolls` is hit.
 * A poll-cap exit is reported as a failure so the UI never hangs on "running".
 */
export async function runBacktest(
  client: RunClient,
  request: BacktestRequest,
  options: RunOptions = {},
): Promise<SimRunState> {
  const intervalMs = options.intervalMs ?? 1000;
  const maxPolls = options.maxPolls ?? 120;
  const sleep = options.sleep ?? defaultSleep;
  const emit = (state: SimRunState): SimRunState => {
    options.onUpdate?.(state);
    return state;
  };

  let state = emit({
    ...initialRunState(),
    status: 'running',
    logs: [`Submitting ${request.strategy ?? 'strategy'} over ${request.universe ?? 'universe'}…`],
  });

  try {
    const submitted = await client.postBacktests(request, options.signal);
    state = emit(applyRunResponse(state, submitted.data ?? null));

    let polls = 0;
    while (state.runId && !isTerminalStatus(state.status) && polls < maxPolls) {
      if (options.signal?.aborted) {
        state = emit(applyRunError(state, new Error('run aborted')));
        break;
      }
      await sleep(intervalMs);
      polls += 1;
      const polled = await client.getBacktestsById(state.runId, options.signal);
      state = emit(applyRunResponse(state, polled.data ?? null));
    }

    if (state.runId && !isTerminalStatus(state.status)) {
      state = emit(applyRunError(state, new Error(`run ${state.runId} did not finish within ${maxPolls} polls`)));
    }
    return state;
  } catch (error) {
    return emit(applyRunError(state, error));
  }
}
