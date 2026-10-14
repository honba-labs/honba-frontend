import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HonbaClient } from '../api/generated/client';
import type { ResponseEnvelope } from '../types/generated/domain';
import { defaultGraph, useDesignerStore } from './store';

function jsonFetch(body: unknown): typeof fetch {
  return (async () => ({ ok: true, status: 200, json: async () => body })) as unknown as typeof fetch;
}

function errorFetch(): typeof fetch {
  return (async () => ({
    ok: false,
    status: 500,
    json: async () => ({}),
  })) as unknown as typeof fetch;
}

const irEnvelope: ResponseEnvelope<unknown> = { api_version: '1.0.0', schema_version: 4, data: { ok: true } };

const runEnvelope: ResponseEnvelope<unknown> = {
  api_version: '1.0.0',
  schema_version: 4,
  data: { run_id: '01ARZ3NDEKTSV4RRFFQ69G5FAV', status: 'completed', metrics: { trades: 2 } },
};

beforeEach(() => {
  useDesignerStore.setState({
    tab: 'canvas',
    graph: defaultGraph(),
    code: '',
    codeEdited: false,
    verify: { ok: false, issues: [], ir: null },
    run: { status: 'idle', runId: null, response: null, error: null },
    assistant: [],
    versions: [],
  });
});

describe('Verify / Run flows', () => {
  it('verifies a valid graph through the generated client', async () => {
    const client = new HonbaClient({ baseUrl: 'http://localhost/api/v1', fetch: jsonFetch(irEnvelope) });
    const state = useDesignerStore.getState();
    await state.setGraph(state.graph);
    await useDesignerStore.getState().verifyNow(client);
    const verify = useDesignerStore.getState().verify;
    expect(verify.ok).toBe(true);
    expect(verify.issues).toEqual([]);
  });

  it('short-circuits verify on a graph error without calling the API', async () => {
    const spy = vi.fn(jsonFetch(irEnvelope));
    const client = new HonbaClient({ baseUrl: 'http://localhost/api/v1', fetch: spy });
    await useDesignerStore.getState().setGraph({ ...defaultGraph(), name: '  ' });
    await useDesignerStore.getState().verifyNow(client);
    const verify = useDesignerStore.getState().verify;
    expect(verify.ok).toBe(false);
    expect(verify.issues[0].code).toBe('empty_name');
    expect(spy).not.toHaveBeenCalled();
  });

  it('reports a failed verify round-trip as an issue', async () => {
    const client = new HonbaClient({ baseUrl: 'http://localhost/api/v1', fetch: errorFetch() });
    const state = useDesignerStore.getState();
    await state.setGraph(state.graph);
    await useDesignerStore.getState().verifyNow(client);
    const verify = useDesignerStore.getState().verify;
    expect(verify.ok).toBe(false);
    expect(verify.issues[0].code).toBe('verify_failed');
  });

  it('submits a run and stores the handle and response', async () => {
    const client = new HonbaClient({ baseUrl: 'http://localhost/api/v1', fetch: jsonFetch(runEnvelope) });
    await useDesignerStore.getState().runNow(client, { seed: 42 });
    const run = useDesignerStore.getState().run;
    expect(run.status).toBe('completed');
    expect(run.runId).toBe('01ARZ3NDEKTSV4RRFFQ69G5FAV');
    expect(run.response?.metrics).toBeDefined();
  });

  it('stores a failed run with its error', async () => {
    const client = new HonbaClient({ baseUrl: 'http://localhost/api/v1', fetch: errorFetch() });
    await useDesignerStore.getState().runNow(client, { seed: 42 });
    const run = useDesignerStore.getState().run;
    expect(run.status).toBe('failed');
    expect(run.error).toContain('500');
  });

  it('snapshots and restores graph versions by hash', async () => {
    const state = useDesignerStore.getState();
    await state.setGraph(state.graph);
    await useDesignerStore.getState().snapshotVersion();
    const versions = useDesignerStore.getState().versions;
    expect(versions).toHaveLength(1);
    expect(versions[0].hash).toMatch(/^sha256:/);
    await useDesignerStore.getState().setGraph({ ...defaultGraph(), name: 'changed' });
    await useDesignerStore.getState().restoreVersion(versions[0].hash);
    expect(useDesignerStore.getState().graph.name).toBe('sma_cross');
  });
});
