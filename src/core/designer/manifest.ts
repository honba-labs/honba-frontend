import { graphHashSync, type StrategyGraphShape } from '../graph/model';
import type { BarAggregation, StrategyManifest, TimeframeSpec } from '../types/generated/domain';

/**
 * The wire manifest for a graph (Phase 6).
 *
 * The graph is authoritative; the manifest is its projection into the shape the
 * verifier and the compiler accept. Shared by the Designer's verify/run actions
 * and the Simulator's compile-before-run step, so both send byte-identical
 * manifests and the same `source_hash`.
 */
export function toManifest(graph: StrategyGraphShape): StrategyManifest {
  const explicit = (graph.universe.explicit ?? []).map((entry) => ({
    symbol: entry.symbol,
    exchange: entry.exchange,
  }));
  const universe = graph.universe.named ? { named: graph.universe.named } : { explicit };
  const driving_timeframe: TimeframeSpec = {
    aggregation: graph.driving_timeframe.aggregation as BarAggregation,
    interval: graph.driving_timeframe.interval,
  };
  return {
    api_version: '1.0.0',
    name: graph.name,
    source_hash: graphHashSync(graph),
    universe,
    subscriptions: {
      instruments: explicit,
      quotes: graph.subscriptions?.quotes ?? false,
      trades: graph.subscriptions?.trades ?? false,
    },
    driving_timeframe,
    warmup_bars: graph.warmup_bars,
  };
}
