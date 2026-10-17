import React, { useMemo, useState } from 'react';
import {
  Activity,
  BarChart2,
  Clock,
  Cpu,
  Database,
  GitBranch,
  Layers,
  Search,
  ShieldAlert,
  ShoppingCart,
  Sliders,
  TrendingUp,
  X,
} from 'lucide-react';

import { catalogue } from '../../core/graph/catalogue';
import type { GraphNode, NodeType } from '../../core/graph/model';

export interface NodeTemplate {
  type: NodeType;
  label: string;
  category: 'data' | 'indicator' | 'logic' | 'execution' | 'risk';
  description: string;
  icon: React.ReactNode;
  defaultNode: () => Omit<GraphNode, 'id'>;
}

const STATIC_TEMPLATES: NodeTemplate[] = [
  {
    type: 'universe',
    label: 'Universe',
    category: 'data',
    description: 'Trading instruments & bar timeframe',
    icon: <Database size={14} />,
    defaultNode: () => ({
      type: 'universe',
      label: 'Universe',
    }),
  },
  {
    type: 'benchmark',
    label: 'Benchmark',
    category: 'data',
    description: 'Market comparison index',
    icon: <BarChart2 size={14} />,
    defaultNode: () => ({
      type: 'benchmark',
      label: 'Benchmark',
      params: { symbol: 'NIFTY50', exchange: 'NSE' },
    }),
  },
  {
    type: 'condition',
    label: 'Condition / Cross',
    category: 'logic',
    description: 'Compare two series or trigger crosses',
    icon: <GitBranch size={14} />,
    defaultNode: () => ({
      type: 'condition',
      label: 'Cross',
      params: { op: 'crosses_above' },
    }),
  },
  {
    type: 'logic',
    label: 'Logic Gate',
    category: 'logic',
    description: 'Boolean AND, OR, or NOT evaluation',
    icon: <Cpu size={14} />,
    defaultNode: () => ({
      type: 'logic',
      label: 'AND Gate',
      params: { op: 'and' },
    }),
  },
  {
    type: 'schedule',
    label: 'Schedule',
    category: 'logic',
    description: 'Market phase or time window trigger',
    icon: <Clock size={14} />,
    defaultNode: () => ({
      type: 'schedule',
      label: 'Intraday Schedule',
      params: { phase: 'intraday' },
    }),
  },
  {
    type: 'order',
    label: 'Buy Order',
    category: 'execution',
    description: 'Dispatch long entry or cover order',
    icon: <ShoppingCart size={14} />,
    defaultNode: () => ({
      type: 'order',
      label: 'Buy Order',
      params: { side: 'buy', quantity: 1 },
    }),
  },
  {
    type: 'order',
    label: 'Sell Order',
    category: 'execution',
    description: 'Dispatch short entry or exit order',
    icon: <ShoppingCart size={14} />,
    defaultNode: () => ({
      type: 'order',
      label: 'Sell Order',
      params: { side: 'sell', quantity: 1 },
    }),
  },
  {
    type: 'sizing',
    label: 'Position Sizing',
    category: 'execution',
    description: 'Dynamic capital or lot allocation',
    icon: <Sliders size={14} />,
    defaultNode: () => ({
      type: 'sizing',
      label: 'Fixed Sizing',
      params: { mode: 'fixed_quantity', value: 1 },
    }),
  },
  {
    type: 'risk',
    label: 'Risk Gate',
    category: 'risk',
    description: 'Account drawdown & exposure guard',
    icon: <ShieldAlert size={14} />,
    defaultNode: () => ({
      type: 'risk',
      label: 'Max Drawdown Gate',
      params: { max_drawdown: 0.05 },
    }),
  },
  {
    type: 'transform',
    label: 'Transform',
    category: 'indicator',
    description: 'Log, percent change, or series normalization',
    icon: <TrendingUp size={14} />,
    defaultNode: () => ({
      type: 'transform',
      label: 'Pct Change',
      params: { op: 'pct_change' },
    }),
  },
];

interface NodePaletteProps {
  onDragStart: (event: React.DragEvent, template: NodeTemplate) => void;
  onAdd: (template: NodeTemplate) => void;
  onClose?: () => void;
}

