import { beforeEach, describe, expect, it } from 'vitest';

import { defaultGraph, useDesignerStore } from './store';

beforeEach(async () => {
  const store = useDesignerStore.getState();
  await store.setGraph(defaultGraph());
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
