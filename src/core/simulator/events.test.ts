import { describe, expect, it } from 'vitest';

import type { ErrorDetail, Event, StreamFrame } from '../types/generated/domain';

import {
  collectRunLog,
  describeEvent,
  foldRunLog,
  frameToLine,
  foldTerminal,
  hasEventStream,
  initialRunLog,
} from './events';

type Status = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

function statusFrame(seq: number, status: Status, error?: ErrorDetail | string): StreamFrame {
  // A `string` error is deliberately off-contract (the wire type only admits an
  // `ErrorDetail`) to exercise the defensive fallback in `describeError`.
  return { kind: 'status', seq, status, ...(error !== undefined ? { error } : {}) } as StreamFrame;
}

function recordFrame(seq: number, type: string): StreamFrame {
  return {
    kind: 'record',
    seq,
    message: {
      schema_version: 4,
      ts_init: { iso: '', unix_nanos: '0' },
      event: { type } as unknown as Event,
    },
  };
}

describe('describeEvent', () => {
  it('labels known event types and degrades to the raw type', () => {
    expect(describeEvent({ type: 'bar' } as never)).toBe('bar');
    expect(describeEvent({ type: 'order_filled' } as never)).toBe('order filled');
    expect(describeEvent({ type: 'order_rejected' } as never)).toBe('order rejected');
    expect(describeEvent({ type: 'something_new' } as never)).toBe('something new');
    expect(describeEvent(null)).toBe('event');
  });
});

describe('frameToLine', () => {
  it('renders a status frame with its seq and status', () => {
    expect(frameToLine(statusFrame(3, 'running'))).toBe('#3 status: running');
    expect(frameToLine(statusFrame(4, 'completed'))).toBe('#4 status: completed');
  });

  it('includes an error detail on a failed status', () => {
    expect(frameToLine(statusFrame(5, 'failed', { code: 'internal_error', message: 'boom', retryable: false }))).toBe(
      '#5 status: failed — internal_error: boom',
    );
    expect(frameToLine(statusFrame(5, 'failed', 'plain'))).toBe('#5 status: failed — plain');
  });

  it('renders a record frame with the event label', () => {
    expect(frameToLine(recordFrame(7, 'order_filled'))).toBe('#7 order filled');
    expect(frameToLine(recordFrame(8, 'bar'))).toBe('#8 bar');
  });

  it('returns null for an absent frame', () => {
    expect(frameToLine(null)).toBeNull();
    expect(frameToLine(undefined)).toBeNull();
    expect(frameToLine({ kind: 'record', seq: 1 })).toBe('#1 event');
  });
});

describe('foldRunLog', () => {
  it('appends lines, tracks the high-water seq and terminal status', () => {
    let state = initialRunLog();
    state = foldRunLog(state, statusFrame(1, 'running'));
    state = foldRunLog(state, recordFrame(2, 'bar'));
    expect(state.lines).toEqual(['#1 status: running', '#2 bar']);
    expect(state.lastSeq).toBe(2);
    expect(state.terminal).toBeNull();

    state = foldRunLog(state, statusFrame(3, 'completed'));
    expect(state.terminal).toBe('completed');
    expect(state.lastSeq).toBe(3);
  });

  it('keeps only the newest lines under the cap', () => {
    let state = initialRunLog();
    for (let i = 0; i < 600; i += 1) state = foldRunLog(state, recordFrame(i + 1, 'bar'));
    expect(state.lines).toHaveLength(500);
    expect(state.lines[0]).toBe('#101 bar');
    expect(state.lines[state.lines.length - 1]).toBe('#600 bar');
  });

  it('returns the same object when a frame contributes nothing', () => {
    const state = initialRunLog();
    expect(foldRunLog(state, null)).toBe(state);
  });
});

describe('foldTerminal', () => {
  it('treats only the terminal wire statuses as terminal', () => {
    expect(foldTerminal('completed')).toBe('completed');
    expect(foldTerminal('failed')).toBe('failed');
    expect(foldTerminal('cancelled')).toBe('cancelled');
    expect(foldTerminal('running')).toBeNull();
    expect(foldTerminal('pending')).toBeNull();
    expect(foldTerminal(undefined)).toBeNull();
  });
});

describe('hasEventStream', () => {
  it('detects a client that exposes the SSE route', () => {
    expect(hasEventStream({ streamBacktestEvents: () => (async function* () { /* empty */ })() })).toBe(true);
    expect(hasEventStream({ getBacktestsById: () => Promise.resolve({}) })).toBe(false);
    expect(hasEventStream(null)).toBe(false);
    expect(hasEventStream(undefined)).toBe(false);
  });
});

describe('collectRunLog', () => {
  it('drains frames into a log and stops on a terminal status', async () => {
    const frames: StreamFrame[] = [
      statusFrame(1, 'running'),
      recordFrame(2, 'bar'),
      statusFrame(3, 'completed'),
      recordFrame(4, 'order_filled'), // never reached: terminal stops the drain
    ];
    const client = {
      streamBacktestEvents: () => (async function* () { for (const frame of frames) yield frame; })(),
    };
    const seen: number[] = [];
    const state = await collectRunLog(client, 'run-1', { onState: (s) => seen.push(s.lines.length) });
    expect(state.lines).toEqual(['#1 status: running', '#2 bar', '#3 status: completed']);
    expect(state.terminal).toBe('completed');
    expect(state.lastSeq).toBe(3);
    expect(seen).toEqual([1, 2, 3]);
  });

  it('resolves the gathered log when the route fails, without throwing', async () => {
    const client = {
      streamBacktestEvents: () =>
        (async function* () {
          yield statusFrame(1, 'running');
          throw new Error('404 route missing');
        })(),
    };
    const state = await collectRunLog(client, 'run-x');
    expect(state.lines).toHaveLength(2);
    expect(state.lines[1]).toContain('404 route missing');
    expect(state.terminal).toBe('failed');
  });

  it('stops when aborted before the first frame', async () => {
    const controller = new AbortController();
    controller.abort();
    const client = {
      streamBacktestEvents: (_id: string, _q?: unknown, signal?: AbortSignal) =>
        (async function* () {
          if (signal?.aborted) return;
          yield statusFrame(1, 'completed');
        })(),
    };
    const state = await collectRunLog(client, 'run-1', { signal: controller.signal });
    expect(state.lines).toEqual([]);
    expect(state.terminal).toBeNull();
  });

  it('honours maxFrames so a long run cannot flood the drawer', async () => {
    const client = {
      streamBacktestEvents: () =>
        (async function* () {
          for (let i = 1; i <= 100; i += 1) yield recordFrame(i, 'bar');
        })(),
    };
    const state = await collectRunLog(client, 'run-1', { maxFrames: 5 });
    expect(state.lines).toHaveLength(5);
    expect(state.lines[4]).toBe('#5 bar');
  });
});
