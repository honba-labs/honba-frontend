import type { StrategyGraphShape } from '../graph/model';
import { cataloguelookup } from '../graph/catalogue';
import { parameterLayout } from '../graph/codegen';

/**
 * Parameter introspection for the GUI tuner (Phase 2, HBD-2026-DES-004).
 *
 * The panel is a projection of the graph: every field maps 1:1 to a `node.params`
 * entry and writes back through `store.updateNodeParams(nodeId, { name: value })`.
 * Type/metadata come from the indicator catalogue when the node is an indicator,
 * and are inferred from the value otherwise (conditions, sizing, risk, orders).
 *
 * `codeName` mirrors the generated Python parameter name from `parameterLayout`
 * (indicator params only) so the panel and the generated module agree.
 */

export type ParamTypeName = 'int' | 'float' | 'bool' | 'str';

export interface ParamField {
  /** Stable key for React lists. */
  key: string;
  nodeId: string;
  nodeLabel: string;
  indicator: string | null;
  name: string;
  /** The generated Python parameter name, when this param is a class-level Parameter. */
  codeName: string | null;
  value: unknown;
  typeName: ParamTypeName;
  min: number | null;
  max: number | null;
  step: number | null;
  /** Enumerated choices for known string params (op, side, method, ...). */
  options?: string[];
}

/** Known enum choices for graph string params, keyed by parameter name. */
const ENUM_OPTIONS: Record<string, string[]> = {
  op: ['crosses_above', 'crosses_below', '>', '<', '>=', '<=', '==', 'and', 'or', 'not'],
  side: ['buy', 'sell'],
  aggregation: ['minute', 'hour', 'day', 'week', 'month'],
};

/** Parameters that are structural (rendered elsewhere) and hidden from the tuner. */
const HIDDEN_PARAMS = new Set(['symbol', 'exchange', 'interval', 'aggregation']);

export function inferTypeName(value: unknown): ParamTypeName {
  if (typeof value === 'boolean') return 'bool';
  if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'float';
  return 'str';
}

/** Coerce a raw form value back into the param's declared type. */
export function coerceParamValue(typeName: ParamTypeName, raw: unknown): unknown {
  if (typeName === 'bool') {
    return typeof raw === 'boolean' ? raw : raw === 'true' || raw === '1' || raw === 1 || raw === 'on';
  }
  if (typeName === 'int' || typeName === 'float') {
    if (typeof raw === 'number') return typeName === 'int' ? Math.trunc(raw) : raw;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? (typeName === 'int' ? Math.trunc(parsed) : parsed) : 0;
  }
  return raw === null || raw === undefined ? '' : String(raw);
}

export function extractParamFields(graph: StrategyGraphShape): ParamField[] {
  const layout = parameterLayout(graph);
  const fields: ParamField[] = [];

  for (const node of graph.nodes) {
    const params = node.params ?? {};
    const names = Object.keys(params).filter((name) => !HIDDEN_PARAMS.has(name));
    if (names.length === 0) continue;

    const entry = node.indicator ? cataloguelookup(node.indicator) : undefined;

    for (const name of names) {
      const value = params[name];
      const spec = entry?.params.find((p) => p.name === name);
      const typeName: ParamTypeName = spec ? (spec.typeName as ParamTypeName) : inferTypeName(value);
      const options = typeName === 'str' ? ENUM_OPTIONS[name] : undefined;
      fields.push({
        key: `${node.id}.${name}`,
        nodeId: node.id,
        nodeLabel: node.label || node.type,
        indicator: node.indicator ?? null,
        name,
        codeName: node.indicator ? layout[`${node.id}.${name}`] ?? null : null,
        value,
        typeName,
        min: spec?.min ?? null,
        max: spec?.max ?? null,
        step: spec?.step ?? null,
        ...(options ? { options } : {}),
      });
    }
  }

  return fields;
}

/** Group fields by node so the panel can render one section per node. */
export function groupParamFields(fields: ParamField[]): Array<{ nodeId: string; nodeLabel: string; indicator: string | null; fields: ParamField[] }> {
  const groups: Array<{ nodeId: string; nodeLabel: string; indicator: string | null; fields: ParamField[] }> = [];
  const byId = new Map<string, (typeof groups)[number]>();
  for (const field of fields) {
    let group = byId.get(field.nodeId);
    if (!group) {
      group = { nodeId: field.nodeId, nodeLabel: field.nodeLabel, indicator: field.indicator, fields: [] };
      byId.set(field.nodeId, group);
      groups.push(group);
    }
    group.fields.push(field);
  }
  return groups;
}
