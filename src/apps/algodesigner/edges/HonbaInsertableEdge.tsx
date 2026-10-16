import React, { useCallback, useMemo, useState } from 'react';
import {
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import {
  Activity,
  Cpu,
  GitBranch,
  Plus,
  ShieldAlert,
  ShoppingCart,
  Sliders,
  TrendingUp,
  X,
} from 'lucide-react';

import type { GraphNode, NodeType } from '../../../core/graph/model';
import { nodePorts } from '../../../core/graph/validation';
import { useDesignerStore } from '../../../core/designer/store';

interface SplicableOption {
  type: NodeType;
  label: string;
  category: 'indicator' | 'logic' | 'risk' | 'execution';
  icon: React.ReactNode;
  defaultNode: () => Omit<GraphNode, 'id'>;
  inPort?: string;
  outPort?: string;
}

const SERIES_SPLICE_OPTIONS: SplicableOption[] = [
  {
    type: 'indicator',
    label: 'SMA Indicator',
    category: 'indicator',
    icon: <Activity size={12} />,
    defaultNode: () => ({
      type: 'indicator',
      indicator: 'sma',
      label: 'SMA',
      params: { period: 14 },
    }),
    inPort: 'input',
    outPort: 'value',
  },
  {
    type: 'indicator',
    label: 'EMA Indicator',
    category: 'indicator',
    icon: <Activity size={12} />,
    defaultNode: () => ({
      type: 'indicator',
      indicator: 'ema',
      label: 'EMA',
      params: { period: 20 },
    }),
    inPort: 'input',
    outPort: 'value',
  },
  {
    type: 'indicator',
    label: 'RSI Indicator',
    category: 'indicator',
    icon: <Activity size={12} />,
    defaultNode: () => ({
      type: 'indicator',
      indicator: 'rsi',
      label: 'RSI',
      params: { period: 14 },
    }),
    inPort: 'input',
    outPort: 'value',
  },
  {
    type: 'transform',
    label: 'Pct Change',
    category: 'indicator',
    icon: <TrendingUp size={12} />,
    defaultNode: () => ({
      type: 'transform',
      label: 'Pct Change',
      params: { op: 'pct_change' },
    }),
    inPort: 'input',
    outPort: 'value',
  },
];

const BOOL_SPLICE_OPTIONS: SplicableOption[] = [
  {
    type: 'logic',
    label: 'AND Gate',
    category: 'logic',
    icon: <Cpu size={12} />,
    defaultNode: () => ({
      type: 'logic',
      label: 'AND Gate',
      params: { op: 'and' },
    }),
    inPort: 'a',
    outPort: 'signal',
  },
  {
    type: 'logic',
    label: 'OR Gate',
    category: 'logic',
    icon: <Cpu size={12} />,
    defaultNode: () => ({
      type: 'logic',
      label: 'OR Gate',
      params: { op: 'or' },
    }),
    inPort: 'a',
    outPort: 'signal',
  },
  {
    type: 'risk',
    label: 'Risk Gate',
    category: 'risk',
    icon: <ShieldAlert size={12} />,
    defaultNode: () => ({
      type: 'risk',
      label: 'Risk Gate',
      params: { max_drawdown: 0.05 },
    }),
    inPort: 'signal',
    outPort: 'signal',
  },
  {
    type: 'sizing',
    label: 'Position Sizing',
    category: 'risk',
    icon: <Sliders size={12} />,
    defaultNode: () => ({
      type: 'sizing',
      label: 'Fixed Sizing',
      params: { mode: 'fixed_quantity', value: 1 },
    }),
    inPort: 'signal',
    outPort: 'size',
  },
  {
    type: 'order',
    label: 'Buy Order',
    category: 'execution',
    icon: <ShoppingCart size={12} />,
    defaultNode: () => ({
      type: 'order',
      label: 'Buy Order',
      params: { side: 'buy', quantity: 1 },
    }),
    inPort: 'signal',
    outPort: 'orders',
  },
  {
    type: 'order',
    label: 'Sell Order',
    category: 'execution',
    icon: <ShoppingCart size={12} />,
    defaultNode: () => ({
      type: 'order',
      label: 'Sell Order',
      params: { side: 'sell', quantity: 1 },
    }),
    inPort: 'signal',
    outPort: 'orders',
  },
];

export function HonbaInsertableEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  sourceHandleId,
  targetHandleId,
  markerEnd,
  selected,
  animated = true,
}: EdgeProps) {
  const store = useDesignerStore();
  const [isHovered, setIsHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  // Determine port type of this edge to filter candidate splice options
  const spliceOptions = useMemo(() => {
    const sourceNode = store.graph.nodes.find((n) => n.id === source);
    if (!sourceNode) return [...SERIES_SPLICE_OPTIONS, ...BOOL_SPLICE_OPTIONS];
    const fromPort = sourceHandleId || Object.keys(nodePorts(sourceNode.type).outputs)[0];
    const kind = nodePorts(sourceNode.type).outputs[fromPort];

    if (kind === 'series') return SERIES_SPLICE_OPTIONS;
    if (kind === 'bool') return BOOL_SPLICE_OPTIONS;
    return [...SERIES_SPLICE_OPTIONS, ...BOOL_SPLICE_OPTIONS];
  }, [store.graph.nodes, source, sourceHandleId]);

  const handleSplice = useCallback(
    (opt: SplicableOption) => {
      const defaultData = opt.defaultNode();
      const baseId = opt.type.charAt(0);
      void store.spliceEdge(
        id,
        { ...defaultData, id: baseId },
        { x: labelX, y: labelY },
        opt.inPort,
        opt.outPort,
      );
      setMenuOpen(false);
    },
    [id, labelX, labelY, store],
  );

  const isHighlighted = isHovered || selected || menuOpen;

  return (
    <>
      {/* SVG Path */}
      <path
        d={edgePath}
        fill="none"
        stroke={isHighlighted ? 'var(--accent-primary, #2962ff)' : 'var(--border-medium, #434651)'}
        strokeWidth={isHighlighted ? 2.5 : 1.8}
        strokeDasharray={animated ? '5 5' : undefined}
        style={{
          animation: animated ? 'dashdraw 0.5s linear infinite' : undefined,
          cursor: 'pointer',
        }}
        className="react-flow__edge-path"
        markerEnd={markerEnd}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => store.selectEdge(id)}
      />

      {/* Edge Midpoint Label & Splicing Button */}
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-auto"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            zIndex: 10,
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => !menuOpen && setIsHovered(false)}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: isHighlighted ? 'var(--accent-primary, #2962ff)' : 'var(--bg-surface, #1e222d)',
              color: isHighlighted ? '#ffffff' : 'var(--text-secondary, #787b86)',
              border: '1.5px solid var(--border-medium, #434651)',
              boxShadow: 'var(--shadow-sm)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast, 120ms)',
              transform: isHighlighted ? 'scale(1.15)' : 'scale(0.85)',
              opacity: isHighlighted ? 1 : 0.4,
            }}
            title="Splice node into this connection (+)"
          >
            {menuOpen ? <X size={10} /> : <Plus size={11} />}
          </button>

          {/* Splicing Popover Menu */}
          {menuOpen && (
            <div
              style={{
                position: 'absolute',
                top: 26,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'var(--bg-surface, #1e222d)',
                border: '1px solid var(--border-medium, #363a45)',
                borderRadius: 'var(--radius-md, 6px)',
                boxShadow: 'var(--shadow-lg)',
                padding: 6,
                minWidth: 170,
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  padding: '2px 6px',
                  borderBottom: '1px solid var(--border-subtle, #2a2e39)',
                  marginBottom: 2,
                }}
              >
                Insert Between Nodes
              </div>
              {spliceOptions.map((opt, idx) => (
                <button
                  key={`${opt.type}-${opt.label}-${idx}`}
                  type="button"
                  onClick={() => handleSplice(opt)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '5px 8px',
                    borderRadius: 'var(--radius-sm, 4px)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: 11,
                    textAlign: 'left',
                    cursor: 'pointer',
                    width: '100%',
                    transition: 'background var(--transition-fast, 120ms)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-surface-elevated, #2a2e39)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span style={{ color: 'var(--accent-primary, #2962ff)', display: 'flex' }}>
                    {opt.icon}
                  </span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const honbaEdgeTypes = {
  insertable: HonbaInsertableEdge,
  default: HonbaInsertableEdge,
} as const;
