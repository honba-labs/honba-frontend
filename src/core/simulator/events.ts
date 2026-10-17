import type { Event, Message, RunStatus, StreamFrame } from '../types/generated/domain';

/**
 * Run logs & events (Phase 8).
 *
 * ADR 0021 designs run events as an SSE stream
 * (`GET /backtests/{id}/events` → `StreamFrame`), with `resume_from_seq` so a
 * reader can pick up where it left off. The generated client exposes that as
 * `streamBacktestEvents`, and the FE consumes it behind a feature-detected seam
 * — exactly like the run poll and the journal — so a client (or a mock) without
 * the route degrades to the poll-derived progress log instead of failing.
 *
 * Frames are folded to a compact one-line log here rather than in the component,
 * so the mapping is testable in node.
 */

export interface StreamFrameLike {
  kind: 'status' | 'record';
  seq: number;
  status?: RunStatus;
  error?: unknown;
  message?: Message;
}

/** The slice of the generated client an event stream needs. */
export interface EventStreamClient {
  streamBacktestEvents(
    id: string,
    query?: { resume_from_seq?: number | null },
    signal?: AbortSignal,
  ): AsyncGenerator<StreamFrame, void, unknown>;
}

export function hasEventStream(client: unknown): client is EventStreamClient {
  return typeof (client as EventStreamClient | undefined)?.streamBacktestEvents === 'function';
}

/** Human-readable label for a wire `Event` union member, keyed on its `type`. */
export function describeEvent(event: Event | null | undefined): string {
  const type = event && typeof event === 'object' ? (event as { type?: unknown }).type : undefined;
  if (typeof type !== 'string') return 'event';
  switch (type) {
    case 'bar':
      return 'bar';
    case 'quote':
      return 'quote';
    case 'trade':
      return 'trade tick';
    case 'order':
      return 'order update';
    case 'order_filled':
      return 'order filled';
    case 'order_partially_filled':
      return 'order partially filled';
    case 'order_accepted':
      return 'order accepted';
    case 'order_rejected':
      return 'order rejected';
    case 'order_cancelled':
      return 'order cancelled';
    case 'order_cancel_requested':
      return 'order cancel requested';
    case 'order_expired':
      return 'order expired';
    default:
      return type.replace(/_/g, ' ');
  }
}

/** One compact line for a stream frame; `null` when it carries nothing to show. */
export function frameToLine(frame: StreamFrameLike | null | undefined): string | null {
  if (!frame) return null;
  if (frame.kind === 'status') {
    const detail = frame.error ? ` — ${describeError(frame.error)}` : '';
    return `#${frame.seq} status: ${frame.status ?? 'unknown'}${detail}`;
  }
  const message = frame.message;
  if (!message || typeof message !== 'object') return `#${frame.seq} event`;
  return `#${frame.seq} ${describeEvent(message.event)}`;
}

function describeError(error: unknown): string {
  if (error && typeof error === 'object') {
    const detail = error as { message?: unknown; code?: unknown };
    if (typeof detail.message === 'string') {
      return typeof detail.code === 'string' ? `${detail.code}: ${detail.message}` : detail.message;
    }
  }
  return String(error);
}

export interface RunLogState {
  lines: string[];
  /** Highest seq folded in, so `resume_from_seq` continues rather than repeats. */
  lastSeq: number;
  /** Terminal status observed on the stream, if any. */
  terminal: RunStatus | null;
}

export function initialRunLog(): RunLogState {
  return { lines: [], lastSeq: 0, terminal: null };
}

const MAX_LOG_LINES = 500;

/** Fold a frame into the log: appends one line, tracks the seq and terminal status. */
export function foldRunLog(state: RunLogState, frame: StreamFrameLike | null | undefined): RunLogState {
  if (!frame) return state;
  const line = frameToLine(frame);
  const lines = line === null ? state.lines : [...state.lines, line].slice(-MAX_LOG_LINES);
  const terminal = frame.kind === 'status' ? foldTerminal(frame.status) : state.terminal;
  const lastSeq = Math.max(state.lastSeq, Number.isFinite(frame.seq) ? frame.seq : 0);
  if (lines === state.lines && terminal === state.terminal && lastSeq === state.lastSeq) return state;
  return { lines, lastSeq, terminal };
}

/** `completed`/`failed`/`cancelled` are terminal; everything else keeps running. */
export function foldTerminal(status: RunStatus | undefined): RunStatus | null {
  if (status === 'completed' || status === 'failed' || status === 'cancelled') return status;
  return null;
}

export interface RunLogOptions {
  signal?: AbortSignal;
  /** Called on every fold. */
  onState?: (state: RunLogState) => void;
  /** Stop after this many frames (safety valve for tests and long runs). */
  maxFrames?: number;
}

export interface RunLogSource {
  streamBacktestEvents: EventStreamClient['streamBacktestEvents'];
}

/**
 * Drain an event stream into a `RunLogState`.
 *
 * Resolves when the stream ends, the caller aborts, a terminal status arrives or
 * `maxFrames` is hit; a failing route resolves to the log gathered so far rather
 * than throwing, so the drawer can always render something.
 */
export async function collectRunLog(
  client: RunLogSource,
  runId: string,
  options: RunLogOptions = {},
): Promise<RunLogState> {
  let state = initialRunLog();
  const emit = (): void => options.onState?.(state);
  try {
    const generator = client.streamBacktestEvents(runId, { resume_from_seq: state.lastSeq || undefined }, options.signal);
    for await (const frame of generator) {
      if (options.signal?.aborted) break;
      state = foldRunLog(state, frame as StreamFrameLike);
      emit();
      if (state.terminal) break;
      if (options.maxFrames !== undefined && state.lines.length >= options.maxFrames) break;
    }
  } catch (error) {
    if (options.signal?.aborted) return state;
    state = foldRunLog(state, { kind: 'status', seq: state.lastSeq, status: 'failed', error });
    emit();
  }
  return state;
}
