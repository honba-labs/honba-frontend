import { beforeEach, describe, expect, it } from 'vitest';

import { computeGraphDiff, defaultGraph, useDesignerStore } from './store';
import { useJobsStore } from './jobs-store';
import { HonbaClient } from '../api/generated/client';
import { useOpsStore } from './ops-state';
import { drawdownSeries, maxDrawdownPct, runModeBadge, trustBadges } from './ops';
import { validateGraph } from '../graph/validation';
import { canonicalJson } from '../graph/model';
import type { ResponseEnvelope } from '../types/generated/domain';

function jsonFetch(body: unknown): typeof fetch {
  return (async () => ({ ok: true, status: 200, json: async () => body })) as unknown as typeof fetch;
}

beforeEach(async () => {
  const store = useDesignerStore.getState();
  await store.setGraph(defaultGraph());
  useDesignerStore.setState({ versions: [] });
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
});

describe('AlgoDesigner Canvas Engine & State (Phase 1 & 2)', () => {
  it('adds a new node with visual coordinates and updates generated code', async () => {
    const store = useDesignerStore.getState();
    const initialCount = store.graph.nodes.length;

    await store.addNode(
      {
        id: 'rsi_1',
        type: 'indicator',
        indicator: 'rsi',
        label: 'RSI 14',
        params: { period: 14 },
      },
      { x: 450, y: 300 },
    );

    const updated = useDesignerStore.getState();
    expect(updated.graph.nodes.length).toBe(initialCount + 1);
    expect(updated.positions['rsi_1']).toEqual({ x: 450, y: 300 });
    expect(updated.selectedNodeId).toBe('rsi_1');
    expect(updated.isModified).toBe(true);
    expect(updated.code).toContain('rsi');
  });

  it('generates unique node IDs when adding nodes with duplicate base IDs', async () => {
    const store = useDesignerStore.getState();

    await store.addNode({ id: 'f', type: 'indicator', indicator: 'sma' });
    const updated = useDesignerStore.getState();
    const added = updated.graph.nodes.find((n) => n.id.startsWith('f_'));
    expect(added).toBeDefined();
    expect(added?.id).toBe('f_1');
  });

  it('deletes a node and cascades cleanup of its incident edges and positions', async () => {
    const store = useDesignerStore.getState();
    // In defaultGraph, node 'f' is connected to e1 and e3
    expect(store.graph.edges.some((e) => e.from_node === 'f' || e.to_node === 'f')).toBe(true);
    expect(store.positions['f']).toBeDefined();

    await store.deleteNode('f');

    const updated = useDesignerStore.getState();
    expect(updated.graph.nodes.some((n) => n.id === 'f')).toBe(false);
    expect(updated.graph.edges.some((e) => e.from_node === 'f' || e.to_node === 'f')).toBe(false);
    expect(updated.positions['f']).toBeUndefined();
    expect(updated.isModified).toBe(true);
  });

  it('deletes edges independently of nodes', async () => {
    const store = useDesignerStore.getState();
    const edgeCount = store.graph.edges.length;

    await store.deleteEdge('e1');

    const updated = useDesignerStore.getState();
    expect(updated.graph.edges.length).toBe(edgeCount - 1);
    expect(updated.graph.edges.some((e) => e.id === 'e1')).toBe(false);
    // Nodes n1 and f remain present
    expect(updated.graph.nodes.some((n) => n.id === 'n1')).toBe(true);
    expect(updated.graph.nodes.some((n) => n.id === 'f')).toBe(true);
  });

  it('connects compatible port types and disallows duplicate edges', async () => {
    const store = useDesignerStore.getState();
    const initialEdges = store.graph.edges.length;

    // Connect Fast SMA value (series) to Slow SMA input (series)
    await store.onConnect({
      source: 'f',
      target: 's',
      sourceHandle: 'value',
      targetHandle: 'input',
    });

    let updated = useDesignerStore.getState();
    expect(updated.graph.edges.length).toBe(initialEdges + 1);

    // Attempting same connection again should be ignored (duplicate prevention)
    await store.onConnect({
      source: 'f',
      target: 's',
      sourceHandle: 'value',
      targetHandle: 'input',
    });

    updated = useDesignerStore.getState();
    expect(updated.graph.edges.length).toBe(initialEdges + 1);
  });

  it('tracks node position moves and marks canvas modified', () => {
    const store = useDesignerStore.getState();
    expect(store.isModified).toBe(false);

    store.updateNodePosition('n1', { x: 120, y: 220 });

    const updated = useDesignerStore.getState();
    expect(updated.positions['n1']).toEqual({ x: 120, y: 220 });
    expect(updated.isModified).toBe(true);
  });

  it('updates node labels and parameters, reflecting in generated Python code', async () => {
    const store = useDesignerStore.getState();

    await store.updateNodeLabel('f', 'Ultra Fast SMA');
    await store.updateNodeParams('f', { period: 3 });

    const updated = useDesignerStore.getState();
    const node = updated.graph.nodes.find((n) => n.id === 'f');
    expect(node?.label).toBe('Ultra Fast SMA');
    expect(node?.params?.period).toBe(3);
    expect(updated.code).toContain('f_period = Parameter(default=3');
  });

  it('supports deleteSelected for both nodes and edges', async () => {
    const store = useDesignerStore.getState();

    // Select node 'c' and delete
    store.selectNode('c');
    await store.deleteSelected();

    let updated = useDesignerStore.getState();
    expect(updated.graph.nodes.some((n) => n.id === 'c')).toBe(false);
    expect(updated.selectedNodeId).toBeNull();

    // Select edge 'e1' and delete
    store.selectEdge('e1');
    await store.deleteSelected();

    updated = useDesignerStore.getState();
    expect(updated.graph.edges.some((e) => e.id === 'e1')).toBe(false);
    expect(updated.selectedEdgeId).toBeNull();
  });
});

