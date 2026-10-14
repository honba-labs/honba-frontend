import React, { useCallback, useMemo } from 'react';
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Edge as FlowEdge,
  type Node as FlowNode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { catalogue } from '../../core/graph/catalogue';
import type { GraphNode, StrategyGraphShape } from '../../core/graph/model';

interface CanvasProps {
  graph: StrategyGraphShape;
  onNodeParams: (nodeId: string, params: Record<string, unknown>) => void;
  onError: (message: string) => void;
}

function NodeCard({ data }: { data: { label: string; subtitle: string } }) {
  return (
    <div style={{ padding: '8px 12px', minWidth: 150 }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{data.label}</div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{data.subtitle}</div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

const nodeTypes = { card: NodeCard } as const;

function layoutPosition(index: number): { x: number; y: number } {
  return { x: (index % 4) * 220, y: Math.floor(index / 4) * 140 };
}

function paramEditor(node: GraphNode, value: (params: Record<string, unknown>) => void): React.ReactNode {
  const entries = catalogue().indicators.find((entry) => entry.kind === node.indicator);
  const params = node.params ?? {};
  const defaults = entries?.params ?? [];
  const names = Array.from(new Set([...Object.keys(params), ...defaults.map((p) => p.name)]));
  if (names.length === 0) return <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>no parameters</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
      {names.map((name) => {
        const spec = defaults.find((p) => p.name === name);
        const current = (params[name] ?? spec?.defaultValue ?? '') as string | number;
        return (
          <label key={name} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11 }}>
            <span style={{ color: 'var(--text-secondary)' }}>{name}</span>
            <input
              aria-label={`${node.id}.${name}`}
              type="number"
              value={typeof current === 'number' ? current : Number(current) || 0}
              min={spec?.min ?? undefined}
              max={spec?.max ?? undefined}
              step={spec?.step ?? undefined}
              onChange={(event) => value({ [name]: Number(event.target.value) })}
              style={{ width: 80 }}
            />
          </label>
        );
      })}
    </div>
  );
}

export const DesignerCanvas: React.FC<CanvasProps> = ({ graph, onNodeParams, onError }) => {
  const nodes: FlowNode[] = useMemo(
    () =>
      graph.nodes.map((node, index) => {
        const label = node.label || node.indicator || node.type;
        return {
          id: node.id,
          type: 'card',
          position: layoutPosition(index),
          data: { label: `${node.type} · ${label}`, subtitle: node.indicator ?? node.id },
        };
      }),
    [graph.nodes],
  );

  const edges: FlowEdge[] = useMemo(
    () =>
      (graph.edges ?? []).map((edge) => ({
        id: edge.id,
        source: edge.from_node,
        target: edge.to_node,
        sourceHandle: 'out',
        targetHandle: 'in',
        label: `${edge.from_port}→${edge.to_port}`,
      })),
    [graph.edges],
  );

  const onConnect = useCallback(
    ({ source, target }: { source: string | null; target: string | null }) => {
      if (!source || !target) {
        onError('an edge needs both endpoints');
        return;
      }
      onError(`canvas wiring is read-only in this build (${source}→${target} ignored); edit nodes instead`);
    },
    [onError],
  );

  const selected = graph.nodes[0];

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onConnect={onConnect} fitView>
          <Background />
          <MiniMap />
          <Controls />
        </ReactFlow>
      </div>
      <aside style={{ width: 260, borderLeft: '1px solid var(--border-subtle)', padding: 12, overflowY: 'auto' }}>
        <h3 style={{ fontSize: 13, marginBottom: 4 }}>Node inspector</h3>
        {selected ? (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{selected.label || selected.indicator || selected.type}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {selected.type} · {selected.id}
              {selected.indicator ? ` · ${selected.indicator}` : ''}
            </div>
            {paramEditor(selected, (params) => onNodeParams(selected.id, params))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>The graph has no nodes.</div>
        )}
      </aside>
    </div>
  );
};
