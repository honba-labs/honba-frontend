import { catalogue } from './catalogue';
import { GRAPH_SCHEMA_VERSION, GraphError, NODE_TYPES, type StrategyGraphShape } from './model';

export type PortKind = 'series' | 'bool' | 'size' | 'order';

export interface NodePorts {
  inputs: Record<string, PortKind>;
  outputs: Record<string, PortKind>;
}

const PORTS: Record<string, NodePorts> = {
  universe: { inputs: {}, outputs: { bars: 'series' } },
  indicator: { inputs: { input: 'series' }, outputs: { value: 'series' } },
  transform: { inputs: { input: 'series' }, outputs: { value: 'series' } },
  condition: { inputs: { left: 'series', right: 'series' }, outputs: { signal: 'bool' } },
  logic: { inputs: { a: 'bool', b: 'bool' }, outputs: { signal: 'bool' } },
  sizing: { inputs: { signal: 'bool' }, outputs: { size: 'size' } },
  risk: { inputs: { signal: 'bool' }, outputs: { signal: 'bool' } },
  order: { inputs: { signal: 'bool', size: 'size' }, outputs: { orders: 'order' } },
  schedule: { inputs: {}, outputs: { signal: 'bool' } },
  benchmark: { inputs: { input: 'series' }, outputs: { value: 'series' } },
};

export function nodePorts(nodeType: string): NodePorts {
  const spec = PORTS[nodeType];
  if (!spec) throw new GraphError('unknown_node_type', `unknown node type '${nodeType}'`);
  return spec;
}

export function validateGraph(graph: StrategyGraphShape): void {
  if (graph.schema_version !== GRAPH_SCHEMA_VERSION) {
    throw new GraphError(
      'unsupported_schema_version',
      `graph schema_version ${graph.schema_version} is not ${GRAPH_SCHEMA_VERSION}`,
    );
  }
  if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    throw new GraphError('empty_graph', 'a strategy graph must have at least one node');
  }
  if (!graph.name || !graph.name.trim()) {
    throw new GraphError('empty_name', 'strategy name must not be empty');
  }
  const seen = new Set<string>();
  for (const node of graph.nodes) {
    if (!node.id) throw new GraphError('missing_node_id', 'a node is missing its id');
    if (seen.has(node.id)) throw new GraphError('duplicate_node_id', `duplicate node id '${node.id}'`, node.id);
    seen.add(node.id);
    if (!NODE_TYPES.includes(node.type)) {
      throw new GraphError('unknown_node_type', `unknown node type '${node.type}'`, node.id);
    }
    if (node.type === 'indicator') {
      if (!node.indicator) throw new GraphError('missing_indicator', "indicator node needs an 'indicator' kind", node.id);
      const kinds = catalogue().indicators.map((entry) => entry.kind);
      if (!kinds.includes(node.indicator)) {
        throw new GraphError('unknown_indicator', `unknown indicator '${node.indicator}'`, node.id);
      }
    }
  }
  if (!graph.nodes.some((node) => node.type === 'universe')) {
    throw new GraphError('missing_universe_node', 'the graph has no universe node');
  }
  const seenEdges = new Set<string>();
  for (const edge of graph.edges ?? []) {
    if (seenEdges.has(edge.id)) throw new GraphError('duplicate_edge_id', `duplicate edge id '${edge.id}'`);
    seenEdges.add(edge.id);
    const source = graph.nodes.find((n) => n.id === edge.from_node);
    const target = graph.nodes.find((n) => n.id === edge.to_node);
    if (!source || !target) {
      throw new GraphError(
        'unknown_edge_endpoint',
        `edge '${edge.id}' references unknown node '${!source ? edge.from_node : edge.to_node}'`,
      );
    }
    const outPorts = nodePorts(source.type).outputs;
    const inPorts = nodePorts(target.type).inputs;
    if (!(edge.from_port in outPorts)) {
      throw new GraphError('unknown_port', `node '${source.id}' has no output port '${edge.from_port}'`, source.id);
    }
    if (!(edge.to_port in inPorts)) {
      throw new GraphError('unknown_port', `node '${target.id}' has no input port '${edge.to_port}'`, target.id);
    }
    if (outPorts[edge.from_port] !== inPorts[edge.to_port]) {
      throw new GraphError(
        'port_type_mismatch',
        `edge '${edge.id}' connects '${outPorts[edge.from_port]}' to '${inPorts[edge.to_port]}'`,
      );
    }
  }
}

export function graphIssues(graph: StrategyGraphShape): Array<{ code: string; message: string; nodeId: string | null }> {
  try {
    validateGraph(graph);
    return [];
  } catch (err) {
    if (err instanceof GraphError) return [{ code: err.code, message: err.message, nodeId: err.nodeId }];
    throw err;
  }
}