describe('AlgoDesigner Edge Splicing & Inspection (Phase 3 & 4)', () => {
  it('splices an intermediate node directly into an existing edge wire', async () => {
    const store = useDesignerStore.getState();
    const initialNodes = store.graph.nodes.length;
    const initialEdges = store.graph.edges.length;

    // Splice a Transform node into edge e1 (n1:bars -> f:input)
    await store.spliceEdge(
      'e1',
      {
        id: 't',
        type: 'transform',
        label: 'Pct Change',
        params: { op: 'pct_change' },
      },
      { x: 180, y: 110 },
      'input',
      'value',
    );

    const updated = useDesignerStore.getState();
    // 1 node added
    expect(updated.graph.nodes.length).toBe(initialNodes + 1);
    // Original edge e1 was replaced by 2 new edges (net +1 edge)
    expect(updated.graph.edges.length).toBe(initialEdges + 1);
    expect(updated.graph.edges.some((e) => e.id === 'e1')).toBe(false);

    // Verify connections: n1 -> t and t -> f
    const edgeToT = updated.graph.edges.find((e) => e.to_node === 't');
    const edgeFromT = updated.graph.edges.find((e) => e.from_node === 't');

    expect(edgeToT).toBeDefined();
    expect(edgeToT?.from_node).toBe('n1');
    expect(edgeToT?.from_port).toBe('bars');
    expect(edgeToT?.to_port).toBe('input');

    expect(edgeFromT).toBeDefined();
    expect(edgeFromT?.to_node).toBe('f');
    expect(edgeFromT?.from_port).toBe('value');
    expect(edgeFromT?.to_port).toBe('input');

    expect(updated.positions['t']).toEqual({ x: 180, y: 110 });
    expect(updated.selectedNodeId).toBe('t');
    expect(updated.isModified).toBe(true);
  });

  it('switches indicator kind dynamically and resets defaults in store and code', async () => {
    const store = useDesignerStore.getState();

    // Node 'f' was SMA with period 2
    expect(store.graph.nodes.find((n) => n.id === 'f')?.indicator).toBe('sma');

    // Switch node 'f' to RSI
    await store.updateNodeIndicator('f', 'rsi');

    const updated = useDesignerStore.getState();
    const nodeF = updated.graph.nodes.find((n) => n.id === 'f');
    expect(nodeF?.indicator).toBe('rsi');
    expect(nodeF?.label).toBe('RSI');
    expect(nodeF?.params?.period).toBe(14); // Default RSI period from catalogue
    expect(updated.code).toContain('f_period = Parameter(default=14');
  });

  it('updates universe specifications and driving timeframes', async () => {
    const store = useDesignerStore.getState();

    await store.updateUniverse({ explicit: [{ symbol: 'RELIANCE', exchange: 'NSE' }] });
    await store.updateDrivingTimeframe({ interval: 5, aggregation: 'minute' });
    await store.updateWarmupBars(50);

    const updated = useDesignerStore.getState();
    expect(updated.graph.universe.explicit?.[0]?.symbol).toBe('RELIANCE');
    expect(updated.graph.driving_timeframe.interval).toBe(5);
    expect(updated.graph.warmup_bars).toBe(50);
    expect(updated.code).toContain('warmup_bars=50');
    expect(updated.code).toContain('"interval": 5');
  });
});

