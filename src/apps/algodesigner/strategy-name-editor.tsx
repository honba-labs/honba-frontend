import React, { useEffect, useState } from 'react';
import { Check, FileCode, Pencil, X } from 'lucide-react';

export interface StrategyNameEditorProps {
  name: string;
  onChange: (nextName: string) => void | Promise<void>;
  showFileExtension?: boolean;
  prefix?: string;
}

export const StrategyNameEditor: React.FC<StrategyNameEditorProps> = ({
  name,
  onChange,
  showFileExtension = true,
  prefix,
}) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(name);

  useEffect(() => {
    setVal(name);
  }, [name]);

  const commit = () => {
    const sanitized = val.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (sanitized && sanitized !== name) {
      void onChange(sanitized);
    } else {
      setVal(name);
    }
    setEditing(false);
  };

  if (!editing) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {prefix ? <span style={{ color: 'var(--text-secondary)' }}>{prefix}</span> : null}
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Click to rename strategy / Python .py file"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            background: 'var(--bg-surface-elevated, #2a2e39)',
            border: '1px solid var(--border-subtle, #363a45)',
            borderRadius: 'var(--radius-sm, 4px)',
            padding: '2px 8px',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'var(--font-family-mono)',
            transition: 'all var(--transition-fast, 120ms ease)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-medium)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-subtle)';
          }}
        >
          <FileCode size={12} style={{ color: 'var(--theme-blue, #2962ff)' }} />
          <span>{name}{showFileExtension ? '.py' : ''}</span>
          <Pencil size={11} style={{ color: 'var(--text-muted)', marginLeft: 2 }} />
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {prefix ? <span style={{ color: 'var(--text-secondary)' }}>{prefix}</span> : null}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          background: 'var(--bg-surface-elevated, #2a2e39)',
          border: '1px solid var(--border-focus, #2962ff)',
          borderRadius: 'var(--radius-sm, 4px)',
          padding: '1px 6px',
        }}
      >
        <input
          autoFocus
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setVal(name);
              setEditing(false);
            }
          }}
          onBlur={commit}
          placeholder="strategy_name"
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontWeight: 600,
            fontSize: 12,
            fontFamily: 'var(--font-family-mono)',
            width: 140,
            padding: '2px 0',
          }}
        />
        {showFileExtension ? (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-family-mono)' }}>.py</span>
        ) : null}
      </div>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          commit();
        }}
        title="Apply name"
        style={{
          background: 'var(--bullish, #089981)',
          border: 'none',
          borderRadius: 3,
          color: '#ffffff',
          padding: '3px 6px',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        <Check size={11} />
      </button>
      <button
        type="button"
        onClick={() => {
          setVal(name);
          setEditing(false);
        }}
        title="Cancel"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted)',
          padding: '3px 4px',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        <X size={11} />
      </button>
    </div>
  );
};
