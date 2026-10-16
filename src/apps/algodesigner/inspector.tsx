import React, { useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart2,
  Clock,
  Cpu,
  Database,
  GitBranch,
  ShieldAlert,
  ShoppingCart,
  Sliders,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';

import { catalogue } from '../../core/graph/catalogue';
import type { GraphNode, TimeframeShape, UniverseShape } from '../../core/graph/model';
import { nodePorts, type PortKind } from '../../core/graph/validation';
import { useDesignerStore } from '../../core/designer/store';

const CONDITION_OPS = [
  { value: 'crosses_above', label: 'Crosses Above (↑)' },
  { value: 'crosses_below', label: 'Crosses Below (↓)' },
  { value: 'gt', label: 'Greater Than (>)' },
  { value: 'gte', label: 'Greater or Equal (>=)' },
  { value: 'lt', label: 'Less Than (<)' },
  { value: 'lte', label: 'Less or Equal (<=)' },
  { value: 'eq', label: 'Equals (==)' },
];

const LOGIC_OPS = [
  { value: 'and', label: 'AND (Both true)' },
  { value: 'or', label: 'OR (Either true)' },
  { value: 'not', label: 'NOT (Invert left input)' },
];

const SIZING_MODES = [
  { value: 'fixed_quantity', label: 'Fixed Quantity (lots)' },
  { value: 'percent_equity', label: 'Percent of Equity (%)' },
  { value: 'fixed_notional', label: 'Fixed Notional (₹)' },
];

const EXCHANGES = ['NSE', 'BSE', 'MCX'];
const TIMEFRAME_AGGS = ['minute', 'hour', 'day'];

export const NodeInspector: React.FC = () => {
  const store = useDesignerStore();
  const { graph, selectedNodeId, selectedEdgeId, verify } = store;

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return graph.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [graph.nodes, selectedNodeId]);

  const selectedEdge = useMemo(() => {
    if (!selectedEdgeId) return null;
    return (graph.edges ?? []).find((e) => e.id === selectedEdgeId) || null;
  }, [graph.edges, selectedEdgeId]);

  const edgePortKind: PortKind | null = useMemo(() => {
    if (!selectedEdge) return null;
    const src = graph.nodes.find((n) => n.id === selectedEdge.from_node);
    if (!src) return null;
    return nodePorts(src.type).outputs[selectedEdge.from_port] ?? null;
  }, [selectedEdge, graph.nodes]);

  const nodeIssues = useMemo(() => {
    if (!selectedNode) return [];
    return verify.issues.filter((i) => i.nodeId === selectedNode.id);
  }, [verify.issues, selectedNode]);

  // Universe controls
  const handleUniverseSymbolChange = (symbol: string) => {
    const nextUniverse: UniverseShape = {
      ...graph.universe,
      explicit: [{ symbol, exchange: graph.universe.explicit?.[0]?.exchange || 'NSE' }],
    };
    void store.updateUniverse(nextUniverse);
  };

  const handleUniverseExchangeChange = (exchange: string) => {
    const nextUniverse: UniverseShape = {
      ...graph.universe,
      explicit: [{ symbol: graph.universe.explicit?.[0]?.symbol || 'TCS', exchange }],
    };
    void store.updateUniverse(nextUniverse);
  };

  const handleTimeframeIntervalChange = (interval: number) => {
    const nextTf: TimeframeShape = {
      ...graph.driving_timeframe,
      interval: Math.max(1, interval),
    };
    void store.updateDrivingTimeframe(nextTf);
  };

  const handleTimeframeAggChange = (aggregation: string) => {
    const nextTf: TimeframeShape = {
      ...graph.driving_timeframe,
      aggregation,
    };
    void store.updateDrivingTimeframe(nextTf);
  };

  return (
    <aside
      style={{
        width: 280,
        height: '100%',
        background: 'var(--bg-surface, #1e222d)',
        borderLeft: '1px solid var(--border-subtle, #2a2e39)',
        padding: '12px 14px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 10,
          borderBottom: '1px solid var(--border-subtle, #2a2e39)',
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Inspector</h3>
          {selectedNode ? (
            <span
              style={{
                fontSize: 10,
                fontFamily: 'var(--font-family-mono)',
                color: 'var(--accent-primary, #2962ff)',
                background: 'rgba(41, 98, 255, 0.1)',
                padding: '2px 5px',
                borderRadius: 'var(--radius-xs, 3px)',
              }}
            >
              {selectedNode.type}
            </span>
          ) : selectedEdge ? (
            <span
              style={{
                fontSize: 10,
                fontFamily: 'var(--font-family-mono)',
                color: 'var(--accent-gold, #f7a600)',
                background: 'rgba(247, 166, 0, 0.1)',
                padding: '2px 5px',
                borderRadius: 'var(--radius-xs, 3px)',
              }}
            >
              edge
            </span>
          ) : null}
        </div>

        {(selectedNode || selectedEdge) && (
          <button
            type="button"
            onClick={() => {
              store.selectNode(null);
              store.selectEdge(null);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 2,
            }}
            title="Deselect (Esc)"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* 1. Node Inspector */}
      {selectedNode ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Label & ID */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>Display Label</label>
            <input
              type="text"
              value={selectedNode.label || ''}
              placeholder={selectedNode.type}
              onChange={(e) => void store.updateNodeLabel(selectedNode.id, e.target.value)}
              style={{
                background: 'var(--bg-surface-elevated, #2a2e39)',
                border: '1px solid var(--border-subtle, #2a2e39)',
                borderRadius: 'var(--radius-sm, 4px)',
                padding: '5px 8px',
                color: 'var(--text-primary)',
                fontSize: 12,
              }}
            />
          </div>

          <div
            style={{
              fontSize: 10,
              fontFamily: 'var(--font-family-mono)',
              color: 'var(--text-muted)',
              background: 'var(--bg-surface-elevated, #2a2e39)',
              padding: '4px 8px',
              borderRadius: 'var(--radius-xs, 3px)',
            }}
          >
            Node ID: {selectedNode.id}
          </div>

          {/* Universe Node Settings */}
          {selectedNode.type === 'universe' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>Universe Specifications</span>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Instrument Symbol</span>
                <input
                  type="text"
                  value={graph.universe.explicit?.[0]?.symbol || graph.universe.named || ''}
                  onChange={(e) => handleUniverseSymbolChange(e.target.value.toUpperCase())}
                  placeholder="e.g. TCS"
                  style={{
                    background: 'var(--bg-surface-elevated, #2a2e39)',
                    border: '1px solid var(--border-subtle, #2a2e39)',
                    borderRadius: 'var(--radius-sm, 4px)',
                    padding: '5px 8px',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-family-mono)',
                    fontSize: 11,
                  }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Exchange</span>
                <select
                  value={graph.universe.explicit?.[0]?.exchange || 'NSE'}
                  onChange={(e) => handleUniverseExchangeChange(e.target.value)}
                  style={{
                    background: 'var(--bg-surface-elevated, #2a2e39)',
                    border: '1px solid var(--border-subtle, #2a2e39)',
                    borderRadius: 'var(--radius-sm, 4px)',
                    padding: '5px 8px',
                    color: 'var(--text-primary)',
                    fontSize: 11,
                  }}
                >
                  {EXCHANGES.map((ex) => (
                    <option key={ex} value={ex}>
                      {ex}
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ display: 'flex', gap: 8 }}>
                <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Interval</span>
                  <input
                    type="number"
                    min={1}
                    value={graph.driving_timeframe.interval}
                    onChange={(e) => handleTimeframeIntervalChange(Number(e.target.value))}
                    style={{
                      background: 'var(--bg-surface-elevated, #2a2e39)',
                      border: '1px solid var(--border-subtle, #2a2e39)',
                      borderRadius: 'var(--radius-sm, 4px)',
                      padding: '5px 8px',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-family-mono)',
                      fontSize: 11,
                    }}
                  />
                </label>

                <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Aggregation</span>
                  <select
                    value={graph.driving_timeframe.aggregation}
                    onChange={(e) => handleTimeframeAggChange(e.target.value)}
                    style={{
                      background: 'var(--bg-surface-elevated, #2a2e39)',
                      border: '1px solid var(--border-subtle, #2a2e39)',
                      borderRadius: 'var(--radius-sm, 4px)',
                      padding: '5px 8px',
                      color: 'var(--text-primary)',
                      fontSize: 11,
                    }}
                  >
                    {TIMEFRAME_AGGS.map((agg) => (
                      <option key={agg} value={agg}>
                        {agg}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Warmup Bars</span>
                <input
                  type="number"
                  min={0}
                  value={graph.warmup_bars}
                  onChange={(e) => void store.updateWarmupBars(Math.max(0, Number(e.target.value)))}
                  style={{
                    background: 'var(--bg-surface-elevated, #2a2e39)',
                    border: '1px solid var(--border-subtle, #2a2e39)',
                    borderRadius: 'var(--radius-sm, 4px)',
                    padding: '5px 8px',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-family-mono)',
                    fontSize: 11,
                  }}
                />
              </label>
            </div>
          )}

          {/* Indicator Node Settings */}
          {selectedNode.type === 'indicator' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>Indicator Model</span>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Indicator Kind</span>
                <select
                  value={selectedNode.indicator || 'sma'}
                  onChange={(e) => void store.updateNodeIndicator(selectedNode.id, e.target.value)}
                  style={{
                    background: 'var(--bg-surface-elevated, #2a2e39)',
                    border: '1px solid var(--border-subtle, #2a2e39)',
                    borderRadius: 'var(--radius-sm, 4px)',
                    padding: '5px 8px',
                    color: 'var(--text-primary)',
                    fontSize: 11,
                  }}
                >
                  {catalogue().indicators.map((ind) => (
                    <option key={ind.kind} value={ind.kind}>
                      {ind.kind.toUpperCase()} ({ind.family})
                    </option>
                  ))}
                </select>
              </label>

              {/* Dynamic Indicator Parameters */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>TUNABLE PARAMETERS</span>
                {(catalogue().indicators.find((e) => e.kind === selectedNode.indicator)?.params ?? []).map((spec) => {
                  const current = (selectedNode.params?.[spec.name] ?? spec.defaultValue ?? '') as string | number;
                  return (
                    <label key={spec.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{spec.name}</span>
                      <input
                        type="number"
                        value={typeof current === 'number' ? current : Number(current) || 0}
                        min={spec.min ?? undefined}
                        max={spec.max ?? undefined}
                        step={spec.step ?? undefined}
                        onChange={(e) =>
                          void store.updateNodeParams(selectedNode.id, {
                            ...(selectedNode.params ?? {}),
                            [spec.name]: Number(e.target.value),
                          })
                        }
                        style={{
                          width: 80,
                          background: 'var(--bg-surface-elevated, #2a2e39)',
                          border: '1px solid var(--border-subtle, #2a2e39)',
                          borderRadius: 'var(--radius-sm, 4px)',
                          padding: '3px 6px',
                          color: 'var(--text-primary)',
                          fontFamily: 'var(--font-family-mono)',
                          fontSize: 11,
                          textAlign: 'right',
                        }}
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Condition Node Settings */}
          {selectedNode.type === 'condition' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>Condition Rule</span>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Operator</span>
                <select
                  value={String(selectedNode.params?.op || 'crosses_above')}
                  onChange={(e) =>
                    void store.updateNodeParams(selectedNode.id, {
                      ...(selectedNode.params ?? {}),
                      op: e.target.value,
                    })
                  }
                  style={{
                    background: 'var(--bg-surface-elevated, #2a2e39)',
                    border: '1px solid var(--border-subtle, #2a2e39)',
                    borderRadius: 'var(--radius-sm, 4px)',
                    padding: '5px 8px',
                    color: 'var(--text-primary)',
                    fontSize: 11,
                  }}
                >
                  {CONDITION_OPS.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Static Threshold (Optional)</span>
                <input
                  type="number"
                  placeholder="0.0"
                  value={selectedNode.params?.threshold !== undefined ? Number(selectedNode.params.threshold) : ''}
                  onChange={(e) =>
                    void store.updateNodeParams(selectedNode.id, {
                      ...(selectedNode.params ?? {}),
                      threshold: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                  style={{
                    background: 'var(--bg-surface-elevated, #2a2e39)',
                    border: '1px solid var(--border-subtle, #2a2e39)',
                    borderRadius: 'var(--radius-sm, 4px)',
                    padding: '5px 8px',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-family-mono)',
                    fontSize: 11,
                  }}
                />
              </label>
            </div>
          )}

          {/* Order Node Settings */}
          {selectedNode.type === 'order' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>Order Action</span>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Order Side</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() =>
                      void store.updateNodeParams(selectedNode.id, {
                        ...(selectedNode.params ?? {}),
                        side: 'buy',
                      })
                    }
                    style={{
                      flex: 1,
                      padding: '6px',
                      borderRadius: 'var(--radius-sm, 4px)',
                      border: 'none',
                      background:
                        selectedNode.params?.side === 'buy' || !selectedNode.params?.side
                          ? 'var(--bullish, #089981)'
                          : 'var(--bg-surface-elevated, #2a2e39)',
                      color: selectedNode.params?.side === 'buy' || !selectedNode.params?.side ? '#fff' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    BUY / LONG
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void store.updateNodeParams(selectedNode.id, {
                        ...(selectedNode.params ?? {}),
                        side: 'sell',
                      })
                    }
                    style={{
                      flex: 1,
                      padding: '6px',
                      borderRadius: 'var(--radius-sm, 4px)',
                      border: 'none',
                      background:
                        selectedNode.params?.side === 'sell'
                          ? 'var(--bearish, #f23645)'
                          : 'var(--bg-surface-elevated, #2a2e39)',
                      color: selectedNode.params?.side === 'sell' ? '#fff' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    SELL / SHORT
                  </button>
                </div>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Quantity (Lots)</span>
                <input
                  type="number"
                  min={1}
                  value={Number(selectedNode.params?.quantity ?? 1)}
                  onChange={(e) =>
                    void store.updateNodeParams(selectedNode.id, {
                      ...(selectedNode.params ?? {}),
                      quantity: Math.max(1, Number(e.target.value)),
                    })
                  }
                  style={{
                    background: 'var(--bg-surface-elevated, #2a2e39)',
                    border: '1px solid var(--border-subtle, #2a2e39)',
                    borderRadius: 'var(--radius-sm, 4px)',
                    padding: '5px 8px',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-family-mono)',
                    fontSize: 11,
                  }}
                />
              </label>
            </div>
          )}

          {/* Validation Finding Alert */}
          {nodeIssues.length > 0 && (
            <div
              style={{
                background: 'rgba(242, 54, 69, 0.1)',
                border: '1px solid var(--bearish, #f23645)',
                borderRadius: 'var(--radius-sm, 4px)',
                padding: 8,
                marginTop: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--bearish, #f23645)', fontSize: 11, fontWeight: 700 }}>
                <AlertTriangle size={12} />
                <span>Verification Finding</span>
              </div>
              {nodeIssues.map((issue, idx) => (
                <div key={idx} style={{ fontSize: 10, marginTop: 4, color: 'var(--text-primary)' }}>
                  <code>{issue.code}</code>: {issue.message}
                </div>
              ))}
            </div>
          )}

          {/* Delete Action */}
          <button
            type="button"
            className="shortlist-btn"
            onClick={() => void store.deleteNode(selectedNode.id)}
            style={{
              marginTop: 10,
              padding: '6px 10px',
              color: 'var(--bearish, #f23645)',
              borderColor: 'rgba(242, 54, 69, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Trash2 size={12} />
            <span>Delete Node</span>
          </button>
        </div>
      ) : selectedEdge ? (
        /* 2. Edge Inspector */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Wire Connection</div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-surface-elevated, #2a2e39)',
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm, 4px)',
              fontSize: 11,
              fontFamily: 'var(--font-family-mono)',
            }}
          >
            <div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selectedEdge.from_node}</div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{selectedEdge.from_port}</div>
            </div>
            <ArrowRight size={14} style={{ color: 'var(--accent-primary, #2962ff)' }} />
            <div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selectedEdge.to_node}</div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{selectedEdge.to_port}</div>
            </div>
          </div>

          {edgePortKind ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Port Kind</span>
              <span style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--accent-primary, #2962ff)' }}>
                {edgePortKind}
              </span>
            </div>
          ) : null}

          <button
            type="button"
            className="shortlist-btn"
            onClick={() => void store.deleteEdge(selectedEdge.id)}
            style={{
              marginTop: 10,
              padding: '6px 10px',
              color: 'var(--bearish, #f23645)',
              borderColor: 'rgba(242, 54, 69, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Trash2 size={12} />
            <span>Delete Connection</span>
          </button>
        </div>
      ) : (
        /* 3. Strategy Summary when nothing is selected */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Strategy Overview</div>
          <div
            style={{
              background: 'var(--bg-surface-elevated, #2a2e39)',
              borderRadius: 'var(--radius-md, 6px)',
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Strategy Name</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{graph.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Nodes Count</span>
              <span style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--text-primary)' }}>
                {graph.nodes.length}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Connections</span>
              <span style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--text-primary)' }}>
                {(graph.edges ?? []).length}
              </span>
            </div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 8 }}>
            Click on any node or connection wire in the canvas to inspect its ports and tune its parameters.
          </div>
        </div>
      )}
    </aside>
  );
};
