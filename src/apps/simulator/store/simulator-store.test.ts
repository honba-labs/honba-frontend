import { describe, expect, it, vi } from 'vitest';

import type { BacktestResponse } from '../../../core/types/generated/domain';
import { STRATEGY_TEMPLATES } from '../../../core/designer/strategy-templates';
import type { RunClient } from '../../../core/simulator/run';

import { createSimulatorStore } from './simulator-store';

const TEMPLATE = STRATEGY_TEMPLATES[0].graph;

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
});
