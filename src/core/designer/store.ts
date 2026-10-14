import { create } from 'zustand';

import type { HonbaClient } from '../api/generated/client';
import type { AssistantKind, AssistantMessage } from './assistant-types';
import type {
  BacktestResponse,
  BarAggregation,
  CompiledStrategy,
  StrategyManifest,
  SweepResponse,
  TimeframeSpec,
} from '../types/generated/domain';
import { generateCode } from '../graph/codegen';
import { graphHash, graphHashSync, type StrategyGraphShape } from '../graph/model';
import { graphIssues } from '../graph/validation';

export type DesignerTab = 'canvas' | 'code' | 'verify' | 'run' | 'assistant' | 'ops' | 'results';

export interface VerifyState {
  ok: boolean;
  issues: Array<{ code: string; message: string; nodeId: string | null; lineno: number | null }>;
  ir: unknown | null;
}

export interface RunState {
  status: 'idle' | 'pending' | 'running' | 'completed' | 'failed';
  runId: string | null;
  response: BacktestResponse | null;
  error: string | null;
}

interface DesignerState {
  tab: DesignerTab;
  graph: StrategyGraphShape;
  code: string;
  codeEdited: boolean;
  verify: VerifyState;
  run: RunState;
  assistant: AssistantMessage[];
  versions: Array<{ hash: string; name: string; json: string }>;
  setTab: (tab: DesignerTab) => void;
  setGraph: (graph: StrategyGraphShape) => Promise<void> | void;
  updateNodeParams: (nodeId: string, params: Record<string, unknown>) => Promise<void> | void;
  setCode: (code: string) => void;
  snapshotVersion: () => Promise<void>;
  restoreVersion: (hash: string) => Promise<void>;
  verifyNow: (client: HonbaClient) => Promise<void>;
  runNow: (client: HonbaClient, request: { seed: number }) => Promise<void>;
  assistantSay: (text: string, kind?: AssistantKind) => void;
  resetAssistant: () => void;
}

async function buildCode(graph: StrategyGraphShape): Promise<string> {
  const hash = await graphHash(graph);
  return generateCode(graph, hash);
}

function nodeLine(source: string, nodeId: string): number | null {
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('.node(') && lines[i].includes(`id='${nodeId}'`)) return i + 1;
  }
  return null;
}

export function defaultGraph(): StrategyGraphShape {
  return {
    schema_version: 1,
    name: 'sma_cross',
    universe: { explicit: [{ symbol: 'TCS', exchange: 'NSE' }] },
    driving_timeframe: { interval: 1, aggregation: 'minute' },
    warmup_bars: 2,
    subscriptions: { quotes: false, trades: false },
    nodes: [
      { id: 'n1', type: 'universe', label: 'Universe' },
      { id: 'f', type: 'indicator', indicator: 'sma', label: 'Fast SMA', params: { period: 2 } },
      { id: 's', type: 'indicator', indicator: 'sma', label: 'Slow SMA', params: { period: 4 } },
      { id: 'c', type: 'condition', label: 'Cross', params: { op: 'crosses_above' } },
      { id: 'o', type: 'order', label: 'Entry Long', params: { side: 'buy', quantity: 1 } },
    ],
    edges: [
      { id: 'e1', from_node: 'n1', from_port: 'bars', to_node: 'f', to_port: 'input' },
      { id: 'e2', from_node: 'n1', from_port: 'bars', to_node: 's', to_port: 'input' },
      { id: 'e3', from_node: 'f', from_port: 'value', to_node: 'c', to_port: 'left' },
      { id: 'e4', from_node: 's', from_port: 'value', to_node: 'c', to_port: 'right' },
      { id: 'e5', from_node: 'c', from_port: 'signal', to_node: 'o', to_port: 'signal' },
    ],
  };
}

function toManifest(graph: StrategyGraphShape): StrategyManifest {
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

export const useDesignerStore = create<DesignerState>((set, get) => {
  const graph = defaultGraph();
  return {
    tab: 'canvas',
    graph,
    code: '',
    codeEdited: false,
    verify: { ok: false, issues: [], ir: null },
    run: { status: 'idle', runId: null, response: null, error: null },
    assistant: [],
    versions: [],

    setTab: (tab) => set({ tab }),

    setGraph: async (next) => {
      set({ graph: next, codeEdited: false, code: await buildCode(next) });
    },

    updateNodeParams: async (nodeId, params) => {
      const { graph } = get();
      const next: StrategyGraphShape = {
        ...graph,
        nodes: graph.nodes.map((node) =>
          node.id === nodeId ? { ...node, params: { ...(node.params ?? {}), ...params } } : node,
        ),
      };
      set({ graph: next, codeEdited: false, code: await buildCode(next) });
    },

    setCode: (code) => set({ code, codeEdited: true }),

    snapshotVersion: async () => {
      const { graph, versions } = get();
      const hash = await graphHash(graph);
      if (versions.some((v) => v.hash === hash)) return;
      set({ versions: [...versions, { hash, name: graph.name, json: JSON.stringify(graph) }] });
    },

    restoreVersion: async (hash) => {
      const found = get().versions.find((v) => v.hash === hash);
      if (!found) return;
      const parsed = JSON.parse(found.json) as StrategyGraphShape;
      set({ graph: parsed, codeEdited: false, code: await buildCode(parsed) });
    },

    verifyNow: async (client) => {
      const { graph, code } = get();
      const issues = graphIssues(graph).map((issue) => ({
        code: issue.code,
        message: issue.message,
        nodeId: issue.nodeId,
        lineno: issue.nodeId ? nodeLine(code, issue.nodeId) : null,
      }));
      if (issues.length > 0) {
        set({ verify: { ok: false, issues, ir: null } });
        return;
      }
      try {
        const envelope = await client.postStrategiesVerify(toManifest(graph));
        const ir = (envelope.data ?? null) as unknown;
        set({ verify: { ok: true, issues: [], ir } });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        set({ verify: { ok: false, issues: [{ code: 'verify_failed', message, nodeId: null, lineno: null }], ir: null } });
      }
    },

    runNow: async (client, request) => {
      const { graph } = get();
      set({ run: { status: 'pending', runId: null, response: null, error: null } });
      try {
        const envelope = await client.postBacktests({
          strategy: graph.name,
          universe: graph.universe.named ?? graph.universe.explicit?.map((e) => `${e.symbol}.${e.exchange}`).join(',') ?? '',
          seed: request.seed,
        });
        const data = envelope.data ?? null;
        set({
          run: {
            status: data?.status === 'completed' ? 'completed' : 'pending',
            runId: data?.run_id ?? null,
            response: data,
            error: data?.error ? `${data.error.code}: ${data.error.message}` : null,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        set({ run: { status: 'failed', runId: null, response: null, error: message } });
      }
    },

    assistantSay: (text, kind = 'discussion') =>
      set((state) => ({
        assistant: [...state.assistant, { kind, message: text, blocked: kind === 'validation_error' }],
      })),

    resetAssistant: () => set({ assistant: [] }),
  };
});

export type {
  BacktestResponse,
  BarAggregation,
  CompiledStrategy,
  StrategyManifest,
  SweepResponse,
  TimeframeSpec,
} from '../types/generated/domain';