describe('AlgoDesigner Diagnostics, Trust & Ops Controls (Phase 5)', () => {
  it('detects structural defects and supports issue node selection', async () => {
    const store = useDesignerStore.getState();
    const client = new HonbaClient({ baseUrl: 'http://localhost/api/v1' });

    // Introduce a defect: node with unknown indicator kind
    await store.addNode({ id: 'bad_ind', type: 'indicator', indicator: 'nonexistent_ind' });

    await store.verifyNow(client);
    const verify = useDesignerStore.getState().verify;
    expect(verify.ok).toBe(false);
    expect(verify.issues.length).toBeGreaterThan(0);

    const badIssue = verify.issues.find((i) => i.nodeId === 'bad_ind');
    expect(badIssue).toBeDefined();
    expect(badIssue?.code).toBe('unknown_indicator');

    // Test clicking/selecting the issue node
    store.selectNode(badIssue!.nodeId);
    expect(useDesignerStore.getState().selectedNodeId).toBe('bad_ind');
  });

  it('triggers backtest execution and records response metrics and trust badges', async () => {
    const runResponse: ResponseEnvelope<unknown> = {
      api_version: '1.0.0',
      schema_version: 4,
      data: {
        run_id: 'test-run-101',
        status: 'completed',
        metrics: {
          sharpe: 1.85,
          max_drawdown: 0.12,
          total_return: 0.28,
          net_pnl: 28000,
          trades: 42,
        },
        validation: {
          passed: true,
          dsr: { passed: true, observed_sharpe: 1.85, expected_max_sharpe: 1.2, z_stat: 2.1 },
          pbo: { passed: true, pbo: 0.08, combinations_evaluated: 16 },
          holdout: { passed: true },
          walk_forward: { passed: false, wfe: 0.42 },
        },
        assumptions: {
          not_modelled: ['borrow_fee', 'spread_slippage'],
        },
      },
    };

    const client = new HonbaClient({
      baseUrl: 'http://localhost/api/v1',
      fetch: jsonFetch(runResponse),
    });

    const store = useDesignerStore.getState();
    await store.runNow(client, { seed: 42 });

    const run = useDesignerStore.getState().run;
    expect(run.status).toBe('completed');
    expect(run.runId).toBe('test-run-101');
    expect(run.response?.metrics?.sharpe).toBe(1.85);

    // Verify trust badges computation
    const badges = trustBadges(run.response?.validation);
    expect(badges.map((b) => b.key)).toContain('dsr');
    expect(badges.map((b) => b.key)).toContain('pbo');
    expect(badges.find((b) => b.key === 'dsr')?.passed).toBe(true);
    expect(badges.find((b) => b.key === 'walk_forward')?.passed).toBe(false);
  });

  it('computes underwater drawdown series and max drawdown percentage accurately', () => {
    const equity = [100000, 105000, 95000, 110000, 99000];
    const dd = drawdownSeries(equity);
    // Peak 1: 100k -> 0%
    // Peak 2: 105k -> 0%
    // Dip 1: 95k -> (105k - 95k) / 105k * 100 = 9.5238%
    // Peak 3: 110k -> 0%
    // Dip 2: 99k -> (110k - 99k) / 110k * 100 = 10%
    expect(dd[0]).toBe(0);
    expect(dd[1]).toBe(0);
    expect(dd[2]).toBeCloseTo(9.524, 2);
    expect(dd[3]).toBe(0);
    expect(dd[4]).toBeCloseTo(10, 2);
    expect(maxDrawdownPct(equity)).toBeCloseTo(10, 2);
  });

  it('manages ops console modes, safety latches, and order cancellations', async () => {
    const ops = useOpsStore.getState();
    expect(ops.mode).toBe('paper');
    expect(ops.badge().blocked).toBe(false);

    // Switch to live mode without approved status -> blocked
    ops.setApproved(false);
    ops.setMode('live');
    expect(useOpsStore.getState().badge().blocked).toBe(true);

    // Emergency kill switch blocks live execution unconditionally
    ops.setApproved(true);
    ops.setKillSwitch(true);
    expect(useOpsStore.getState().badge().blocked).toBe(true);
    expect(useOpsStore.getState().badge().killSwitch).toBe(true);

    // Disengage kill switch -> active live mode
    ops.setKillSwitch(false);
    expect(useOpsStore.getState().badge().blocked).toBe(false);
    expect(useOpsStore.getState().badge().level).toBe('live');
  });
});

