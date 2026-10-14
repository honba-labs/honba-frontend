export const GRAPH_SCHEMA_VERSION = 1 as const;

export type NodeType =
  | 'universe'
  | 'indicator'
  | 'transform'
  | 'condition'
  | 'logic'
  | 'sizing'
  | 'risk'
  | 'order'
  | 'schedule'
  | 'benchmark';

export const NODE_TYPES: ReadonlyArray<NodeType> = [
  'universe',
  'indicator',
  'transform',
  'condition',
  'logic',
  'sizing',
  'risk',
  'order',
  'schedule',
  'benchmark',
] as const;

export interface GraphNode {
  id: string;
  type: NodeType;
  label?: string;
  params?: Record<string, unknown>;
  indicator?: string;
}

export interface GraphEdge {
  id: string;
  from_node: string;
  from_port: string;
  to_node: string;
  to_port: string;
}

export interface UniverseShape {
  named?: string | null;
  explicit?: Array<{ symbol: string; exchange: string }> | null;
}

export interface TimeframeShape {
  interval: number;
  aggregation: string;
}

export interface StrategyGraphShape {
  schema_version: number;
  name: string;
  universe: UniverseShape;
  driving_timeframe: TimeframeShape;
  warmup_bars: number;
  subscriptions?: { quotes?: boolean; trades?: boolean };
  nodes: GraphNode[];
  edges: GraphEdge[];
  strategy_api_version?: string;
  parameters?: Record<string, unknown>;
}

export class GraphError extends Error {
  readonly code: string;
  readonly nodeId: string | null;

  constructor(code: string, message: string, nodeId: string | null = null) {
    super(message);
    this.name = 'GraphError';
    this.code = code;
    this.nodeId = nodeId;
  }
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    const dict = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(dict).sort()) out[key] = canonical(dict[key]);
    return out;
  }
  return value;
}

export function canonicalJson(graph: StrategyGraphShape): string {
  return JSON.stringify(canonical(graph), null, undefined);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(text: string): Promise<string> {
  const subtle = (globalThis as unknown as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
  if (subtle) {
    const bytes = await subtle.digest('SHA-256', new TextEncoder().encode(text));
    return toHex(new Uint8Array(bytes));
  }
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0').repeat(8).slice(0, 64);
}

export async function graphHash(graph: StrategyGraphShape): Promise<string> {
  const digest = await sha256Hex(canonicalJson(graph));
  return `sha256:${digest}`;
}

export function graphHashSync(graph: StrategyGraphShape): string {
  const text = canonicalJson(graph);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `sha256:${(h >>> 0).toString(16).padStart(8, '0').repeat(8).slice(0, 64)}`;
}

export function buildGraph(overrides: Partial<StrategyGraphShape> & { name: string }): StrategyGraphShape {
  return {
    schema_version: GRAPH_SCHEMA_VERSION,
    name: overrides.name,
    universe: overrides.universe ?? { explicit: [{ symbol: 'TCS', exchange: 'NSE' }] },
    driving_timeframe: overrides.driving_timeframe ?? { interval: 1, aggregation: 'minute' },
    warmup_bars: overrides.warmup_bars ?? 0,
    subscriptions: overrides.subscriptions ?? { quotes: false, trades: false },
    nodes: overrides.nodes ?? [],
    edges: overrides.edges ?? [],
    ...(overrides.strategy_api_version ? { strategy_api_version: overrides.strategy_api_version } : {}),
  };
}