export const NodePalette: React.FC<NodePaletteProps> = ({ onDragStart, onAdd, onClose }) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const indicatorTemplates: NodeTemplate[] = useMemo(() => {
    return catalogue().indicators.map((entry) => {
      const defaultParams: Record<string, unknown> = {};
      entry.params.forEach((p) => {
        defaultParams[p.name] = p.defaultValue;
      });
      return {
        type: 'indicator' as NodeType,
        label: `${entry.kind.toUpperCase()} (${entry.family})`,
        category: 'indicator',
        description: entry.summary,
        icon: <Activity size={14} />,
        defaultNode: () => ({
          type: 'indicator',
          indicator: entry.kind,
          label: entry.kind.toUpperCase(),
          params: defaultParams,
        }),
      };
    });
  }, []);

  const allTemplates = useMemo(() => {
    return [...STATIC_TEMPLATES, ...indicatorTemplates];
  }, [indicatorTemplates]);

  const filtered = useMemo(() => {
    return allTemplates.filter((item) => {
      if (activeCategory !== 'all' && item.category !== activeCategory) {
        return false;
      }
      if (search.trim()) {
        const query = search.toLowerCase();
        return (
          item.label.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          item.type.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [allTemplates, activeCategory, search]);

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'data', label: 'Data' },
    { id: 'indicator', label: 'Tech' },
    { id: 'logic', label: 'Logic' },
    { id: 'execution', label: 'Orders' },
    { id: 'risk', label: 'Risk' },
  ];

  return (
    <aside
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-surface, #1e222d)',
        borderRight: '1px solid var(--border-subtle, #2a2e39)',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Header */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle, #2a2e39)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Layers size={14} style={{ color: 'var(--accent-primary, #2962ff)' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Nodes</span>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="shortlist-btn"
              style={{ padding: '2px 5px', fontSize: 11 }}
              title="Close palette"
            >
              <X size={12} />
            </button>
          ) : null}
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
          Drag to canvas or click to add
        </p>

        {/* Search */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--bg-surface-elevated, #2a2e39)',
            border: '1px solid var(--border-subtle, #2a2e39)',
            borderRadius: 'var(--radius-sm, 4px)',
            padding: '4px 8px',
            marginTop: 8,
          }}
        >
          <Search size={12} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search nodes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: 11,
              width: '100%',
            }}
          />
        </div>
      </div>

      {/* Category Pills */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '6px 8px',
          borderBottom: '1px solid var(--border-subtle, #2a2e39)',
          overflowX: 'auto',
          flexShrink: 0,
        }}
      >
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            style={{
              padding: '3px 7px',
              fontSize: 10,
              fontWeight: activeCategory === cat.id ? 600 : 500,
              borderRadius: 'var(--radius-sm, 4px)',
              background: activeCategory === cat.id ? 'var(--accent-primary, #2962ff)' : 'transparent',
              color: activeCategory === cat.id ? '#fff' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all var(--transition-fast, 120ms)',
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Node Items List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.map((item, index) => (
          <div
            key={`${item.type}-${item.label}-${index}`}
            draggable
            onDragStart={(e) => onDragStart(e, item)}
            onClick={() => onAdd(item)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              background: 'var(--bg-surface-elevated, #2a2e39)',
              border: '1px solid var(--border-subtle, #2a2e39)',
              borderRadius: 'var(--radius-md, 6px)',
              cursor: 'grab',
              transition: 'border-color var(--transition-fast, 120ms), background var(--transition-fast, 120ms)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-primary, #2962ff)';
              e.currentTarget.style.background = 'var(--bg-surface-hover, #242934)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-subtle, #2a2e39)';
              e.currentTarget.style.background = 'var(--bg-surface-elevated, #2a2e39)';
            }}
            title={`${item.label} — ${item.description}`}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 26,
                height: 26,
                borderRadius: 'var(--radius-sm, 4px)',
                background: 'rgba(0, 0, 0, 0.2)',
                color: 'var(--accent-primary, #2962ff)',
                flexShrink: 0,
              }}
            >
              {item.icon}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.label}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.description}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
            No nodes found
          </div>
        ) : null}
      </div>
    </aside>
  );
};
