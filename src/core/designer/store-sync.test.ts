import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_NODE_POSITIONS, defaultGraph, useDesignerStore } from './store';
import type { HonbaClient } from '../api/generated/client';
import { generateCode } from '../graph/codegen';
import { canonicalJson, graphHashSync, type StrategyGraphShape } from '../graph/model';
import { recognizeGeneratedSource } from './code-to-graph';

function code(graph: StrategyGraphShape): string {
  return generateCode(graph, graphHashSync(graph));
}

function withAtr(): StrategyGraphShape {
  const base = defaultGraph();
  return {
    ...base,
    nodes: [...base.nodes, { id: 'atr', type: 'indicator', indicator: 'atr', label: 'ATR 14', params: { period: 14 } }],
    edges: [...(base.edges ?? []), { id: 'e_atr', from_node: 'n1', from_port: 'bars', to_node: 'atr', to_port: 'input' }],
  };
}

function reset(): void {
  const graph = defaultGraph();
  useDesignerStore.setState({
    graph,
    positions: { ...DEFAULT_NODE_POSITIONS },
    selectedNodeId: null,
    selectedEdgeId: null,
    isModified: false,
    code: code(graph),
    codeEdited: false,
    sync: { status: 'idle', codeOnly: false, spans: [], sourceLines: {}, lastSource: null, error: null },
    recognizer: recognizeGeneratedSource,
    assistant: [],
    assistantStatus: 'idle',
    versions: [],
  });
}

describe('designer store sync slice (Phase 3)', () => {
  beforeEach(reset);

  it('adopts a recognised graph without regenerating the editor code', () => {
    const next = withAtr();
    const source = code(next);
    useDesignerStore.setState({ code: source, codeEdited: true });

    useDesignerStore.getState().applyRecognition(recognizeGeneratedSource(source), source);
    const state = useDesignerStore.getState();

    expect(state.sync.status).toBe('synced');
    expect(state.sync.codeOnly).toBe(false);
    expect(state.sync.spans).toEqual([]);
    expect(canonicalJson(state.graph)).toBe(canonicalJson(next));
    expect(state.code).toBe(source);
    expect(state.isModified).toBe(true);
  });

  it('preserves positions for ids present in both graphs and auto-places new nodes', () => {
    const next = withAtr();
    const source = code(next);
    useDesignerStore.setState({ code: source, codeEdited: true });
    useDesignerStore.getState().applyRecognition(recognizeGeneratedSource(source), source);
    const { positions } = useDesignerStore.getState();

    expect(positions.f).toEqual(DEFAULT_NODE_POSITIONS.f);
    expect(positions.atr).toBeDefined();
  });

  it('holds the last valid graph and records spans on a syntax error', () => {
    const before = useDesignerStore.getState().graph;
    const broken = '# honba:strategy-graph:v1\nGRAPH = (\n    _graph.StrategyGraph.build(\n';
    useDesignerStore.setState({ code: broken, codeEdited: true });

    useDesignerStore.getState().applyRecognition(recognizeGeneratedSource(broken), broken);
    const state = useDesignerStore.getState();

    expect(state.sync.status).toBe('invalid');
    expect(state.sync.spans[0]?.reason).toBe('syntax_error');
    expect(canonicalJson(state.graph)).toBe(canonicalJson(before));
    expect(state.code).toBe(broken);
  });

  it('ignores a stale recognition once the code has moved on (canvas wins)', () => {
    const next = withAtr();
    const staleSource = code(next);
    useDesignerStore.setState({ code: 'something else entirely', codeEdited: false });

    useDesignerStore.getState().applyRecognition(recognizeGeneratedSource(staleSource), staleSource);
    const state = useDesignerStore.getState();

    expect(canonicalJson(state.graph)).toBe(canonicalJson(defaultGraph()));
    expect(state.sync.status).toBe('idle');
  });

  it('flags code_only source without touching the graph', () => {
    const before = useDesignerStore.getState().graph;
    const codeOnly = 'print("no builder here")\n';
    useDesignerStore.setState({ code: codeOnly, codeEdited: true });
    useDesignerStore.getState().applyRecognition(recognizeGeneratedSource(codeOnly), codeOnly);

    const state = useDesignerStore.getState();
    expect(state.sync.status).toBe('invalid');
    expect(state.sync.codeOnly).toBe(true);
    expect(canonicalJson(state.graph)).toBe(canonicalJson(before));
  });

  it('a canvas edit regenerates code and resets sync to a clean state', async () => {
    useDesignerStore.setState({ sync: { status: 'invalid', codeOnly: true, spans: [{ start_line: 2, end_line: 2 }], sourceLines: {}, lastSource: 'x', error: null } });
    await useDesignerStore.getState().updateNodeParams('f', { period: 7 });

    const state = useDesignerStore.getState();
    expect(state.sync.status).toBe('synced');
    expect(state.sync.spans).toEqual([]);
    expect(state.sync.sourceLines.f).toBeGreaterThan(0);
    expect(state.code).toContain('"period": 7');
  });

  it('syncNow applies a recognition through the async path', async () => {
    const next = withAtr();
    const source = code(next);
    useDesignerStore.setState({ code: source, codeEdited: true });
    useDesignerStore.getState().syncNow(source);
    await Promise.resolve();
    await Promise.resolve();
    expect(useDesignerStore.getState().sync.status).toBe('synced');
    expect(canonicalJson(useDesignerStore.getState().graph)).toBe(canonicalJson(next));
  });
});

describe('designer store co-pilot slice (Phase 4)', () => {
  beforeEach(reset);

  it('uses the offline engine and clears the thinking flag', async () => {
    await useDesignerStore.getState().proposeAI('add an ATR volatility filter');
    const state = useDesignerStore.getState();
    expect(state.assistant).toHaveLength(1);
    expect(state.assistant[0].kind).toBe('candidate');
    expect(state.assistantStatus).toBe('idle');
  });

  it('prefers the backend assistant when the client exposes it', async () => {
    const propose = async () => ({
      data: {
        kind: 'candidate' as const,
        message: 'backend candidate',
        graph: defaultGraph(),
      },
    });
    const client = { postAssistantPropose: propose } as unknown as HonbaClient;

    await useDesignerStore.getState().proposeAI('anything', client);
    const state = useDesignerStore.getState();
    expect(state.assistant).toHaveLength(1);
    expect(state.assistant[0].message).toBe('backend candidate');
    expect(state.assistantStatus).toBe('idle');
  });

  it('records an audit message when a proposal is discarded', async () => {
    await useDesignerStore.getState().proposeAI('add an ATR volatility filter');
    useDesignerStore.getState().discardProposal(0);
    const state = useDesignerStore.getState();
    expect(state.assistant).toHaveLength(2);
    expect(state.assistant[1].message).toMatch(/Discarded/);
  });
});