describe('AlgoDesigner Export/Import & Version History (Phase 6)', () => {
  it('exports canonical JSON matching graphHashSync', () => {
    const store = useDesignerStore.getState();
    const exported = store.exportStrategyJson();
    expect(typeof exported).toBe('string');

    const parsed = JSON.parse(exported);
    expect(parsed.schema_version).toBe(1);
    expect(parsed.name).toBe('sma_cross');
    expect(parsed.nodes).toHaveLength(5);
    expect(parsed.edges).toHaveLength(5);

    // Canonical JSON must equal canonicalJson helper
    expect(exported).toBe(canonicalJson(store.graph));
  });

  it('imports and replaces strategy graph with layout recalculation and validation', async () => {
    const store = useDesignerStore.getState();

    const customGraph = {
      schema_version: 1,
      name: 'momentum_rsi_strategy',
      universe: { explicit: [{ symbol: 'INFY', exchange: 'NSE' }] },
      driving_timeframe: { interval: 5, aggregation: 'minute' },
      warmup_bars: 14,
      subscriptions: { quotes: false, trades: false },
      nodes: [
        { id: 'u1', type: 'universe' as const, label: 'Universe' },
        { id: 'rsi', type: 'indicator' as const, indicator: 'rsi', label: 'RSI 14', params: { period: 14 } },
        { id: 'cond', type: 'condition' as const, label: 'Oversold', params: { op: '<' } },
        { id: 'ord', type: 'order' as const, label: 'Buy Dip', params: { side: 'buy', quantity: 10 } },
      ],
      edges: [
        { id: 'e1', from_node: 'u1', from_port: 'bars', to_node: 'rsi', to_port: 'input' },
        { id: 'e2', from_node: 'rsi', from_port: 'value', to_node: 'cond', to_port: 'left' },
        { id: 'e3', from_node: 'cond', from_port: 'signal', to_node: 'ord', to_port: 'signal' },
      ],
    };

    // Valid graph check
    expect(() => validateGraph(customGraph)).not.toThrow();

    await store.setGraph(customGraph);
    const updated = useDesignerStore.getState();

    expect(updated.graph.name).toBe('momentum_rsi_strategy');
    expect(updated.graph.nodes).toHaveLength(4);
    expect(updated.positions['u1']).toBeDefined();
    expect(updated.positions['rsi']).toBeDefined();
    expect(updated.code).toContain('momentum_rsi_strategy');
    expect(updated.isModified).toBe(false);
  });

  it('records version snapshots and restores previous graphs losslessly', async () => {
    const store = useDesignerStore.getState();
    const originalName = store.graph.name;

    // Take snapshot 1
    await store.snapshotVersion();
    let state = useDesignerStore.getState();
    expect(state.versions).toHaveLength(1);
    const version1Hash = state.versions[0].hash;
    expect(state.versions[0].name).toBe(originalName);
    expect(state.versions[0].timestamp).toBeGreaterThan(0);

    // Modify strategy
    await store.setName('altered_strategy');
    await store.deleteNode('f');
    state = useDesignerStore.getState();
    expect(state.graph.name).toBe('altered_strategy');
    expect(state.graph.nodes).toHaveLength(4);

    // Take snapshot 2
    await store.snapshotVersion();
    state = useDesignerStore.getState();
    expect(state.versions).toHaveLength(2);

    // Restore snapshot 1
    await store.restoreVersion(version1Hash);
    state = useDesignerStore.getState();
    expect(state.graph.name).toBe(originalName);
    expect(state.graph.nodes).toHaveLength(5);
    expect(state.graph.nodes.some((n) => n.id === 'f')).toBe(true);
  });
});

