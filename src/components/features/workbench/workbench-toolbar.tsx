import React, { useEffect, useRef, useState } from 'react';
import {
  ShieldAlert,
  Power,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useWorkbenchStore } from '../../../core/workbench/store';
import type { HonbaClient } from '../../../core/api/generated/client';
import { OPENALGO_LAYOUTS, LayoutIcon, layoutById } from '../../../lib/chart/layouts';

interface WorkbenchToolbarProps {
  client?: HonbaClient;
}

export const WorkbenchToolbar: React.FC<WorkbenchToolbarProps> = ({ client }) => {
  const {
    layout,
    setLayout,
    tradingState,
    setTradingState,
    isDrawerOpen,
    toggleDrawer,
    statusMessage,
    error,
    dismissStatus,
  } = useWorkbenchStore();

  const activeLayoutId =
    layout === '1x1'
      ? 'single'
      : layout === '1x2'
      ? 'cols2'
      : layout === '2x1'
      ? 'rows2'
      : layout === '2x2'
      ? 'grid4'
      : layout;

  const activePreset = layoutById(activeLayoutId);
  const [gridMenuOpen, setGridMenuOpen] = useState(false);
  const gridMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gridMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!gridMenuRef.current?.contains(e.target as Node)) setGridMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [gridMenuOpen]);

  const handleKillSwitch = () => {
    const nextState = tradingState === 'halted' ? 'active' : 'halted';
    void setTradingState(client, nextState, 'Manual toolbar kill switch toggle');
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 14px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
          Workspace Grid:
        </span>
        <div ref={gridMenuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setGridMenuOpen((o) => !o)}
            title={activePreset.label}
            aria-haspopup="menu"
            aria-expanded={gridMenuOpen}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              border: '1px solid var(--border-subtle)',
              borderRadius: 4,
              cursor: 'pointer',
              background: 'var(--bg-app)',
              color: 'var(--text-primary)',
            }}
          >
            <LayoutIcon preset={activePreset} />
            <ChevronDown size={12} />
          </button>
          {gridMenuOpen && (
            <div
              role="menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                zIndex: 50,
                display: 'flex',
                gap: 2,
                padding: 3,
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
              }}
            >
              {OPENALGO_LAYOUTS.map((preset) => {
                const isSelected = activeLayoutId === preset.id;
                return (
                  <button
                    key={preset.id}
                    role="menuitem"
                    onClick={() => {
                      setLayout(preset.id as any);
                      setGridMenuOpen(false);
                    }}
                    title={preset.label}
                    aria-label={preset.label}
                    style={{
                      display: 'inline-flex',
                      padding: 6,
                      border: isSelected ? '1px solid var(--accent-subtle)' : '1px solid transparent',
                      borderRadius: 4,
                      cursor: 'pointer',
                      background: isSelected ? 'var(--bg-app)' : 'transparent',
                      color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    <LayoutIcon preset={preset} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {statusMessage && (
          <div
            onClick={dismissStatus}
            style={{
              fontSize: 11,
              color: 'var(--bullish)',
              background: 'var(--bullish-subtle)',
              padding: '3px 8px',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {statusMessage}
          </div>
        )}
        {error && (
          <div
            onClick={dismissStatus}
            style={{
              fontSize: 11,
              color: 'var(--bearish)',
              background: 'var(--bearish-subtle)',
              padding: '3px 8px',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 11,
              padding: '3px 8px',
              borderRadius: 4,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              background:
                tradingState === 'active'
                  ? 'var(--bullish-subtle)'
                  : tradingState === 'reducing'
                  ? 'var(--accent-gold-subtle)'
                  : 'var(--bearish-subtle)',
              color:
                tradingState === 'active'
                  ? 'var(--bullish)'
                  : tradingState === 'reducing'
                  ? 'var(--accent-gold)'
                  : 'var(--bearish)',
            }}
          >
            Engine: {tradingState}
          </span>

          <button
            onClick={handleKillSwitch}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 4,
              border: 'none',
              cursor: 'pointer',
              background: tradingState === 'halted' ? 'var(--bullish)' : 'var(--bearish)',
              color: '#ffffff',
            }}
          >
            {tradingState === 'halted' ? <Power size={12} /> : <ShieldAlert size={12} />}
            {tradingState === 'halted' ? 'Resume Trading' : 'Kill Switch'}
          </button>

          <button
            onClick={toggleDrawer}
            title={isDrawerOpen ? 'Collapse Bottom Drawer' : 'Expand Bottom Drawer'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: 5,
              border: '1px solid var(--border-subtle)',
              borderRadius: 4,
              background: 'var(--bg-app)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {isDrawerOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
};
