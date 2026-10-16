import React from 'react';
import type { NodeProps } from '@xyflow/react';
import {
  Activity,
  BarChart2,
  Clock,
  Cpu,
  Database,
  GitBranch,
  ShieldAlert,
  ShoppingCart,
  Sliders,
  TrendingUp,
} from 'lucide-react';

import type { GraphNode, TimeframeShape, UniverseShape } from '../../../core/graph/model';
import { BaseHonbaNode, type PortSpec } from './BaseHonbaNode';

export interface HonbaNodeData {
  node: GraphNode;
  issues?: Array<{ code: string; message: string }>;
  universe?: UniverseShape;
  driving_timeframe?: TimeframeShape;
  warmup_bars?: number;
}

// 1. Universe Node (Data Root)
export const UniverseNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = (data as unknown as HonbaNodeData) || {};
  const node = nodeData.node || { id, type: 'universe' };
  const universe = nodeData.universe;
  const symbol = universe?.explicit?.[0]?.symbol || universe?.named || 'NIFTY50';
  const exchange = universe?.explicit?.[0]?.exchange || 'NSE';
  const timeframe = nodeData.driving_timeframe;
  const tfText = timeframe ? `${timeframe.interval} ${timeframe.aggregation}` : '1 minute';

  const outputs: PortSpec[] = [{ id: 'bars', name: 'Bars', kind: 'series', description: 'Candlestick series' }];

  return (
    <BaseHonbaNode
      id={id}
      selected={selected}
      category="data"
      title={node.label || 'Universe'}
      subtitle={`${symbol} · ${exchange}`}
      icon={<Database size={13} />}
      outputs={outputs}
      issues={nodeData.issues}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
        <span>Timeframe</span>
        <span style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--text-primary)' }}>{tfText}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
        <span>Warmup</span>
        <span style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--text-primary)' }}>
          {nodeData.warmup_bars ?? 0} bars
        </span>
      </div>
    </BaseHonbaNode>
  );
};

// 2. Indicator Node
export const IndicatorNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = (data as unknown as HonbaNodeData) || {};
  const node = nodeData.node || { id, type: 'indicator' };
  const kind = (node.indicator || 'sma').toUpperCase();
  const params = node.params || {};
  const paramSummaries = Object.entries(params).slice(0, 3);

  const inputs: PortSpec[] = [{ id: 'input', name: 'Input', kind: 'series', description: 'Source price series' }];
  const outputs: PortSpec[] = [{ id: 'value', name: 'Value', kind: 'series', description: 'Indicator output series' }];

  return (
    <BaseHonbaNode
      id={id}
      selected={selected}
      category="indicator"
      title={node.label || `${kind} Indicator`}
      subtitle={node.indicator ? `${node.indicator} · ${id}` : id}
      icon={<Activity size={13} />}
      inputs={inputs}
      outputs={outputs}
      issues={nodeData.issues}
    >
      {paramSummaries.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {paramSummaries.map(([key, val]) => (
            <span
              key={key}
              style={{
                background: 'var(--bg-surface-elevated, #2a2e39)',
                padding: '2px 5px',
                borderRadius: 'var(--radius-xs, 3px)',
                fontFamily: 'var(--font-family-mono)',
                fontSize: 10,
              }}
            >
              {key}: {String(val)}
            </span>
          ))}
        </div>
      ) : (
        <span style={{ color: 'var(--text-muted)' }}>default parameters</span>
      )}
    </BaseHonbaNode>
  );
};

// 3. Condition Node (Cross, Greater than, etc.)
export const ConditionNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = (data as unknown as HonbaNodeData) || {};
  const node = nodeData.node || { id, type: 'condition' };
  const op = String(node.params?.op || 'gt');
  const threshold = node.params?.threshold !== undefined ? ` · ${node.params.threshold}` : '';

  const inputs: PortSpec[] = [
    { id: 'left', name: 'Left', kind: 'series', description: 'Fast series' },
    { id: 'right', name: 'Right', kind: 'series', description: 'Slow series' },
  ];
  const outputs: PortSpec[] = [{ id: 'signal', name: 'Signal', kind: 'bool', description: 'Boolean trigger signal' }];

  return (
    <BaseHonbaNode
      id={id}
      selected={selected}
      category="logic"
      title={node.label || 'Condition'}
      subtitle={`${op}${threshold}`}
      icon={<GitBranch size={13} />}
      inputs={inputs}
      outputs={outputs}
      issues={nodeData.issues}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Rule</span>
        <span
          style={{
            fontFamily: 'var(--font-family-mono)',
            color: 'var(--accent-gold, #f7a600)',
            fontWeight: 600,
          }}
        >
          {op}
        </span>
      </div>
    </BaseHonbaNode>
  );
};

