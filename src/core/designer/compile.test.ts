import { describe, expect, it, vi } from 'vitest';

import type { StrategiesRequest } from '../types/generated/domain';

import { defaultGraph } from './store';
import { compileStrategy, type StrategyCompiler } from './compile';

/**
 * Compile-before-run (Phase 6 contract gap).
 *
 * `compileStrategy` registers a graph with `POST /strategies` and returns the id
 * to run with. The seam is feature-detected: no compiler means run by name, and a
 * rejected compile is reported (never thrown) for the caller to surface.
 */

function graph() {
  return { ...defaultGraph(), name: 'sma_crossover' };
}

describe('compileStrategy', () => {
  it('registers the graph and returns the compiled id when the client can compile', async () => {
    const post = vi.fn(async (_body: StrategiesRequest) => ({ data: { id: 'sha256:abc', ir: {} } }));
    const client = { postStrategies: post } as unknown as StrategyCompiler;

    const result = await compileStrategy(client, graph());

    expect(result).toMatchObject({ strategyId: 'sha256:abc', compiled: true, error: null });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0]?.[0].manifest.name).toBe('sma_crossover');
  });

  it('falls back to the graph name when the client has no compiler', async () => {
    const result = await compileStrategy({} as StrategyCompiler, graph());
    expect(result).toEqual({ strategyId: 'sma_crossover', compiled: false, error: null });
  });

  it('reports a rejected compile without throwing', async () => {
    const client = {
      postStrategies: vi.fn(async () => {
        throw new Error('POST /strategies failed with 422');
      }),
    } as unknown as StrategyCompiler;

    const result = await compileStrategy(client, graph());
    expect(result.compiled).toBe(false);
    expect(result.strategyId).toBe('sma_crossover');
    expect(result.error).toContain('422');
  });

  it('degrades to run-by-name when a 2xx carries no id', async () => {
    const client = {
      postStrategies: vi.fn(async () => ({ data: null })),
    } as unknown as StrategyCompiler;

    const result = await compileStrategy(client, graph());
    expect(result).toEqual({ strategyId: 'sma_crossover', compiled: false, error: null });
  });
});
