import React from 'react';
import {
  Square,
  Columns2,
  Rows2,
  Grid2x2,
  ShieldAlert,
  Power,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useWorkbenchStore } from '../../../core/workbench/store';
import type { WorkbenchLayout } from '../../../core/workbench/types';
import type { HonbaClient } from '../../../core/api/generated/client';

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

  const layouts: Array<{ id: WorkbenchLayout; label: string; icon: React.ReactNode }> = [
    { id: '1x1', label: 'Single', icon: <Square size={13} /> },
    { id: '1x2', label: '2-Split (V)', icon: <Columns2 size={13} /> },
    { id: '2x1', label: '2-Split (H)', icon: <Rows2 size={13} /> },
    { id: '2x2', label: 'Quad (4)', icon: <Grid2x2 size={13} /> },
  ];

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
        padding: '8px 16px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
          Layout:
        </span>
        <div style={{ display: 'inline-flex', background: 'var(--bg-app)', padding: 2, borderRadius: 6, gap: 2 }}>
          {layouts.map((l) => (
            <button
              key={l.id}
              onClick={() => setLayout(l.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 8px',
                fontSize: 11,
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                background: layout === l.id ? 'var(--bg-surface-elevated)' : 'transparent',
                color: layout === l.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: layout === l.id ? 600 : 400,
                transition: 'all 0.15s ease',
              }}
            >
              {l.icon}
              {l.label}
            </button>
          ))}
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
