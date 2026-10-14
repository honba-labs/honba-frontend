import { describe, expect, it } from 'vitest';

import { catalogue } from '../graph/catalogue';
import { generateCode } from '../graph/codegen';
import { buildGraph, graphHashSync } from '../graph/model';
import { graphIssues, validateGraph } from '../graph/validation';

function crossover() {
  return buildGraph({
    name: 'sma_cross',
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
  });
}

describe('graph canvas validation', () => {
  it('accepts a well-formed crossover graph', () => {
    expect(() => validateGraph(crossover())).not.toThrow();
    expect(graphIssues(crossover())).toEqual([]);
  });

  it('reports unknown indicators, ports and endpoints with stable codes', () => {
    const graph = crossover();
    const unknown = { ...graph, nodes: [...graph.nodes, { id: 'x', type: 'indicator' as const, indicator: 'nope' }] };
    expect(graphIssues(unknown)[0].code).toBe('unknown_indicator');

    const badEdge = { ...graph, edges: [...graph.edges, { id: 'bad', from_node: 'n1', from_port: 'nope', to_node: 'f', to_port: 'input' }] };
    expect(graphIssues(badEdge)[0].code).toBe('unknown_port');

    const dangling = { ...graph, edges: [...graph.edges, { id: 'd', from_node: 'n1', from_port: 'bars', to_node: 'zz', to_port: 'input' }] };
    expect(graphIssues(dangling)[0].code).toBe('unknown_edge_endpoint');

    const emptyName = { ...graph, name: '  ' };
    expect(graphIssues(emptyName)[0].code).toBe('empty_name');
  });

  it('rejects port type mismatches', () => {
    const graph = crossover();
    const mismatch = {
      ...graph,
      edges: [...graph.edges, { id: 'm', from_node: 'c', from_port: 'signal', to_node: 'f', to_port: 'input' }],
    };
    expect(graphIssues(mismatch)[0].code).toBe('port_type_mismatch');
  });
});

describe('code-gen pane round-trip', () => {
  it('generates deterministic code with the builder block, params and reason labels', () => {
    const hash = graphHashSync(crossover());
    const first = generateCode(crossover(), hash);
    const second = generateCode(crossover(), hash);
    expect(first).toBe(second);
    expect(first).toContain('# honba:strategy-graph:v1');
    expect(first).toContain('# honba:strategy-graph:generated');
    expect(first).toContain('f_period = Parameter(');
    expect(first).toContain('reason="Entry Long"');
    expect(first).toContain('.node(id="c", type="condition"');
  });

  it('embeds the graph hash and names the generated class', () => {
    const hash = graphHashSync(crossover());
    const code = generateCode(crossover(), hash);
    expect(code).toContain(`GRAPH_HASH = ${JSON.stringify(hash)}`);
    expect(code).toContain('class SmaCross(Strategy):');
  });

  it('derives the node catalogue without duplicates', () => {
    const kinds = catalogue().indicators.map((entry) => entry.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
    expect(kinds).toContain('sma');
  });
});
