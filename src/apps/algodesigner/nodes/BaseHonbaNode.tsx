import React from 'react';
import { Handle, Position } from '@xyflow/react';
import type { PortKind } from '../../../core/graph/validation';

export interface PortSpec {
  id: string;
  name: string;
  kind: PortKind;
  description?: string;
}

export type NodeCategory = 'data' | 'indicator' | 'logic' | 'execution' | 'risk';

export interface BaseHonbaNodeProps {
  id: string;
  selected?: boolean;
  category: NodeCategory;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  inputs?: PortSpec[];
  outputs?: PortSpec[];
  issues?: Array<{ code: string; message: string }>;
  accentColor?: string;
  children?: React.ReactNode;
}

const PORT_COLORS: Record<PortKind, string> = {
  series: 'var(--node-port-series, #38bdf8)',
  bool: 'var(--node-port-bool, #eab308)',
  size: 'var(--node-port-size, #a855f7)',
  order: 'var(--node-port-order, #22c55e)',
};

const CATEGORY_ACCENTS: Record<NodeCategory, { border: string; bg: string }> = {
  data: { border: 'var(--node-accent-data, #3b82f6)', bg: 'var(--node-accent-data-bg, rgba(41, 98, 255, 0.12))' },
  indicator: { border: 'var(--node-accent-indicator, #8b5cf6)', bg: 'var(--node-accent-indicator-bg, rgba(139, 92, 246, 0.12))' },
  logic: { border: 'var(--node-accent-logic, #f59e0b)', bg: 'var(--node-accent-logic-bg, rgba(245, 158, 11, 0.12))' },
  execution: { border: 'var(--node-accent-execution, #10b981)', bg: 'var(--node-accent-execution-bg, rgba(8, 153, 129, 0.12))' },
  risk: { border: 'var(--node-accent-risk, #1e53e5)', bg: 'var(--node-accent-risk-bg, rgba(30, 83, 229, 0.15))' },
};

export const BaseHonbaNode: React.FC<BaseHonbaNodeProps> = ({
  id,
  selected = false,
  category,
  title,
  subtitle,
  icon,
  inputs = [],
  outputs = [],
  issues = [],
  accentColor,
  children,
}) => {
  const accent = CATEGORY_ACCENTS[category];
  const borderAccent = accentColor || accent.border;
  const hasIssues = issues.length > 0;

  return (
    <div
      style={{
        background: 'var(--node-bg, var(--theme-surface, #1e222d))',
        border: selected
          ? '1px solid var(--node-border-selected, var(--theme-blue, #2962ff))'
          : hasIssues
            ? '1px solid var(--node-border-error, var(--theme-red, #f23645))'
            : '1px solid var(--node-border, var(--theme-border, #363a45))',
        borderLeft: `4px solid ${borderAccent}`,
        borderRadius: 'var(--radius-md, 6px)',
        minWidth: 190,
        maxWidth: 240,
        boxShadow: selected
          ? '0 0 0 2px rgba(41, 98, 255, 0.25), var(--shadow-md)'
          : hasIssues
            ? '0 0 0 2px rgba(242, 54, 69, 0.25), var(--shadow-sm)'
            : 'var(--shadow-sm)',
        color: 'var(--text-primary, #d1d4dc)',
        position: 'relative',
        fontSize: 12,
        transition: 'border-color var(--transition-fast, 120ms), box-shadow var(--transition-fast, 120ms)',
      }}
    >
      {/* Target input handles on the left */}
      {inputs.map((port, idx) => {
        const topOffset = inputs.length === 1 ? '50%' : `${((idx + 1) / (inputs.length + 1)) * 100}%`;
        const portColor = PORT_COLORS[port.kind] || '#888';
        return (
          <div key={port.id} style={{ position: 'absolute', left: 0, top: topOffset, transform: 'translate(-50%, -50%)' }}>
            <Handle
              type="target"
              id={port.id}
              position={Position.Left}
              style={{
                background: portColor,
                width: 10,
                height: 10,
                border: '2px solid var(--bg-surface, #1e222d)',
                borderRadius: '50%',
                position: 'relative',
                left: 0,
                top: 0,
                transform: 'none',
              }}
              title={`${port.name} (${port.kind})`}
            />
          </div>
        );
      })}

      {/* Node Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '8px 10px',
          borderBottom: '1px solid var(--border-subtle, #2a2e39)',
          background: 'rgba(0,0,0,0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 22,
              height: 22,
              borderRadius: 'var(--radius-sm, 4px)',
              background: accent.bg,
              color: borderAccent,
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 12,
                color: 'var(--text-primary, #d1d4dc)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={title}
            >
              {title}
            </div>
            {subtitle ? (
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--text-secondary, #787b86)',
                  fontFamily: 'var(--font-family-mono)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={subtitle}
              >
                {subtitle}
              </div>
            ) : null}
          </div>
        </div>

        {hasIssues ? (
          <span
            style={{
              color: 'var(--bearish, #f23645)',
              background: 'rgba(242, 54, 69, 0.15)',
              borderRadius: 'var(--radius-sm, 4px)',
              padding: '2px 4px',
              fontSize: 9,
              fontWeight: 700,
            }}
            title={issues.map((i) => `${i.code}: ${i.message}`).join('\n')}
          >
            {issues.length} {issues.length === 1 ? 'err' : 'errs'}
          </span>
        ) : null}
      </div>

      {/* Node Body / Content */}
      {children ? (
        <div style={{ padding: '6px 10px', fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {children}
        </div>
      ) : null}

      {/* Port labels footer when multiple ports exist */}
      {(inputs.length > 0 || outputs.length > 0) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '3px 8px',
            fontSize: 9,
            color: 'var(--text-muted, #5d606b)',
            fontFamily: 'var(--font-family-mono)',
            borderTop: '1px solid var(--border-subtle, #2a2e39)',
          }}
        >
          <div style={{ display: 'flex', gap: 4 }}>
            {inputs.map((p) => (
              <span key={p.id} style={{ color: PORT_COLORS[p.kind] }}>
                ← {p.id}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {outputs.map((p) => (
              <span key={p.id} style={{ color: PORT_COLORS[p.kind] }}>
                {p.id} →
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Source output handles on the right */}
      {outputs.map((port, idx) => {
        const topOffset = outputs.length === 1 ? '50%' : `${((idx + 1) / (outputs.length + 1)) * 100}%`;
        const portColor = PORT_COLORS[port.kind] || '#888';
        return (
          <div key={port.id} style={{ position: 'absolute', right: 0, top: topOffset, transform: 'translate(50%, -50%)' }}>
            <Handle
              type="source"
              id={port.id}
              position={Position.Right}
              style={{
                background: portColor,
                width: 10,
                height: 10,
                border: '2px solid var(--bg-surface, #1e222d)',
                borderRadius: '50%',
                position: 'relative',
                right: 0,
                top: 0,
                transform: 'none',
              }}
              title={`${port.name} (${port.kind})`}
            />
          </div>
        );
      })}
    </div>
  );
};
