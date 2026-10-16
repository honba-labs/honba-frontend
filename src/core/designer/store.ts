import { create } from 'zustand';
import type { EdgeChange, NodeChange } from '@xyflow/react';

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
import { catalogue } from '../graph/catalogue';
import {
  graphHash,
  graphHashSync,
  type GraphEdge,
  type GraphNode,
  type StrategyGraphShape,
  type TimeframeShape,
  type UniverseShape,
} from '../graph/model';
import { graphIssues, nodePorts } from '../graph/validation';

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

export const DEFAULT_NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  n1: { x: 40, y: 160 },
  f: { x: 300, y: 70 },
  s: { x: 300, y: 250 },
  c: { x: 570, y: 160 },
  o: { x: 820, y: 160 },
};

export interface DesignerState {
  tab: DesignerTab;
  graph: StrategyGraphShape;
  positions: Record<string, { x: number; y: number }>;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  isModified: boolean;
  code: string;
  codeEdited: boolean;
  verify: VerifyState;
  run: RunState;
  assistant: AssistantMessage[];
  versions: Array<{ hash: string; name: string; json: string }>;

  setTab: (tab: DesignerTab) => void;
  setName: (name: string) => Promise<void>;
  setGraph: (graph: StrategyGraphShape) => Promise<void>;
  setPositions: (positions: Record<string, { x: number; y: number }>) => void;
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  updateNodeParams: (nodeId: string, params: Record<string, unknown>) => Promise<void>;
  updateNodeLabel: (nodeId: string, label: string) => Promise<void>;
  updateNodeIndicator: (nodeId: string, indicator: string) => Promise<void>;
  updateUniverse: (universe: UniverseShape) => Promise<void>;
  updateDrivingTimeframe: (timeframe: TimeframeShape) => Promise<void>;
  updateWarmupBars: (warmupBars: number) => Promise<void>;