// 4. Logic Gate Node (AND, OR, NOT)
export const LogicNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = (data as unknown as HonbaNodeData) || {};
  const node = nodeData.node || { id, type: 'logic' };
  const op = String(node.params?.op || 'and').toUpperCase();

  const inputs: PortSpec[] =
    op === 'NOT'
      ? [{ id: 'a', name: 'Input', kind: 'bool', description: 'Boolean signal' }]
      : [
          { id: 'a', name: 'Input A', kind: 'bool', description: 'Boolean signal A' },
          { id: 'b', name: 'Input B', kind: 'bool', description: 'Boolean signal B' },
        ];
  const outputs: PortSpec[] = [{ id: 'signal', name: 'Signal', kind: 'bool', description: 'Evaluated logic signal' }];

  return (
    <BaseHonbaNode
      id={id}
      selected={selected}
      category="logic"
      title={node.label || `${op} Gate`}
      subtitle={`Logic ${op}`}
      icon={<Cpu size={13} />}
      inputs={inputs}
      outputs={outputs}
      issues={nodeData.issues}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
        <span>Operation</span>
        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{op}</span>
      </div>
    </BaseHonbaNode>
  );
};

// 5. Order Node (Buy / Sell)
export const OrderNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = (data as unknown as HonbaNodeData) || {};
  const node = nodeData.node || { id, type: 'order' };
  const side = String(node.params?.side || 'buy').toLowerCase();
  const qty = node.params?.quantity !== undefined ? node.params.quantity : 1;
  const isBuy = side === 'buy';

  const inputs: PortSpec[] = [
    { id: 'signal', name: 'Signal', kind: 'bool', description: 'Order trigger signal' },
    { id: 'size', name: 'Size', kind: 'size', description: 'Optional dynamic size' },
  ];
  const outputs: PortSpec[] = [{ id: 'orders', name: 'Orders', kind: 'order', description: 'Emitted order events' }];

  return (
    <BaseHonbaNode
      id={id}
      selected={selected}
      category="execution"
      accentColor={isBuy ? 'var(--bullish, #089981)' : 'var(--bearish, #f23645)'}
      title={node.label || (isBuy ? 'Buy Order' : 'Sell Order')}
      subtitle={`${side.toUpperCase()} · Qty ${qty}`}
      icon={<ShoppingCart size={13} />}
      inputs={inputs}
      outputs={outputs}
      issues={nodeData.issues}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Side</span>
        <span
          style={{
            background: isBuy ? 'var(--bullish-subtle, rgba(8, 153, 129, 0.14))' : 'var(--bearish-subtle, rgba(242, 54, 69, 0.14))',
            color: isBuy ? 'var(--bullish, #089981)' : 'var(--bearish, #f23645)',
            fontWeight: 700,
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: 'var(--radius-xs, 3px)',
          }}
        >
          {side.toUpperCase()}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
        <span>Quantity</span>
        <span style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--text-primary)' }}>{String(qty)}</span>
      </div>
    </BaseHonbaNode>
  );
};

// 6. Sizing Node
export const SizingNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = (data as unknown as HonbaNodeData) || {};
  const node = nodeData.node || { id, type: 'sizing' };
  const mode = String(node.params?.mode || 'fixed_quantity');
  const value = node.params?.value !== undefined ? node.params.value : 1;

  const inputs: PortSpec[] = [{ id: 'signal', name: 'Signal', kind: 'bool', description: 'Trigger signal' }];
  const outputs: PortSpec[] = [{ id: 'size', name: 'Size', kind: 'size', description: 'Computed position size' }];

  return (
    <BaseHonbaNode
      id={id}
      selected={selected}
      category="risk"
      title={node.label || 'Position Sizing'}
      subtitle={`${mode} (${value})`}
      icon={<Sliders size={13} />}
      inputs={inputs}
      outputs={outputs}
      issues={nodeData.issues}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
        <span>Mode</span>
        <span style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--text-primary)' }}>{mode}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
        <span>Value</span>
        <span style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--text-primary)' }}>{String(value)}</span>
      </div>
    </BaseHonbaNode>
  );
};