describe('AlgoDesigner AI Assistant & Graph Diff Engine (Phase 7)', () => {
  it('proposes ATR volatility sizing candidate and computes visual graph diffs', async () => {
    const client = new HonbaClient({ baseUrl: 'http://localhost/api/v1' });
    const store = useDesignerStore.getState();

    await store.proposeAI('Please add an ATR trailing stop to protect against drawdowns', client);
    const updated = useDesignerStore.getState();
    expect(updated.assistant.length).toBe(1);

    const msg = updated.assistant[0];
    expect(msg.kind).toBe('candidate');
    expect(msg.blocked).toBe(false);
    expect(msg.decisions?.[0]?.decision).toBe('approve');
    expect(msg.graph).toBeDefined();

    // Verify diff calculation
    const diff = msg.diff as { added_nodes: string[]; modified_nodes: string[]; removed_nodes: string[] };
    expect(diff.added_nodes.some((n) => n.includes('atr'))).toBe(true);
    expect(diff.added_nodes.some((n) => n.toLowerCase().includes('sizing') || n.includes('sz_vol'))).toBe(true);
  });

  it('proposes parameter tuning with modified nodes diff and param changes', async () => {
    const client = new HonbaClient({ baseUrl: 'http://localhost/api/v1' });
    const store = useDesignerStore.getState();

    await store.proposeAI('Tune the moving average parameters for faster trend detection', client);
    const updated = useDesignerStore.getState();
    const msg = updated.assistant[updated.assistant.length - 1];

    expect(msg.kind).toBe('candidate');
    expect(msg.diff).toBeDefined();
    const diff = msg.diff as { modified_nodes: string[]; param_changes?: Record<string, unknown> };
    expect(diff.modified_nodes.length).toBeGreaterThan(0);
    expect(diff.param_changes).toBeDefined();
  });

  it('quarantines invalid candidate proposals with verification findings (ADR 0029 S5 Invariant)', async () => {
    const client = new HonbaClient({ baseUrl: 'http://localhost/api/v1' });
    const store = useDesignerStore.getState();

    await store.proposeAI('Test invalid candidate with broken graph', client);
    const updated = useDesignerStore.getState();
    const msg = updated.assistant[updated.assistant.length - 1];

    expect(msg.kind).toBe('validation_error');
    expect(msg.blocked).toBe(true);
    expect(msg.findings).toBeDefined();
    expect(msg.findings!.length).toBeGreaterThan(0);
    expect(msg.findings![0].code).toBe('unknown_indicator');
  });

  it('applies approved candidate to canvas while saving version snapshot', async () => {
    const client = new HonbaClient({ baseUrl: 'http://localhost/api/v1' });
    const store = useDesignerStore.getState();

    await store.proposeAI('Add RSI momentum filter', client);
    const rsiIdx = useDesignerStore.getState().assistant.length - 1;

    const initialNodesCount = useDesignerStore.getState().graph.nodes.length;
    await useDesignerStore.getState().applyProposal(rsiIdx);

    const postApply = useDesignerStore.getState();
    expect(postApply.graph.nodes.length).toBeGreaterThan(initialNodesCount);
    expect(postApply.graph.nodes.some((n) => n.id === 'rsi_mom')).toBe(true);
    expect(postApply.versions.length).toBeGreaterThan(0);
  });

  it('computes accurate graph diff between current and candidate graphs', () => {
    const current = defaultGraph();
    const candidate = JSON.parse(JSON.stringify(current));
    // Add a node
    candidate.nodes.push({ id: 'vol_filter', type: 'indicator', indicator: 'bbands', label: 'Bollinger' });
    // Modify a node
    const fNode = candidate.nodes.find((n: { id: string }) => n.id === 'f');
    if (fNode) fNode.params = { window: 99 };
    // Remove a node
    candidate.nodes = candidate.nodes.filter((n: { id: string }) => n.id !== 's');

    const diff = computeGraphDiff(current, candidate);
    expect(diff.added_nodes.some((n) => n.includes('vol_filter'))).toBe(true);
    expect(diff.removed_nodes.some((n) => n.includes('s'))).toBe(true);
    expect(diff.modified_nodes.some((n) => n.includes('f'))).toBe(true);
    expect(diff.param_changes?.['f']).toEqual({ window: 99 });
  });
});