  addNode: (node: GraphNode, position?: { x: number; y: number }) => Promise<void>;
  deleteNode: (nodeId: string) => Promise<void>;
  deleteEdge: (edgeId: string) => Promise<void>;
  deleteSelected: () => Promise<void>;
  spliceEdge: (
    edgeId: string,
    node: GraphNode,
    position?: { x: number; y: number },
    inPort?: string,
    outPort?: string,
  ) => Promise<void>;
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: {
    source: string | null;
    target: string | null;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }) => Promise<void>;

  markSaved: () => void;
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
    positions: { ...DEFAULT_NODE_POSITIONS },
    selectedNodeId: null,
    selectedEdgeId: null,
    isModified: false,
    code: '',
    codeEdited: false,
    verify: { ok: false, issues: [], ir: null },
    run: { status: 'idle', runId: null, response: null, error: null },
    assistant: [],
    versions: [],

    setTab: (tab) => set({ tab }),

    setName: async (name) => {
      const { graph } = get();
      const next: StrategyGraphShape = { ...graph, name };
      set({ graph: next, isModified: true, codeEdited: false, code: await buildCode(next) });
    },

    setGraph: async (next) => {
      const currentPositions = get().positions;
      const positions: Record<string, { x: number; y: number }> = {};
      next.nodes.forEach((node, index) => {
        positions[node.id] =
          currentPositions[node.id] ??
          DEFAULT_NODE_POSITIONS[node.id] ?? {
            x: 80 + (index % 4) * 240,
            y: 80 + Math.floor(index / 4) * 160,
          };
      });
      set({
        graph: next,
        positions,
        selectedNodeId: null,
        selectedEdgeId: null,
        isModified: false,
        codeEdited: false,
        code: await buildCode(next),
      });
    },

    setPositions: (positions) => set({ positions }),

    updateNodePosition: (nodeId, position) => {
      const { positions } = get();
      set({ positions: { ...positions, [nodeId]: position }, isModified: true });
    },

    updateNodeParams: async (nodeId, params) => {
      const { graph } = get();
      const next: StrategyGraphShape = {
        ...graph,
        nodes: graph.nodes.map((node) =>
          node.id === nodeId ? { ...node, params: { ...(node.params ?? {}), ...params } } : node,
        ),
      };
      set({ graph: next, isModified: true, codeEdited: false, code: await buildCode(next) });
    },

    updateNodeLabel: async (nodeId, label) => {
      const { graph } = get();
      const next: StrategyGraphShape = {
        ...graph,
        nodes: graph.nodes.map((node) => (node.id === nodeId ? { ...node, label } : node)),
      };
      set({ graph: next, isModified: true, codeEdited: false, code: await buildCode(next) });
    },

    updateNodeIndicator: async (nodeId, indicator) => {
      const { graph } = get();
      const entry = catalogue().indicators.find((e) => e.kind === indicator);
      const defaultParams: Record<string, unknown> = {};
      entry?.params.forEach((p) => {
        defaultParams[p.name] = p.defaultValue;
      });

      const next: StrategyGraphShape = {
        ...graph,
        nodes: graph.nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                indicator,
                label: indicator.toUpperCase(),
                params: defaultParams,
              }
            : node,
        ),
      };
      set({ graph: next, isModified: true, codeEdited: false, code: await buildCode(next) });
    },

    updateUniverse: async (universe) => {
      const { graph } = get();
      const next: StrategyGraphShape = { ...graph, universe };
      set({ graph: next, isModified: true, codeEdited: false, code: await buildCode(next) });
    },

    updateDrivingTimeframe: async (driving_timeframe) => {
      const { graph } = get();
      const next: StrategyGraphShape = { ...graph, driving_timeframe };
      set({ graph: next, isModified: true, codeEdited: false, code: await buildCode(next) });
    },

    updateWarmupBars: async (warmup_bars) => {
      const { graph } = get();
      const next: StrategyGraphShape = { ...graph, warmup_bars };
      set({ graph: next, isModified: true, codeEdited: false, code: await buildCode(next) });
    },

    addNode: async (node, position) => {
      const { graph, positions } = get();
      let uniqueId = node.id;
      let counter = 1;
      while (graph.nodes.some((n) => n.id === uniqueId)) {
        uniqueId = `${node.id}_${counter++}`;
      }
      const resolvedNode: GraphNode = { ...node, id: uniqueId };
      const nextNodes = [...graph.nodes, resolvedNode];
      const nextPositions = {
        ...positions,
        [uniqueId]: position ?? { x: 260 + Math.random() * 80, y: 140 + Math.random() * 80 },
      };
      const nextGraph: StrategyGraphShape = { ...graph, nodes: nextNodes };
      set({
        graph: nextGraph,
        positions: nextPositions,
        selectedNodeId: uniqueId,
        selectedEdgeId: null,
        isModified: true,
        codeEdited: false,
        code: await buildCode(nextGraph),
      });
    },

    deleteNode: async (nodeId) => {
      const { graph, positions, selectedNodeId } = get();
      const nextNodes = graph.nodes.filter((n) => n.id !== nodeId);
      const nextEdges = (graph.edges ?? []).filter((e) => e.from_node !== nodeId && e.to_node !== nodeId);
      const nextPositions = { ...positions };
      delete nextPositions[nodeId];
      const nextGraph: StrategyGraphShape = { ...graph, nodes: nextNodes, edges: nextEdges };
      set({
        graph: nextGraph,
        positions: nextPositions,
        selectedNodeId: selectedNodeId === nodeId ? null : selectedNodeId,
        isModified: true,
        codeEdited: false,
        code: await buildCode(nextGraph),
      });
    },

    deleteEdge: async (edgeId) => {
      const { graph, selectedEdgeId } = get();
      const nextEdges = (graph.edges ?? []).filter((e) => e.id !== edgeId);
      const nextGraph: StrategyGraphShape = { ...graph, edges: nextEdges };
      set({
        graph: nextGraph,
        selectedEdgeId: selectedEdgeId === edgeId ? null : selectedEdgeId,
        isModified: true,
        codeEdited: false,
        code: await buildCode(nextGraph),
      });
    },

    deleteSelected: async () => {
      const { selectedNodeId, selectedEdgeId, deleteNode, deleteEdge } = get();
      if (selectedNodeId) {
        await deleteNode(selectedNodeId);
      } else if (selectedEdgeId) {
        await deleteEdge(selectedEdgeId);
      }
    },

    spliceEdge: async (edgeId, node, position, inPort, outPort) => {
      const { graph, positions } = get();
      const edge = (graph.edges ?? []).find((e) => e.id === edgeId);
      if (!edge) return;

      const sourceNode = graph.nodes.find((n) => n.id === edge.from_node);
      const targetNode = graph.nodes.find((n) => n.id === edge.to_node);
      if (!sourceNode || !targetNode) return;

      let uniqueId = node.id;
      let counter = 1;
      while (graph.nodes.some((n) => n.id === uniqueId)) {
        uniqueId = `${node.id}_${counter++}`;
      }
      const resolvedNode: GraphNode = { ...node, id: uniqueId };

      const sourcePos = positions[sourceNode.id] ?? { x: 100, y: 100 };
      const targetPos = positions[targetNode.id] ?? { x: 400, y: 100 };
      const midPos = position ?? {
        x: (sourcePos.x + targetPos.x) / 2,
        y: (sourcePos.y + targetPos.y) / 2,
      };

      const resolvedInPort = inPort || Object.keys(nodePorts(resolvedNode.type).inputs)[0] || 'input';
      const resolvedOutPort = outPort || Object.keys(nodePorts(resolvedNode.type).outputs)[0] || 'value';

      const newEdge1: GraphEdge = {
        id: `e_${sourceNode.id}_${edge.from_port}_${uniqueId}_${resolvedInPort}`,
        from_node: sourceNode.id,
        from_port: edge.from_port,
        to_node: uniqueId,
        to_port: resolvedInPort,
      };

      const newEdge2: GraphEdge = {
        id: `e_${uniqueId}_${resolvedOutPort}_${targetNode.id}_${edge.to_port}`,
        from_node: uniqueId,
        from_port: resolvedOutPort,
        to_node: targetNode.id,
        to_port: edge.to_port,
      };

      const nextEdges = (graph.edges ?? []).filter((e) => e.id !== edgeId).concat([newEdge1, newEdge2]);
      const nextNodes = [...graph.nodes, resolvedNode];
      const nextPositions = { ...positions, [uniqueId]: midPos };

      const nextGraph: StrategyGraphShape = {
        ...graph,
        nodes: nextNodes,
        edges: nextEdges,
      };

      set({
        graph: nextGraph,
        positions: nextPositions,
        selectedNodeId: uniqueId,
        selectedEdgeId: null,
        isModified: true,
        codeEdited: false,
        code: await buildCode(nextGraph),
      });
    },

    selectNode: (nodeId) => set({ selectedNodeId: nodeId, selectedEdgeId: null }),
    selectEdge: (edgeId) => set({ selectedEdgeId: edgeId, selectedNodeId: null }),

    onNodesChange: (changes) => {
      const { positions } = get();
      let posChanged = false;
      const updatedPositions = { ...positions };

      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          updatedPositions[change.id] = change.position;
          posChanged = true;
        } else if (change.type === 'remove') {
          void get().deleteNode(change.id);
        } else if (change.type === 'select') {
          if (change.selected) {
            get().selectNode(change.id);
          } else if (get().selectedNodeId === change.id) {
            get().selectNode(null);
          }
        }
      }

      if (posChanged) {
        set({ positions: updatedPositions, isModified: true });
      }
    },

    onEdgesChange: (changes) => {
      for (const change of changes) {
        if (change.type === 'remove') {
          void get().deleteEdge(change.id);
        } else if (change.type === 'select') {
          if (change.selected) {
            get().selectEdge(change.id);
          } else if (get().selectedEdgeId === change.id) {
            get().selectEdge(null);
          }
        }
      }
    },

    onConnect: async (connection) => {
      if (!connection.source || !connection.target) return;
      const { graph } = get();
      const sourceNode = graph.nodes.find((n) => n.id === connection.source);
      const targetNode = graph.nodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return;

      const from_port = connection.sourceHandle || Object.keys(nodePorts(sourceNode.type).outputs)[0] || 'out';
      const to_port = connection.targetHandle || Object.keys(nodePorts(targetNode.type).inputs)[0] || 'in';

      const duplicate = (graph.edges ?? []).some(
        (e) =>
          e.from_node === sourceNode.id &&
          e.to_node === targetNode.id &&
          e.from_port === from_port &&
          e.to_port === to_port,
      );
      if (duplicate) return;

      const edgeId = `e_${sourceNode.id}_${from_port}_${targetNode.id}_${to_port}`;
      const newEdge: GraphEdge = {
        id: edgeId,
        from_node: sourceNode.id,
        from_port,
        to_node: targetNode.id,
        to_port,
      };

      const nextGraph: StrategyGraphShape = {
        ...graph,
        edges: [...(graph.edges ?? []), newEdge],
      };
      set({
        graph: nextGraph,
        selectedEdgeId: edgeId,
        isModified: true,
        codeEdited: false,
        code: await buildCode(nextGraph),
      });
    },

    markSaved: () => set({ isModified: false }),

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
      await get().setGraph(parsed);
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
