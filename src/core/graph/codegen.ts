import type { StrategyGraphShape } from './model';

function literal(value: unknown): string {
  if (value === null || value === undefined) return 'None';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'float("nan")';
  if (Array.isArray(value)) return `[${value.map(literal).join(', ')}]`;
  if (typeof value === 'object') {
    const dict = value as Record<string, unknown>;
    const entries = Object.keys(dict)
      .sort()
      .map((key) => `${literal(key)}: ${literal(dict[key])}`);
    return `{${entries.join(', ')}}`;
  }
  return JSON.stringify(value);
}

function toClassName(name: string): string {
  const ident =
    name
      .split(/[^0-9a-zA-Z]+/)
      .filter(Boolean)
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join('') || 'StrategyGraph';
  return /^[0-9]/.test(ident) ? `S${ident}` : ident;
}

function toIdent(text: string): string {
  const ident = text.replace(/[^0-9a-zA-Z_]/g, '_') || 'n';
  return /^[0-9]/.test(ident) ? `n_${ident}` : ident;
}

function indicatorNodes(graph: StrategyGraphShape) {
  return graph.nodes.filter((node) => node.type === 'indicator' && node.indicator);
}

function parameterLayout(graph: StrategyGraphShape): Record<string, string> {
  const counts: Record<string, number> = {};
  for (const node of indicatorNodes(graph)) {
    for (const pname of Object.keys(node.params ?? {})) counts[pname] = (counts[pname] ?? 0) + 1;
  }
  const layout: Record<string, string> = {};
  for (const node of indicatorNodes(graph)) {
    for (const pname of Object.keys(node.params ?? {})) {
      layout[`${node.id}.${pname}`] = counts[pname] > 1 ? `${toIdent(node.id)}_${pname}` : pname;
    }
  }
  return layout;
}

function incoming(graph: StrategyGraphShape, nodeId: string, port: string): string | null {
  const edge = (graph.edges ?? []).find((e) => e.to_node === nodeId && e.to_port === port);
  return edge ? edge.from_node : null;
}

function firstIncoming(graph: StrategyGraphShape, nodeId: string): string | null {
  const edge = (graph.edges ?? []).find((e) => e.to_node === nodeId);
  return edge ? toIdent(edge.from_node) : null;
}

function conditionLines(graph: StrategyGraphShape, nodeId: string, local: string): string[] {
  const node = graph.nodes.find((n) => n.id === nodeId);
  const op = (node?.params?.op as string) ?? 'gt';
  const left = incoming(graph, nodeId, 'left');
  const right = incoming(graph, nodeId, 'right');
  const leftExpr = left ? toIdent(left) : 'bar.close';
  const threshold = node?.params?.threshold as number | undefined;
  const rightExpr = right ? toIdent(right) : literal(threshold ?? 0);
  if (op === 'crosses_above' || op === 'crosses_below') {
    const symbol = op === 'crosses_above' ? '>' : '<';
    return [
      `        ${local}_now = bool(${leftExpr} is not None and ${rightExpr} is not None and ${leftExpr} ${symbol} ${rightExpr})`,
      `        ${local}_was = getattr(self, '_${local}_was', False)`,
      `        ${local} = bool(${local}_now and not ${local}_was)`,
      `        self._${local}_was = ${local}_now`,
    ];
  }
  const symbol = ({ gt: '>', gte: '>=', lt: '<', lte: '<=', eq: '==' } as Record<string, string>)[op] ?? '>';
  return [
    `        ${local} = bool(${leftExpr} is not None and ${rightExpr} is not None and ${leftExpr} ${symbol} ${rightExpr})`,
  ];
}

function logicLines(graph: StrategyGraphShape, nodeId: string, local: string): string[] {
  const node = graph.nodes.find((n) => n.id === nodeId);
  const op = (node?.params?.op as string) ?? 'and';
  const a = toIdent(incoming(graph, nodeId, 'a') ?? 'False');
  const b = toIdent(incoming(graph, nodeId, 'b') ?? 'False');
  if (op === 'or') return [`        ${local} = bool(${a} or ${b})`];
  if (op === 'not') return [`        ${local} = bool(not ${a})`];
  return [`        ${local} = bool(${a} and ${b})`];
}

function orderLines(graph: StrategyGraphShape, nodeId: string): string[] {
  const node = graph.nodes.find((n) => n.id === nodeId);
  const side = String(node?.params?.side ?? 'buy');
  const signal = firstIncoming(graph, nodeId) ?? 'False';
  const sizeEdge = (graph.edges ?? []).find((e) => e.to_node === nodeId && e.to_port === 'size');
  const qty = sizeEdge ? toIdent(sizeEdge.from_node) : literal((node?.params?.quantity as number | undefined) ?? 1);
  const label = node?.label ?? (side === 'buy' ? 'Buy' : 'Sell');
  const method = side === 'buy' ? 'buy' : 'sell';
  return [`        if ${signal}:`, `            self.${method}(bar.instrument_id, ${qty}, reason=${JSON.stringify(label)})`];
}

