import { describe, expect, it, vi } from 'vitest';

import type { BacktestResponse, Trade } from '../../../core/types/generated/domain';
import { STRATEGY_TEMPLATES } from '../../../core/designer/strategy-templates';
import type { RunClient } from '../../../core/simulator/run';

import { createSimulatorStore } from './simulator-store';

const TEMPLATE = STRATEGY_TEMPLATES[0].graph;

const FILL: Trade = {
  costs: { amount: 1, currency: 'INR' },
  instrument_id: { symbol: 'TCS', exchange: 'NSE' },
  order_id: 'o-1',
  price: 3400,
  quantity: 10,
  side: 'buy',
  ts_event: { iso: '2024-01-02T03:45:00Z', unix_nanos: '1704167100000000000' },
  ts_init: { iso: '2024-01-02T03:45:00Z', unix_nanos: '1704167100000000000' },
};

function handoff() {
  return { name: TEMPLATE.name, graph: TEMPLATE, source: 'designer' as const, timestamp: 0 };
}

function clientWith(...responses: BacktestResponse[]): RunClient {
  const queue = [...responses];
  return {
    postBacktests: vi.fn(() => Promise.resolve({ data: queue.shift() ?? null })),
    getBacktestsById: vi.fn(() => Promise.resolve({ data: queue.shift() ?? null })),
  };
}

