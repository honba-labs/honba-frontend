import React, { useMemo } from 'react';

import type { StrategyGraphShape } from '../../core/graph/model';
import { coerceParamValue, extractParamFields, groupParamFields, type ParamField } from '../../core/designer/params';

/**
 * GUI parameter tuner (Phase 2, HBD-2026-DES-004).
 *
 * A projection of the graph's node parameters: each control writes straight back
 * through `onParamChange(nodeId, { name: value })`, which regenerates the Python
 * code and keeps the tuner and the editor in lockstep.
 */

export interface ParamsPanelProps {
  graph: StrategyGraphShape;
  onParamChange: (nodeId: string, params: Record<string, unknown>) => void;
}

function FieldControl({ field, onChange }: { field: ParamField; onChange: (value: unknown) => void }): React.ReactElement {
  const commonStyle: React.CSSProperties = {
    background: 'var(--bg-surface-elevated, #2a2e39)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-subtle, #2a2e39)',
    borderRadius: 'var(--radius-sm, 4px)',
    padding: '2px 6px',
    fontSize: 12,
    width: 110,
  };

  if (field.options && field.options.length > 0) {
    return (
      <select
        aria-label={field.key}
        value={String(field.value)}
        onChange={(event) => onChange(coerceParamValue(field.typeName, event.target.value))}
        style={commonStyle}
      >
        {field.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (field.typeName === 'bool') {
    return (
      <input
        aria-label={field.key}
        type="checkbox"
        checked={Boolean(field.value)}
        onChange={(event) => onChange(coerceParamValue('bool', event.target.checked))}
      />
    );
  }

  if (field.typeName === 'int' || field.typeName === 'float') {
    return (
      <input
        aria-label={field.key}
        type="number"
        value={String(field.value)}
        min={field.min ?? undefined}
        max={field.max ?? undefined}
        step={field.step ?? (field.typeName === 'int' ? 1 : 'any')}
        onChange={(event) => onChange(coerceParamValue(field.typeName, event.target.value))}
        style={commonStyle}
      />
    );
  }

  return (
    <input
      aria-label={field.key}
      type="text"
      value={String(field.value ?? '')}
      onChange={(event) => onChange(coerceParamValue('str', event.target.value))}
      style={commonStyle}
    />
  );
}

export const ParamsPanel: React.FC<ParamsPanelProps> = ({ graph, onParamChange }) => {
  const groups = useMemo(() => groupParamFields(extractParamFields(graph)), [graph]);

  if (groups.length === 0) {
    return (
      <div style={{ padding: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
        No tunable parameters yet. Add an indicator or condition node on the canvas.
      </div>
    );
  }

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {groups.map((group) => (
        <section key={group.nodeId}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{group.nodeLabel}</span>
            {group.indicator ? (
              <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-muted)' }}>
                {group.indicator}
              </span>
            ) : null}
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>({group.nodeId})</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {group.fields.map((field) => (
              <label
                key={field.key}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12 }}
              >
                <span style={{ color: 'var(--text-secondary)' }}>
                  {field.name}
                  {field.codeName && field.codeName !== field.name ? (
                    <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-muted)' }} title="Generated Python parameter name">
                      {field.codeName}
                    </span>
                  ) : null}
                </span>
                <FieldControl field={field} onChange={(value) => onParamChange(field.nodeId, { [field.name]: value })} />
              </label>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};
