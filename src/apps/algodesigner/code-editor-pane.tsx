import React, { Suspense, lazy, useState } from 'react';

import { CodePane } from './panels';
import type { EditorMarker } from '../../core/designer/diagnostics';

/**
 * Python code editor pane (Phase 2, HBD-2026-DES-004).
 *
 * Lazily loads Monaco so the editor bundle never lands in the Designer's initial
 * payload, and falls back to the plain `CodePane` textarea if the editor fails to
 * load. Unifies the pane chrome (status strip) for both paths.
 */

const MonacoPythonEditor = lazy(() => import('./monaco-python-editor'));

export type SyncStatus = 'idle' | 'pending' | 'synced' | 'invalid';

export interface CodeEditorPaneProps {
  value: string;
  onChange: (value: string) => void;
  markers?: EditorMarker[];
  /** Code -> flow recognition status (wired in Phase 3; defaults to idle). */
  syncStatus?: SyncStatus;
  /** Short graph hash to display, if known. */
  hash?: string;
}

interface BoundaryState {
  failed: boolean;
}

class EditorErrorBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  render(): React.ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const SYNC_LABEL: Record<SyncStatus, { text: string; color: string }> = {
  idle: { text: 'AST: ready', color: 'var(--text-muted)' },
  pending: { text: 'Pending valid syntax…', color: 'var(--accent-gold, #f7a600)' },
  synced: { text: 'Graph synced (clean)', color: 'var(--bullish, #089981)' },
  invalid: { text: 'Last valid graph held', color: 'var(--bearish, #f23645)' },
};

export const CodeEditorPane: React.FC<CodeEditorPaneProps> = ({ value, onChange, markers, syncStatus = 'idle', hash }) => {
  const [cursor, setCursor] = useState<{ line: number; column: number }>({ line: 1, column: 1 });
  const errorCount = (markers ?? []).filter((m) => m.severity === 'error').length;
  const sync = SYNC_LABEL[syncStatus];
  const fallback = <CodePane code={value} onChange={onChange} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <EditorErrorBoundary fallback={fallback}>
          <Suspense fallback={fallback}>
            <MonacoPythonEditor value={value} onChange={onChange} markers={markers} onCursorChange={setCursor} />
          </Suspense>
        </EditorErrorBoundary>
      </div>
      <div
        data-testid="editor-status-strip"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '3px 10px',
          borderTop: '1px solid var(--border-subtle, #2a2e39)',
          background: 'var(--bg-surface, #1e222d)',
          fontSize: 11,
          color: 'var(--text-secondary)',
          flex: '0 0 auto',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>
            Ln {cursor.line}, Col {cursor.column}
          </span>
          <span style={{ color: sync.color }}>{sync.text}</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {errorCount > 0 ? (
            <span style={{ color: 'var(--bearish, #f23645)' }}>
              {errorCount} issue{errorCount === 1 ? '' : 's'}
            </span>
          ) : (
            <span style={{ color: 'var(--bullish, #089981)' }}>No issues</span>
          )}
          {hash ? <span title="graph hash">{hash.slice(0, 8)}</span> : null}
        </span>
      </div>
    </div>
  );
};