describe('AlgoDesigner Sweeps & Walk-Forward Grid Engine (Phase 8)', () => {
  it('applies optimal sweep parameters directly to canvas nodes', async () => {
    const store = useDesignerStore.getState();
    expect(store.graph.nodes.find((n) => n.id === 'f')?.params?.['period']).toBe(2);
    expect(store.graph.nodes.find((n) => n.id === 's')?.params?.['period']).toBe(4);

    await store.applySweepParams({
      'f.period': 12,
      's.period': 45,
    });

    const updated = useDesignerStore.getState();
    expect(updated.graph.nodes.find((n) => n.id === 'f')?.params?.['period']).toBe(12);
    expect(updated.graph.nodes.find((n) => n.id === 's')?.params?.['period']).toBe(45);
    expect(updated.code).toContain('12');
    expect(updated.code).toContain('45');
    expect(updated.isModified).toBe(true);
  });

  it('enqueues, tracks, and persists sweep optimization jobs', () => {
    const jobs = useJobsStore.getState();
    const initialCount = jobs.jobs.length;

    const job = jobs.enqueue('sweep', 'SMA Grid Optimization (Fast 5-15, Slow 20-50)', {
      combinations: 16,
      targetMetric: 'sharpe',
      walkForward: true,
      folds: 4,
    });

    expect(job.kind).toBe('sweep');
    expect(job.status).toBe('queued');
    expect(useJobsStore.getState().jobs.length).toBe(initialCount + 1);

    // Transition to running
    jobs.markRunning(job.id);
    expect(useJobsStore.getState().jobs.find((j) => j.id === job.id)?.status).toBe('running');

    // Complete with sweep payload
    const sweepResult = {
      evaluated: 16,
      bestSharpe: 2.34,
      optimal: {
        params: { 'f.window': 10, 's.window': 35 },
        sharpe: 2.34,
        total_return: 0.38,
        max_drawdown: 0.08,
      },
      wfe: 0.78,
    };
    jobs.complete(job.id, sweepResult);

    const completed = useJobsStore.getState().jobs.find((j) => j.id === job.id);
    expect(completed?.status).toBe('completed');
    expect(completed?.result).toEqual(sweepResult);
  });
});
