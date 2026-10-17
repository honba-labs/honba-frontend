import { describe, expect, it, vi } from 'vitest';

import type { BacktestResponse, RunStatus } from '../types/generated/domain';

import {
  applyRunError,
  applyRunResponse,
  foldStatus,
  initialRunState,
  isTerminalStatus,
  runBacktest,
  type RunClient,
} from './run';

const REQUEST = { strategy: 'sma', universe: 'TCS.NSE', start: '2024-01-01', end: '2024-06-01', seed: 1 };

function response(runId: string, status: RunStatus, extra: Partial<BacktestResponse> = {}): BacktestResponse {
  return { run_id: runId, status, ...extra };
}

function ok(data: BacktestResponse) {
  return Promise.resolve({ data });
}

function mockClient(submits: BacktestResponse, polls: BacktestResponse[]): { client: RunClient; poll: ReturnType<typeof vi.fn> } {
  const queue = [...polls];
  const poll = vi.fn(() => ok(queue.shift() ?? response('run-1', 'completed')));
  const client: RunClient = {
    postBacktests: vi.fn(() => ok(submits)),
    getBacktestsById: poll,
  };
  return { client, poll };
}

const noSleep = () => Promise.resolve();

describe('simulator run — status folding', () => {
  it('folds pending/running into running and keeps the terminal states', () => {
    expect(foldStatus('pending')).toBe('running');
    expect(foldStatus('running')).toBe('running');
    expect(foldStatus('completed')).toBe('completed');
    expect(foldStatus('cancelled')).toBe('cancelled');
    expect(foldStatus('failed')).toBe('failed');
    expect(foldStatus(null)).toBe('idle');
  });

  it('knows the terminal statuses', () => {
    expect(isTerminalStatus('completed')).toBe(true);
    expect(isTerminalStatus('failed')).toBe(true);
    expect(isTerminalStatus('running')).toBe(false);
  });

  it('records a server error on the response as a failure', () => {
    const next = applyRunResponse(
      { ...initialRunState(), status: 'running' },
      response('run-9', 'running', { error: { code: 'validation_invalid_request', message: 'bad', retryable: false } }),
    );
    expect(next.status).toBe('failed');
    expect(next.error).toContain('validation_invalid_request');
    expect(next.runId).toBe('run-9');
  });

  it('captures thrown errors as a failed run', () => {
    const next = applyRunError({ ...initialRunState(), status: 'running' }, new Error('offline'));
    expect(next.status).toBe('failed');
    expect(next.error).toBe('offline');
    expect(next.logs.at(-1)).toContain('offline');
  });
});

describe('simulator run — polling loop', () => {
  it('does not poll when the submit is already terminal', async () => {
    const { client, poll } = mockClient(response('run-1', 'completed', { metrics: { max_drawdown: 0.1, net_pnl: 5, sharpe: 1, total_return: 0.05, trades: 2 } }), []);
    const state = await runBacktest(client, REQUEST, { sleep: noSleep });
    expect(poll).not.toHaveBeenCalled();
    expect(state.status).toBe('completed');
    expect(state.runId).toBe('run-1');
    expect(state.response?.metrics?.trades).toBe(2);
  });

  it('polls pending → running → completed and logs the transitions', async () => {
    const { client, poll } = mockClient(response('run-2', 'pending'), [
      response('run-2', 'running'),
      response('run-2', 'completed'),
    ]);
    const seen: string[] = [];
    const state = await runBacktest(client, REQUEST, {
      sleep: noSleep,
      onUpdate: (s) => seen.push(s.status),
    });
    expect(poll).toHaveBeenCalledTimes(2);
    expect(state.status).toBe('completed');
    expect(seen).toEqual(['running', 'running', 'running', 'completed']);
    expect(state.logs.some((l) => l.includes('Run run-2 → completed'))).toBe(true);
  });

  it('fails loudly instead of hanging when the poll cap is reached', async () => {
    const { client } = mockClient(response('run-3', 'running'), [
      response('run-3', 'running'),
      response('run-3', 'running'),
    ]);
    const state = await runBacktest(client, REQUEST, { sleep: noSleep, maxPolls: 2 });
    expect(state.status).toBe('failed');
    expect(state.error).toContain('did not finish');
  });

  it('surfaces a submit transport failure', async () => {
    const client: RunClient = {
      postBacktests: vi.fn(() => Promise.reject(new Error('network down'))),
      getBacktestsById: vi.fn(() => ok(response('x', 'completed'))),
    };
    const state = await runBacktest(client, REQUEST, { sleep: noSleep });
    expect(state.status).toBe('failed');
    expect(state.error).toBe('network down');
  });
});
