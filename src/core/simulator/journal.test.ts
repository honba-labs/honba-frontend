import { describe, expect, it, vi } from 'vitest';

import type { Trade, TradesResponse } from '../types/generated/domain';

import { applyJournalError, applyJournalLoading, applyJournalResponse, hasJournalClient, initialJournalState, loadJournal, type JournalClient } from './journal';

const trade: Trade = {
  costs: { amount: 1, currency: 'INR' },
  instrument_id: { symbol: 'TCS', exchange: 'NSE' },
  order_id: 'o-1',
  price: 100,
  quantity: 10,
  side: 'buy',
  ts_event: { iso: '2024-01-02T03:45:00Z', unix_nanos: '1704167100000000000' },
  ts_init: { iso: '2024-01-02T03:45:00Z', unix_nanos: '1704167100000000000' },
};

function client(response: TradesResponse): JournalClient {
  return { getBacktestsByIdJournal: vi.fn(async () => ({ data: response })) };
}

describe('journal state', () => {
  it('starts idle and empty', () => {
    expect(initialJournalState()).toEqual({ status: 'idle', runId: null, trades: [], error: null });
  });

  it('drops a response that belongs to an older run', () => {
    const loading = applyJournalLoading(initialJournalState(), 'run-2');
    expect(applyJournalResponse(loading, 'run-1', [trade])).toBe(loading);
    expect(applyJournalError(loading, 'run-1', new Error('late'))).toBe(loading);
  });

  it('only accepts a response while the same run is loading', () => {
    const current = applyJournalLoading(initialJournalState(), 'run-1');
    expect(applyJournalResponse(current, 'run-1', [trade]).status).toBe('ready');
    const failed = applyJournalError(current, 'run-1', new Error('x'));
    expect(failed.status).toBe('error');
    expect(failed.runId).toBe('run-1');
    expect(current.status).toBe('loading'); // the input state is never mutated
  });
});

describe('loadJournal', () => {
  it('fetches the fills of a run', async () => {
    const state = await loadJournal(client({ trades: [trade] }), 'run-1');
    expect(state).toEqual({ status: 'ready', runId: 'run-1', trades: [trade], error: null });
  });

  it('tolerates a missing trades array and a missing data envelope', async () => {
    const empty: JournalClient = { getBacktestsByIdJournal: vi.fn(async () => ({})) };
    expect((await loadJournal(empty, 'run-1')).trades).toEqual([]);
    expect((await loadJournal(client({ trades: [] }), 'run-1')).trades).toEqual([]);
  });

  it('turns a transport failure into a visible error state, not a throw', async () => {
    const failing: JournalClient = {
      getBacktestsByIdJournal: vi.fn(async () => {
        throw new Error('journal_unavailable');
      }),
    };
    const state = await loadJournal(failing, 'run-1');
    expect(state.status).toBe('error');
    expect(state.error).toContain('journal_unavailable');
  });

  it('feature-detects the route so a client without it is reported, not crashed', () => {
    expect(hasJournalClient({})).toBe(false);
    expect(hasJournalClient(null)).toBe(false);
    expect(hasJournalClient({ getBacktestsByIdJournal: () => {} })).toBe(true);
  });
});