describe('simulator store', () => {
  it('hydrates from the Designer hand-off and pre-fills the controls', () => {
    const store = createSimulatorStore();
    store.getState().hydrate({ query: `?strategy=${TEMPLATE.name}&source=designer`, handoff: handoff() });
    const state = store.getState();
    expect(state.origin).toBe('designer');
    expect(state.strategyName).toBe(TEMPLATE.name);
    expect(state.controls.symbol).toBe('TCS');
    expect(state.controls.exchange).toBe('NSE');
    expect(state.lastPlan).toBeNull();
  });

  it('builds the run plan from the panel and the strategy universe', () => {
    const store = createSimulatorStore();
    store.getState().hydrate({ query: `?strategy=${TEMPLATE.name}&source=designer`, handoff: handoff() });
    store.getState().setControls({ capital: 250_000, timeframe: '5m' });
    const plan = store.getState().plan();
    expect(plan.request.strategy).toBe(TEMPLATE.name);
    expect(plan.request.universe).toBe('TCS.NSE');
    expect(plan.request.initial_capital).toBe(250_000);
    expect(plan.issues).toEqual([]);
  });

  it('runs to completion and records the response', async () => {
    const store = createSimulatorStore();
    store.getState().hydrate({ query: `?strategy=${TEMPLATE.name}&source=designer`, handoff: handoff() });
    const client = clientWith(
      { run_id: 'run-1', status: 'running' },
      { run_id: 'run-1', status: 'completed', metrics: { max_drawdown: 0.1, net_pnl: 10, sharpe: 1.2, total_return: 0.01, trades: 3 } },
    );
    await store.getState().execute(client, { sleep: () => Promise.resolve() });
    const { run } = store.getState();
    expect(run.status).toBe('completed');
    expect(run.runId).toBe('run-1');
    expect(run.response?.metrics?.trades).toBe(3);
  });

  it('refuses to run an incomplete panel', async () => {
    const store = createSimulatorStore();
    store.getState().hydrate({ query: `?strategy=${TEMPLATE.name}&source=designer`, handoff: handoff() });
    store.getState().setControls({ symbol: '' });
    const client = clientWith({ run_id: 'run-x', status: 'completed' });
    await store.getState().execute(client);
    expect(store.getState().run.status).toBe('failed');
    expect(client.postBacktests).not.toHaveBeenCalled();
  });

  it('compiles the strategy first and submits the run with the compiled id', async () => {
    const store = createSimulatorStore();
    store.getState().hydrate({ query: `?strategy=${TEMPLATE.name}&source=designer`, handoff: handoff() });
    const postStrategies = vi.fn(() => Promise.resolve({ data: { id: 'sha256:compiled', ir: {} } }));
    const postBacktests = vi.fn(() => Promise.resolve({ data: { run_id: 'run-2', status: 'completed' } }));
    const client = {
      postStrategies,
      postBacktests,
      getBacktestsById: vi.fn(),
    } as unknown as RunClient;

    await store.getState().execute(client, { sleep: () => Promise.resolve() });

    expect(postStrategies).toHaveBeenCalledTimes(1);
    expect(postBacktests).toHaveBeenCalledWith(
      expect.objectContaining({ strategy: 'sha256:compiled' }),
      undefined,
    );
    expect(store.getState().run.status).toBe('completed');
  });

  it('surfaces a compile failure and does not submit a run', async () => {
    const store = createSimulatorStore();
    store.getState().hydrate({ query: `?strategy=${TEMPLATE.name}&source=designer`, handoff: handoff() });
    const postBacktests = vi.fn();
    const client = {
      postStrategies: vi.fn(() => Promise.reject(new Error('POST /strategies failed with 422'))),
      postBacktests,
      getBacktestsById: vi.fn(),
    } as unknown as RunClient;

    await store.getState().execute(client);

    expect(store.getState().run.status).toBe('failed');
    expect(store.getState().run.error).toContain('Compile failed');
    expect(postBacktests).not.toHaveBeenCalled();
  });

  it('loads the fill journal once a run completes and the client exposes the route', async () => {
    const store = createSimulatorStore();
    store.getState().hydrate({ query: `?strategy=${TEMPLATE.name}&source=designer`, handoff: handoff() });
    const getBacktestsByIdJournal = vi.fn(() => Promise.resolve({ data: { trades: [FILL] } }));
    const client = {
      ...clientWith(
        { run_id: 'run-1', status: 'running' },
        { run_id: 'run-1', status: 'completed', metrics: { max_drawdown: 0.1, net_pnl: 1, sharpe: 1, total_return: 0.01, trades: 1 } },
      ),
      getBacktestsByIdJournal,
    };

    await store.getState().execute(client, { sleep: () => Promise.resolve() });

    expect(getBacktestsByIdJournal).toHaveBeenCalledWith('run-1', undefined);
    expect(store.getState().journal.status).toBe('ready');
    expect(store.getState().journal.runId).toBe('run-1');
    expect(store.getState().journal.trades).toHaveLength(1);
  });

  it('degrades quietly when the journal route is missing or fails', async () => {
    const store = createSimulatorStore();
    store.getState().hydrate({ query: `?strategy=${TEMPLATE.name}&source=designer`, handoff: handoff() });

    // Missing route: the run completes and no journal is requested.
    await store.getState().execute(
      clientWith({ run_id: 'run-1', status: 'completed' }),
      { sleep: () => Promise.resolve() },
    );
    expect(store.getState().journal.status).toBe('idle');

    // Failing route: the error is surfaced in the journal slice, not thrown.
    const failing = {
      ...clientWith({ run_id: 'run-2', status: 'completed' }),
      getBacktestsByIdJournal: vi.fn(() => Promise.reject(new Error('journal down'))),
    };
    await store.getState().execute(failing, { sleep: () => Promise.resolve() });
    expect(store.getState().journal.status).toBe('error');
    expect(store.getState().journal.error).toContain('journal down');
  });

  it('clears the previous journal when a new run starts', async () => {
    const store = createSimulatorStore();
    store.getState().hydrate({ query: `?strategy=${TEMPLATE.name}&source=designer`, handoff: handoff() });
    const withJournal = {
      postBacktests: vi.fn(async (): Promise<{ data: BacktestResponse | null }> => ({
        data: { run_id: 'run-1', status: 'completed' },
      })),
      getBacktestsById: vi.fn(),
      getBacktestsByIdJournal: vi.fn(async () => ({ data: { trades: [FILL] } })),
    };
    await store.getState().execute(withJournal, { sleep: () => Promise.resolve() });
    expect(store.getState().journal.trades).toHaveLength(1);

    // The second run's client has no journal route: the previous fills must not
    // survive the new attempt.
    await store.getState().execute(clientWith({ run_id: 'run-2', status: 'completed' }), { sleep: () => Promise.resolve() });
    expect(store.getState().journal.status).toBe('idle');
    expect(store.getState().journal.trades).toEqual([]);
  });
});
