import React, { useCallback, useRef } from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';

import type { DesignerPane } from '../../core/designer/store';

/**
 * Resizable pane primitives for the four-pane Algo Designer workspace
 * (Phase 1, HBD-2026-DES-004). Kept dependency-free so the shell stays light.
 */

interface SplitterProps {
  /** Called with the signed pixel delta as the user drags. */
  onDelta: (deltaPx: number) => void;
  /** Vertical bar dragged left/right (default) or horizontal bar dragged up/down. */
  orientation?: 'vertical' | 'horizontal';
  /** Keyboard nudge size, in px. */
  step?: number;
  ariaLabel: string;
}

export const Splitter: React.FC<SplitterProps> = ({ onDelta, orientation = 'vertical', step = 16, ariaLabel }) => {
  const dragging = useRef(false);
  const last = useRef(0);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    last.current = orientation === 'vertical' ? event.clientX : event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, [orientation]);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      const current = orientation === 'vertical' ? event.clientX : event.clientY;
      const delta = current - last.current;
      last.current = current;
      if (delta !== 0) onDelta(delta);
    },
    [onDelta, orientation],
  );

  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (orientation === 'vertical') {
        if (event.key === 'ArrowLeft') { event.preventDefault(); onDelta(-step); }
        if (event.key === 'ArrowRight') { event.preventDefault(); onDelta(step); }
      } else {
        if (event.key === 'ArrowUp') { event.preventDefault(); onDelta(-step); }
        if (event.key === 'ArrowDown') { event.preventDefault(); onDelta(step); }
      }
    },
    [onDelta, orientation, step],
  );

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      aria-label={ariaLabel}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      style={{
        flex: '0 0 auto',
        width: orientation === 'vertical' ? 5 : '100%',
        height: orientation === 'vertical' ? '100%' : 5,
        cursor: orientation === 'vertical' ? 'col-resize' : 'row-resize',
        background: 'var(--border-subtle, #2a2e39)',
        touchAction: 'none',
      }}
    />
  );
};

interface PaneProps {
  id: DesignerPane;
  title: string;
  icon?: React.ReactNode;
  /** Extra header controls rendered before the focus/close buttons. */
  actions?: React.ReactNode;
  focused?: boolean;
  onToggleFocus?: (pane: DesignerPane) => void;
  onClose?: (pane: DesignerPane) => void;
  children: React.ReactNode;
}

/** A titled workspace pane with a consistent header and focus/close affordances. */
export const Pane: React.FC<PaneProps> = ({ id, title, icon, actions, focused, onToggleFocus, onClose, children }) => {
  return (
    <section
      aria-label={title}
      style={{
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: 0,
        height: '100%',
        background: 'var(--bg-app, #131722)',
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '4px 8px',
          borderBottom: '1px solid var(--border-subtle, #2a2e39)',
          background: 'var(--bg-surface, #1e222d)',
          fontSize: 11,
          color: 'var(--text-secondary)',
          flex: '0 0 auto',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {icon}
          {title}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {actions}
          {onToggleFocus ? (
            <button
              type="button"
              className="shortlist-btn"
              onClick={() => onToggleFocus(id)}
              title={focused ? 'Exit focus mode' : 'Focus this pane'}
              aria-label={focused ? `Exit focus mode for ${title}` : `Focus ${title}`}
              style={{ padding: '2px 6px', display: 'flex', alignItems: 'center' }}
            >
              {focused ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              className="shortlist-btn"
              onClick={() => onClose(id)}
              title={`Hide ${title}`}
              aria-label={`Hide ${title}`}
              style={{ padding: '2px 6px', display: 'flex', alignItems: 'center' }}
            >
              <X size={12} />
            </button>
          ) : null}
        </span>
      </header>
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'auto' }}>{children}</div>
    </section>
  );
};
