import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge as FlowEdge,
  type Node as FlowNode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Layers,
  Save,
  Trash2,
} from 'lucide-react';

import type { StrategyGraphShape } from '../../core/graph/model';
import { nodePorts } from '../../core/graph/validation';
import { DEFAULT_NODE_POSITIONS, useDesignerStore } from '../../core/designer/store';
import { honbaNodeTypes } from './nodes/HonbaNodes';
import { honbaEdgeTypes } from './edges/HonbaInsertableEdge';
import { NodePalette, type NodeTemplate } from './palette';
import { NodeInspector } from './inspector';

interface CanvasProps {
  graph: StrategyGraphShape;
  onNodeParams: (nodeId: string, params: Record<string, unknown>) => void;
  onError: (message: string) => void;
}

function DesignerCanvasInner({ graph, onError }: CanvasProps) {
  const store = useDesignerStore();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const [paletteOpen, setPaletteOpen] = useState(true);

  // Sync positions from store or defaults
  const nodes: FlowNode[] = useMemo(() => {
    return graph.nodes.map((node, index) => {
      const position =
        store.positions[node.id] ||
        DEFAULT_NODE_POSITIONS[node.id] || {
          x: 60 + (index % 4) * 250,
          y: 60 + Math.floor(index / 4) * 160,
        };

      const issuesForNode = store.verify.issues.filter((i) => i.nodeId === node.id);

      return {
        id: node.id,
        type: node.type in honbaNodeTypes ? node.type : 'card',
        position,
        selected: store.selectedNodeId === node.id,
        data: {
          node,
          issues: issuesForNode,
          universe: graph.universe,
          driving_timeframe: graph.driving_timeframe,
          warmup_bars: graph.warmup_bars,
          label: node.label || node.type,
          subtitle: node.indicator || node.id,
        },
      };
    });
  }, [
    graph.nodes,
    graph.universe,
    graph.driving_timeframe,
    graph.warmup_bars,
    store.positions,
    store.selectedNodeId,
    store.verify.issues,
  ]);

  const edges: FlowEdge[] = useMemo(() => {
    return (graph.edges ?? []).map((edge) => {
      const isSelected = store.selectedEdgeId === edge.id;
      return {
        id: edge.id,
        source: edge.from_node,
        target: edge.to_node,
        sourceHandle: edge.from_port,
        targetHandle: edge.to_port,
        type: 'insertable',
        animated: true,
        selected: isSelected,
      };
    });
  }, [graph.edges, store.selectedEdgeId]);

  // Port kind compatibility validator
  const isValidConnection = useCallback(
    (connection: Connection | { source: string | null; target: string | null; sourceHandle?: string | null; targetHandle?: string | null }) => {
      if (!connection.source || !connection.target || connection.source === connection.target) {
        return false;
      }
      const sourceNode = graph.nodes.find((n) => n.id === connection.source);
      const targetNode = graph.nodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return false;

      const sourcePort = connection.sourceHandle || Object.keys(nodePorts(sourceNode.type).outputs)[0];
      const targetPort = connection.targetHandle || Object.keys(nodePorts(targetNode.type).inputs)[0];

      if (!sourcePort || !targetPort) return false;

      const sourceKind = nodePorts(sourceNode.type).outputs[sourcePort];
      const targetKind = nodePorts(targetNode.type).inputs[targetPort];

      return sourceKind !== undefined && targetKind !== undefined && sourceKind === targetKind;
    },
    [graph.nodes],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) {
        onError('An edge requires both endpoints');
        return;
      }
      if (!isValidConnection(connection)) {
        onError('Connection rejected: Port types do not match');
        return;
      }
      void store.onConnect(connection);
    },
    [isValidConnection, onError, store],
  );

  const handleDragStart = useCallback((event: React.DragEvent, template: NodeTemplate) => {
    event.dataTransfer.setData('application/honba-node', JSON.stringify(template));
    event.dataTransfer.effectAllowed = 'copy';
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData('application/honba-node');
      if (!raw || !reactFlowWrapper.current) return;

      try {
        const template = JSON.parse(raw) as NodeTemplate;
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        const defaultData = template.defaultNode();
        const baseId = template.type.charAt(0);
        void store.addNode({ ...defaultData, id: baseId }, position);
      } catch (err) {
        onError(`Failed to drop node: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [screenToFlowPosition, store, onError],
  );

  const handleAddFromPalette = useCallback(
    (template: NodeTemplate) => {
      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      const position = screenToFlowPosition({
        x: bounds ? bounds.x + bounds.width / 2 : window.innerWidth / 2,
        y: bounds ? bounds.y + bounds.height / 2 : window.innerHeight / 2,
      });
      const defaultData = template.defaultNode();
      const baseId = template.type.charAt(0);
      void store.addNode({ ...defaultData, id: baseId }, position);
    },
    [screenToFlowPosition, store],
  );

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (store.selectedNodeId || store.selectedEdgeId) {
          event.preventDefault();
          void store.deleteSelected();
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        void store.snapshotVersion();
        store.markSaved();
      }

      if (event.key === 'Escape') {
        store.selectNode(null);
        store.selectEdge(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [store]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Top Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: 'var(--bg-surface, #1e222d)',
          borderBottom: '1px solid var(--border-subtle, #2a2e39)',
          fontSize: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="shortlist-btn"
            onClick={() => setPaletteOpen(!paletteOpen)}
            title={paletteOpen ? 'Hide Node Palette' : 'Show Node Palette'}
            style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Layers size={13} />
            <span>Palette</span>
            {paletteOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--text-secondary)' }}>Strategy:</span>
            <input
              type="text"
              value={graph.name}
              onChange={(e) => {
                void store.setName(e.target.value);
              }}
              style={{
                background: 'transparent',
                border: '1px solid transparent',
                borderRadius: 'var(--radius-sm, 4px)',
                padding: '2px 6px',
                color: 'var(--text-primary)',
                fontWeight: 600,
                fontSize: 12,
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-primary, #2962ff)';
                e.currentTarget.style.background = 'var(--bg-surface-elevated, #2a2e39)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'transparent';
                e.currentTarget.style.background = 'transparent';
              }}
            />
          </div>

          {store.isModified ? (
            <span style={{ fontSize: 10, color: 'var(--accent-gold, #f7a600)', display: 'flex', alignItems: 'center', gap: 4 }}>
              ● Unsaved
            </span>
          ) : (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle2 size={11} style={{ color: 'var(--bullish, #089981)' }} /> Saved
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {graph.nodes.length} nodes · {(graph.edges ?? []).length} edges
          </span>

          {store.selectedNodeId || store.selectedEdgeId ? (
            <button
              type="button"
              className="shortlist-btn"
              onClick={() => void store.deleteSelected()}
              style={{ padding: '4px 8px', color: 'var(--bearish, #f23645)', display: 'flex', alignItems: 'center', gap: 4 }}
              title="Delete selected item (Del)"
            >
              <Trash2 size={12} />
              <span>Delete</span>
            </button>
          ) : null}

          <button
            type="button"
            className="shortlist-btn"
            onClick={() => {
              void store.snapshotVersion();
              store.markSaved();
            }}
            title="Snapshot version (Ctrl+S)"
            style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Save size={12} />
            <span>Snapshot</span>
          </button>
        </div>
      </div>

      {/* Main Visual Workspace */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
        {/* Left Node Palette */}
        {paletteOpen ? <NodePalette onDragStart={handleDragStart} onAdd={handleAddFromPalette} /> : null}

        {/* Canvas Area */}
        <div ref={reactFlowWrapper} style={{ flex: 1, minWidth: 0, height: '100%', position: 'relative' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={honbaNodeTypes}
            edgeTypes={honbaEdgeTypes}
            onNodesChange={store.onNodesChange}
            onEdgesChange={store.onEdgesChange}
            onConnect={handleConnect}
            isValidConnection={isValidConnection}
            onNodeClick={(_, node) => store.selectNode(node.id)}
            onEdgeClick={(_, edge) => store.selectEdge(edge.id)}
            onPaneClick={() => {
              store.selectNode(null);
              store.selectEdge(null);
            }}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            fitView
            snapToGrid
            snapGrid={[16, 16]}
            deleteKeyCode={null}
            defaultEdgeOptions={{
              type: 'insertable',
              animated: true,
            }}
          >
            <Background gap={16} size={1} color="var(--border-subtle, #2a2e39)" />
            <MiniMap
              nodeStrokeWidth={3}
              pannable
              zoomable
              style={{
                background: 'var(--bg-surface, #1e222d)',
                border: '1px solid var(--border-subtle, #2a2e39)',
              }}
            />
            <Controls style={{ background: 'var(--bg-surface, #1e222d)' }} />
          </ReactFlow>
        </div>

        {/* Right Modular Inspector Drawer */}
        <NodeInspector />
      </div>
    </div>
  );
}

export const DesignerCanvas: React.FC<CanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <DesignerCanvasInner {...props} />
    </ReactFlowProvider>
  );
};
