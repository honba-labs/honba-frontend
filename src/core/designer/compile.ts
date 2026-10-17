import { toManifest } from './manifest';
import type { StrategyGraphShape } from '../graph/model';
import type { CompiledStrategy, StrategiesRequest } from '../types/generated/domain';

/**
 * Compile-before-run (Phase 6, contract gap).
 *
 * A backtest's `strategy` is resolved against the compiled-session catalogue or
 * the registered Rust strategies (`resolve_strategy`, ADR 0017 decision 6), so a
 * Designer graph must be registered with `POST /strategies` before it can run.
 * This step is feature-detected: a client without `postStrategies` (offline
 * build, older server) runs by the graph's own name exactly as before, so the
 * seam is additive.
 */

/** The slice of the generated client the compile step needs (narrow for mocking). */
export interface StrategyCompiler {
  postStrategies?(
    body: StrategiesRequest,
    signal?: AbortSignal,
  ): Promise<{ data?: CompiledStrategy | null }>;
}

export interface CompileResult {
  /** The id to submit the run with: the compiled id, else the graph's own name. */
  strategyId: string;
  /** Whether `POST /strategies` registered the graph with the server. */
  compiled: boolean;
  /** Set when compilation was attempted and failed; the caller decides how to surface it. */
  error: string | null;
}

/**
 * Register `graph` with the server and return the id to run with.
 *
 * Never throws: a client without a compiler degrades to running by the graph's
 * name, and a rejected compile is reported in `error` for the caller. Only a
 * graph whose name matches a registered Rust implementation (`sma_crossover`,
 * `buy_and_hold`, `rsi_reversal`) reaches `completed`; any other name is refused
 * at run time with `no_rust_implementation`.
 */
export async function compileStrategy(
  client: StrategyCompiler | null | undefined,
  graph: StrategyGraphShape,
  options: { signal?: AbortSignal } = {},
): Promise<CompileResult> {
  const post = typeof client?.postStrategies === 'function' ? client.postStrategies.bind(client) : undefined;
  if (!post) {
    return { strategyId: graph.name, compiled: false, error: null };
  }
  try {
    const envelope = await post({ manifest: toManifest(graph) }, options.signal);
    const id = envelope.data?.id;
    if (!id) {
      // A 2xx without an id is unexpected (a live server always returns one); degrade
      // to running by name rather than blocking on a malformed response.
      return { strategyId: graph.name, compiled: false, error: null };
    }
    return { strategyId: id, compiled: true, error: null };
  } catch (error) {
    return {
      strategyId: graph.name,
      compiled: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
