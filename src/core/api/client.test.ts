import { describe, expect, it } from 'vitest';

import type { Capabilities, ResponseEnvelope } from '../types/generated/domain';
import { apiUrl, HonbaApiError, HonbaClient, request } from './generated/client';

// E11-S6 / E9-S8: the generated client must line up with the generated domain
// types. The typed assignment below is a compile-time contract check — `tsc`
// fails if the client's `getCapabilities` stops returning
// `Promise<ResponseEnvelope<Capabilities>>`.

const capabilities: Capabilities = {
  capabilities: {
    adapters: [],
    crates: [],
    endpoints: [],
    features: {},
    market_packs: [],
    toolsets: [],
  },
};

const envelope: ResponseEnvelope<Capabilities> = {
  api_version: '1.0.0',
  schema_version: 4,
  data: capabilities,
};

function jsonFetch(body: unknown, init?: { ok?: boolean; status?: number }): typeof fetch {
  return (async () => ({
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
  })) as unknown as typeof fetch;
}

describe('generated HonbaClient', () => {
  it('unwraps a typed ResponseEnvelope<Capabilities> from GET /capabilities', async () => {
    const client = new HonbaClient({
      baseUrl: 'http://localhost/api/v1',
      fetch: jsonFetch(envelope),
    });
    const result = await client.getCapabilities();
    const typed: ResponseEnvelope<Capabilities> = result;
    expect(typed.data?.capabilities.crates).toEqual([]);
  });

  it('builds query strings and interpolates path parameters', () => {
    const url = apiUrl('http://localhost/api/v1', '/bars/INFY', { tf: '1m', from: null });
    expect(url).toBe('http://localhost/api/v1/bars/INFY?tf=1m');
  });

  it('throws a HonbaApiError on a non-2xx response', async () => {
    const client = new HonbaClient({
      baseUrl: 'http://localhost/api/v1',
      fetch: jsonFetch({ error: 'boom' }, { ok: false, status: 500 }),
    });
    await expect(client.getHealth()).rejects.toBeInstanceOf(HonbaApiError);
  });

  it('exposes the generic request<T> helper', async () => {
    const result = await request<Capabilities>(
      jsonFetch(envelope),
      'GET',
      'http://localhost/api/v1/capabilities',
    );
    expect(result.data?.capabilities).toBeDefined();
  });
});
