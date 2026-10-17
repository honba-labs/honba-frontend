import { afterEach, describe, expect, it, vi } from 'vitest';

import { generateCode } from '../graph/codegen';
import { catalogue } from '../graph/catalogue';
import { canonicalJson, graphHashSync, type StrategyGraphShape } from '../graph/model';
import { defaultGraph } from './store';
import { GRAPH_SMA_CROSS } from './fixtures';
import {
  createSyncScheduler,
  findUnbalancedLine,
  parseKeywordArguments,
  recognizeGeneratedSource,
  type RecognitionResult,
} from './code-to-graph';

function roundTrip(graph: StrategyGraphShape): StrategyGraphShape {
  const source = generateCode(graph, graphHashSync(graph));
  const result = recognizeGeneratedSource(source);
  expect(result.graph, 'recogniser should recover the generated graph').not.toBeNull();
  return result.graph as StrategyGraphShape;
}

function indicatorGraph(kind: string, defaults: Record<string, unknown>): StrategyGraphShape {
  return {
    schema_version: 1,
    name: `probe_${kind}`,
    universe: { explicit: [{ symbol: 'TCS', exchange: 'NSE' }] },
    driving_timeframe: { interval: 5, aggregation: 'minute' },
    warmup_bars: 3,
    subscriptions: { quotes: true, trades: false },
    nodes: [{ id: 'n1', type: 'universe', label: 'Universe' }, { id: 'i', type: 'indicator', indicator: kind, label: kind.toUpperCase(), params: defaults }],
    edges: [{ id: 'e1', from_node: 'n1', from_port: 'bars', to_node: 'i', to_port: 'input' }],
  };
}

describe('code -> graph recognition (Phase 3)', () => {
  it('round-trips the frozen default graph byte-for-byte', () => {
    expect(canonicalJson(roundTrip(GRAPH_SMA_CROSS))).toBe(canonicalJson(GRAPH_SMA_CROSS));
  });

  it('round-trips every catalogue indicator with its default parameters', () => {
    const entries = catalogue().indicators;
    expect(entries.length).toBeGreaterThanOrEqual(9);
    for (const entry of entries) {
      const defaults: Record<string, unknown> = {};
      entry.params.forEach((p) => {
        defaults[p.name] = p.defaultValue;
      });
      const graph = indicatorGraph(entry.kind, defaults);
      expect(canonicalJson(roundTrip(graph)), `${entry.kind} round-trip`).toBe(canonicalJson(graph));
    }
  });

  it('reports an unterminated call as a syntax_error span (graph held)', () => {
    const source = `# honba:strategy-graph:v1\nGRAPH = (\n    _graph.StrategyGraph.build(\n`;
    const result = recognizeGeneratedSource(source);
    expect(result.graph).toBeNull();
    expect(result.spans[0]?.reason).toBe('syntax_error');
    expect(result.codeOnly).toBe(false);
  });

  it('flags source with no builder block as code_only over the whole file', () => {
    const result = recognizeGeneratedSource('x = 1\ny = 2\n');
    expect(result.graph).toBeNull();
    expect(result.codeOnly).toBe(true);
    expect(result.spans).toEqual([{ start_line: 1, end_line: 3, reason: 'no strategy graph builder block' }]);
  });

  it('reports hand-written additions outside the generated subset as spans', () => {
    const generated = generateCode(GRAPH_SMA_CROSS, graphHashSync(GRAPH_SMA_CROSS));
    const withEdit = `${generated}\n\ndef my_helper(bar):\n    return bar.close\n`;
    const result = recognizeGeneratedSource(withEdit);
    expect(result.graph).not.toBeNull();
    expect(result.spans.length).toBeGreaterThan(0);
    expect(result.codeOnly).toBe(false);
  });

  it('parses python literals including nested dicts, lists, bools and None', () => {
    expect(parseKeywordArguments('a=1, b="x", c=True, d=None, e=[1, 2], f={"k": {"n": [3]}}')).toEqual({
      a: 1,
      b: 'x',
      c: true,
      d: null,
      e: [1, 2],
      f: { k: { n: [3] } },
    });
  });

  it('findUnbalancedLine locates the offending line and ignores balanced source', () => {
    expect(findUnbalancedLine('a = (1, 2)\n')).toBeNull();
    expect(findUnbalancedLine('a = (1, 2\n')).toBe(2);
  });
});

describe('sync scheduler (Phase 3)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function schedulerWith(spy: (r: RecognitionResult, s: string) => void, recognize = (source: string) => recognizeGeneratedSource(source)) {
    return createSyncScheduler({ recognize, onResult: spy, debounceMs: 300 });
  }

  it('debounces bursts into a single recognition of the latest source', async () => {
    vi.useFakeTimers();
    const onResult = vi.fn();
    const scheduler = schedulerWith(onResult);
    scheduler.schedule('a');
    scheduler.schedule('b');
    scheduler.schedule('c');
    expect(onResult).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult.mock.calls[0][1]).toBe('c');
  });

  it('coalesces by aborting the in-flight run when a newer source arrives', async () => {
    vi.useFakeTimers();
    const results: string[] = [];
    const deferred: { resolve: ((value: RecognitionResult) => void) | null } = { resolve: null };
    const recognize = (source: string): Promise<RecognitionResult> => {
      if (source === 'slow') {
        return new Promise((resolve) => {
          deferred.resolve = resolve;
        });
      }
      return Promise.resolve({ graph: null, codeOnly: true, spans: [] });
    };
    const scheduler = createSyncScheduler({
      recognize,
      onResult: (_r, source) => results.push(source),
      debounceMs: 10,
    });

    scheduler.schedule('slow');
    await vi.advanceTimersByTimeAsync(10);
    scheduler.schedule('fast');
    await vi.advanceTimersByTimeAsync(10);
    // The first (slow) run resolves late; it must be dropped.
    deferred.resolve?.({ graph: null, codeOnly: true, spans: [] });
    await vi.advanceTimersByTimeAsync(0);
    expect(results).toEqual(['fast']);
  });

  it('does not re-recognise an unchanged source', async () => {
    vi.useFakeTimers();
    const onResult = vi.fn();
    const scheduler = schedulerWith(onResult);
    scheduler.schedule('same');
    await vi.advanceTimersByTimeAsync(300);
    scheduler.schedule('same');
    await vi.advanceTimersByTimeAsync(300);
    expect(onResult).toHaveBeenCalledTimes(1);
  });

  it('cancel drops queued work', async () => {
    vi.useFakeTimers();
    const onResult = vi.fn();
    const scheduler = schedulerWith(onResult);
    scheduler.schedule('x');
    scheduler.cancel();
    await vi.advanceTimersByTimeAsync(300);
    expect(onResult).not.toHaveBeenCalled();
  });
});