// 7. Risk Gate Node
export const RiskNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = (data as unknown as HonbaNodeData) || {};
  const node = nodeData.node || { id, type: 'risk' };
  const maxDd = node.params?.max_drawdown !== undefined ? `${Number(node.params.max_drawdown) * 100}%` : '5%';

  const inputs: PortSpec[] = [{ id: 'signal', name: 'In', kind: 'bool', description: 'Ungated signal' }];
  const outputs: PortSpec[] = [{ id: 'signal', name: 'Out', kind: 'bool', description: 'Risk-checked signal' }];

  return (
    <BaseHonbaNode
      id={id}
      selected={selected}
      category="risk"
      title={node.label || 'Risk Gate'}
      subtitle={`Max DD: ${maxDd}`}
      icon={<ShieldAlert size={13} />}
      inputs={inputs}
      outputs={outputs}
      issues={nodeData.issues}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
        <span>Max Drawdown</span>
        <span style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--bearish, #f23645)' }}>{maxDd}</span>
      </div>
    </BaseHonbaNode>
  );
};

// 8. Transform Node
export const TransformNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = (data as unknown as HonbaNodeData) || {};
  const node = nodeData.node || { id, type: 'transform' };
  const op = String(node.params?.op || 'pct_change');

  const inputs: PortSpec[] = [{ id: 'input', name: 'Input', kind: 'series', description: 'Input series' }];
  const outputs: PortSpec[] = [{ id: 'value', name: 'Value', kind: 'series', description: 'Transformed series' }];

  return (
    <BaseHonbaNode
      id={id}
      selected={selected}
      category="indicator"
      title={node.label || 'Transform'}
      subtitle={op}
      icon={<TrendingUp size={13} />}
      inputs={inputs}
      outputs={outputs}
      issues={nodeData.issues}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
        <span>Function</span>
        <span style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--text-primary)' }}>{op}</span>
      </div>
    </BaseHonbaNode>
  );
};

// 9. Schedule Node
export const ScheduleNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = (data as unknown as HonbaNodeData) || {};
  const node = nodeData.node || { id, type: 'schedule' };
  const phase = String(node.params?.phase || 'intraday');

  const outputs: PortSpec[] = [{ id: 'signal', name: 'Signal', kind: 'bool', description: 'Scheduled trigger' }];

  return (
    <BaseHonbaNode
      id={id}
      selected={selected}
      category="logic"
      title={node.label || 'Schedule'}
      subtitle={phase}
      icon={<Clock size={13} />}
      outputs={outputs}
      issues={nodeData.issues}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
        <span>Phase</span>
        <span style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--text-primary)' }}>{phase}</span>
      </div>
    </BaseHonbaNode>
  );
};

// 10. Benchmark Node
export const BenchmarkNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const nodeData = (data as unknown as HonbaNodeData) || {};
  const node = nodeData.node || { id, type: 'benchmark' };
  const symbol = String(node.params?.symbol || 'NIFTY50');

  const inputs: PortSpec[] = [{ id: 'input', name: 'Input', kind: 'series', description: 'Series' }];
  const outputs: PortSpec[] = [{ id: 'value', name: 'Value', kind: 'series', description: 'Benchmark series' }];

  return (
    <BaseHonbaNode
      id={id}
      selected={selected}
      category="data"
      title={node.label || 'Benchmark'}
      subtitle={symbol}
      icon={<BarChart2 size={13} />}
      inputs={inputs}
      outputs={outputs}
      issues={nodeData.issues}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
        <span>Symbol</span>
        <span style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--text-primary)' }}>{symbol}</span>
      </div>
    </BaseHonbaNode>
  );
};

// Fallback Generic Card Node
export const GenericCardNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const d = (data as { label?: string; subtitle?: string }) || {};
  return (
    <div
      style={{
        padding: '8px 12px',
        minWidth: 150,
        background: 'var(--bg-surface, #1e222d)',
        border: selected ? '1px solid var(--accent-primary, #2962ff)' : '1px solid var(--border-medium, #363a45)',
        borderRadius: 'var(--radius-md, 6px)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{d.label || id}</div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{d.subtitle || id}</div>
    </div>
  );
};

export const honbaNodeTypes = {
  universe: UniverseNode,
  indicator: IndicatorNode,
  condition: ConditionNode,
  logic: LogicNode,
  order: OrderNode,
  sizing: SizingNode,
  risk: RiskNode,
  transform: TransformNode,
  schedule: ScheduleNode,
  benchmark: BenchmarkNode,
  card: GenericCardNode,
} as const;