function onBarBody(graph: StrategyGraphShape): string[] {
  const lines: string[] = [];
  for (const node of graph.nodes) {
    const local = toIdent(node.id);
    const display = node.label ?? node.indicator ?? node.type;
    if (node.type === 'universe') continue;
    if (node.type === 'indicator') lines.push(`        ${local} = self._${local}.update_bar(bar)`);
    else if (node.type === 'benchmark') lines.push(`        ${local} = None  # benchmark series is not modelled yet`);
    else if (node.type === 'condition') lines.push(...conditionLines(graph, node.id, local));
    else if (node.type === 'logic') lines.push(...logicLines(graph, node.id, local));
    else if (node.type === 'sizing') lines.push(`        ${local} = ${literal((node.params?.value as number | undefined) ?? 1)}`);
    else if (node.type === 'risk') lines.push(`        ${local} = ${firstIncoming(graph, node.id) ?? 'False'}  # risk gate: ${JSON.stringify(display)}`);
    else if (node.type === 'order') lines.push(...orderLines(graph, node.id));
    else if (node.type === 'transform') lines.push(`        ${local} = ${firstIncoming(graph, node.id) ?? 'None'}  # transform: ${JSON.stringify(display)}`);
    else if (node.type === 'schedule') lines.push(`        ${local} = True  # schedule: ${JSON.stringify(display)}`);
  }
  if (lines.length === 0) lines.push('        return');
  return lines;
}

export function generateCode(graph: StrategyGraphShape, graphHash: string): string {
  const klass = toClassName(graph.name);
  const layout = parameterLayout(graph);
  const out: string[] = [];
  out.push(`"""${klass}: generated from a Honba StrategyGraph (schema_version 1).`);
  out.push('');
  out.push('DO NOT EDIT by hand: regenerate the strategy from the graph instead.');
  out.push('"""');
  out.push('');
  out.push('# honba:strategy-graph:v1');
  out.push('from __future__ import annotations');
  out.push('');
  out.push('from honba.strategies.base import Parameter, Strategy');
  out.push('from honba.strategies.indicators import build_indicator');
  out.push('from honba.strategies import graph as _graph');
  out.push('');
  out.push(`GRAPH_HASH = ${JSON.stringify(graphHash)}`);
  out.push('');
  out.push('GRAPH = (');
  out.push('    _graph.StrategyGraph.build(');
  out.push(`        name=${literal(graph.name)},`);
  out.push(`        universe=${literal(graph.universe)},`);
  out.push(`        driving_timeframe=${literal(graph.driving_timeframe)},`);
  out.push(`        warmup_bars=${literal(graph.warmup_bars)},`);
  out.push('    )');
  const subs = graph.subscriptions ?? { quotes: false, trades: false };
  out.push(`    .with_subscriptions(quotes=${literal(subs.quotes ?? false)}, trades=${literal(subs.trades ?? false)})`);
  for (const node of graph.nodes) {
    const parts = [`id=${literal(node.id)}`, `type=${literal(node.type)}`];
    if (node.label) parts.push(`label=${literal(node.label)}`);
    if (node.indicator) parts.push(`indicator=${literal(node.indicator)}`);
    if (node.params && Object.keys(node.params).length > 0) parts.push(`params=${literal(node.params)}`);
    out.push(`    .node(${parts.join(', ')})`);
  }
  for (const edge of graph.edges ?? []) {
    out.push(
      `    .edge(id=${literal(edge.id)}, from_node=${literal(edge.from_node)}, from_port=${literal(edge.from_port)}, to_node=${literal(edge.to_node)}, to_port=${literal(edge.to_port)})`,
    );
  }
  out.push(')');
  out.push('');
  out.push('');
  out.push('# honba:strategy-graph:generated');
  out.push(`class ${klass}(Strategy):`);
  out.push(`    name = ${literal(graph.name)}`);
  out.push(`    warmup_bars = ${literal(graph.warmup_bars)}`);
  const indicators = indicatorNodes(graph);
  for (const node of indicators) {
    for (const [pname, pvalue] of Object.entries(node.params ?? {})) {
      out.push(`    ${layout[`${node.id}.${pname}`]} = Parameter(default=${literal(pvalue)}, description=${JSON.stringify(pname)})`);
    }
  }
  if (indicators.length === 0) out.push('    pass');
  out.push('');
  out.push('    def on_start(self) -> None:');
  if (indicators.length === 0) {
    out.push('        pass');
  } else {
    for (const node of indicators) {
      const kwargs = Object.keys(node.params ?? {})
        .sort()
        .map((p) => `${p}=self.${layout[`${node.id}.${p}`]}`)
        .join(', ');
      out.push(`        self._${toIdent(node.id)} = build_indicator(${literal(node.indicator)}${kwargs ? `, ${kwargs}` : ''})`);
    }
  }
  out.push('');
  out.push('    def on_bar(self, bar) -> None:');
  out.push(...onBarBody(graph));
  out.push('');
  return out.join('\n');
}

export function pythonParams(graph: StrategyGraphShape): Array<{ name: string; defaultValue: unknown }> {
  const layout = parameterLayout(graph);
  const out: Array<{ name: string; defaultValue: unknown }> = [];
  for (const node of indicatorNodes(graph)) {
    for (const [pname, pvalue] of Object.entries(node.params ?? {})) {
      out.push({ name: layout[`${node.id}.${pname}`], defaultValue: pvalue });
    }
  }
  return out;
}
