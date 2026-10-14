import { beforeEach, describe, expect, it } from 'vitest';

import { HonbaClient } from '../api/generated/client';
import type { ResponseEnvelope } from '../types/generated/domain';
import { localJobStorage, makeJob, memoryStorage, upsertJobs, type DesignerJob } from './jobs';
import { useJobsStore } from './jobs-store';
import {
  closedRoundTrips,
  drawdownSeries,
  equityFromCurve,
  maxDrawdownPct,
  runModeBadge,
  trustBadges,
} from './ops';
import { useOpsStore } from './ops-state';

function jsonFetch(body: unknown): typeof fetch {
  return (async () => ({ ok: true, status: 200, json: async () => body })) as unknown as typeof fetch;
}

const ordersEnvelope: ResponseEnvelope<unknown> = {
  api_version: '1.0.0',
  schema_version: 4,
  data: { orders: [{ order_id: 'o1', instrument_id: { symbol: 'TCS', exchange: 'NSE' }, side: 'buy', order_type: 'market', quantity: 1, status: 'accepted', ts_event: { iso: '', unix_nanos: '0' }, ts_init: { iso: '', unix_nanos: '0' } }] },
};

beforeEach(() => {
  useOpsStore.setState({
    mode: 'paper',
    killSwitch: false,
    approved: true,
    positions: [],
    orders: [],
    executions: [],
    decisions: [],
    log: [],
    error: null,
  });
  useJobsStore.getState().useStorage(memoryStorage());
  useJobsStore.setState({ jobs: [] });
});

describe('S6 ops controls', () => {
  it('badges run modes and blocks unapproved live', () => {
    expect(runModeBadge('paper').blocked).toBe(false);
    expect(runModeBadge('live', { killSwitch: true }).blocked).toBe(true);
    expect(runModeBadge('live', { killSwitch: false, approved: false }).blocked).toBe(true);
    expect(runModeBadge('live', { killSwitch: false, approved: true }).blocked).toBe(false);
    expect(() => runModeBadge('nope')).toThrow();
  });

  it('refreshes orders through the generated client', async () => {
    const client = new HonbaClient({ baseUrl: 'http://localhost/api/v1', fetch: jsonFetch(ordersEnvelope) });
    await useOpsStore.getState().refresh(client);
    expect(useOpsStore.getState().orders).toHaveLength(1);
    expect(useOpsStore.getState().error).toBeNull();
  });

  it('cancels an order by id', async () => {
    const client = new HonbaClient({ baseUrl: 'http://localhost/api/v1', fetch: jsonFetch(ordersEnvelope) });
    await useOpsStore.getState().refresh(client);
    await useOpsStore.getState().cancelOrder(client, 'o1');
    expect(useOpsStore.getState().orders).toHaveLength(0);
  });

  it('closes positions and logs the action', async () => {
    const envelope: ResponseEnvelope<unknown> = {
      api_version: '1.0.0',
      schema_version: 4,
      data: { positions: [] },
    };
    const client = new HonbaClient({ baseUrl: 'http://localhost/api/v1', fetch: jsonFetch(envelope) });
    await useOpsStore.getState().closePositions(client);
    expect(useOpsStore.getState().log.at(-1)?.text).toContain('close-all');
  });
});

describe('S7 views and persisted jobs', () => {
  it('computes trust badges, drawdown and round trips purely', () => {
    const badges = trustBadges({ passed: true, dsr: { passed: true }, pbo: { passed: false } });
    expect(badges.map((b) => b.key)).toEqual(['dsr', 'pbo']);
    expect(drawdownSeries([100, 120, 90, 150])).toEqual([0, 0, 25, 0]);
    expect(maxDrawdownPct([100, 120, 90])).toBe(25);
    expect(equityFromCurve([[1, 10], [2, 20]])).toEqual({ ts: [1, 2], equity: [10, 20] });
    expect(closedRoundTrips([{ quantity: 1, side: 'buy' }, { quantity: 1, side: 'sell' }])).toBe(1);
    expect(trustBadges(null)).toEqual([]);
  });

  it('enqueues, runs and completes jobs against injected storage', () => {
    const storage = memoryStorage();
    useJobsStore.getState().useStorage(storage);
    const store = useJobsStore.getState();
    const job = store.enqueue('sweep', 'period grid', { period: [2, 4] });
    expect(job.status).toBe('queued');
    useJobsStore.getState().markRunning(job.id, 'job-1');
    useJobsStore.getState().complete(job.id, { best: 1 });
    const done = useJobsStore.getState().jobs.find((j) => j.id === job.id);
    expect(done?.status).toBe('completed');
    expect((done?.result as { best: number }).best).toBe(1);
    expect(useJobsStore.getState().pending()).toHaveLength(0);
  });

  it('persists jobs so a returning session sees them (leave-and-return)', () => {
    const jobs: DesignerJob[] = [makeJob('walk_forward', 'wf', {}, () => 7, () => 0.5)];
    const first = localJobStorage('missing-in-node');
    expect(first.load()).toEqual([]);
    const mem = memoryStorage(jobs);
    expect(mem.load()).toHaveLength(1);
    const merged = upsertJobs([], mem.load()[0]);
    expect(merged).toHaveLength(1);
  });
});
