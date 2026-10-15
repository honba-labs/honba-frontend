import React, { useMemo } from 'react';
import { useWorkbenchStore } from '../../../core/workbench/store';
import type { ChartPaneConfig } from '../../../core/workbench/types';
import { INSTRUMENTS_DATABASE } from '../../../core/market-data';
import { OpenAlgoChart } from './openalgo-chart';

interface ChartPaneCardProps {
  pane: ChartPaneConfig;
  index: number;
  isActive: boolean;
}

export const ChartPaneCard: React.FC<ChartPaneCardProps> = ({ pane, index, isActive }) => {
  const { setActivePane, updatePane } = useWorkbenchStore();

  const instrument = useMemo(() => {
    return (
      INSTRUMENTS_DATABASE.find((i) => i.symbol.toUpperCase() === pane.symbol.toUpperCase()) ??
      INSTRUMENTS_DATABASE[0]
    );
  }, [pane.symbol]);

  const isUp = instrument.change >= 0;

  return (
    <div
      onClick={() => setActivePane(index)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-surface)',
        borderRadius: 8,
        border: isActive ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
        overflow: 'hidden',
        minHeight: 0,
        height: '100%',
        boxShadow: isActive ? '0 0 0 1px var(--accent-primary)' : 'none',
        transition: 'border-color 0.15s ease',
      }}
    >
      {/* Pane Top Sync Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 10px',
          background: 'var(--bg-app)',
          borderBottom: '1px solid var(--border-subtle)',
          fontSize: 11,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontWeight: 700,
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 3,
              background: isActive ? 'var(--accent-primary)' : 'var(--border-subtle)',
              color: isActive ? '#ffffff' : 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Pane {index + 1} {isActive ? '(Active)' : ''}
          </span>

          <select
            value={pane.symbol}
            onChange={(e) => updatePane(index, { symbol: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-medium)',
              borderRadius: 4,
              padding: '2px 6px',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {INSTRUMENTS_DATABASE.slice(0, 30).map((inst) => (
              <option key={inst.symbol} value={inst.symbol}>
                {inst.symbol} - {inst.name.slice(0, 16)}
              </option>
            ))}
          </select>

          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-family-mono)' }}>
            ₹{instrument.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>

          <span
            style={{
              fontWeight: 600,
              padding: '1px 5px',
              borderRadius: 3,
              background: isUp ? 'var(--bullish-subtle)' : 'var(--bearish-subtle)',
              color: isUp ? 'var(--bullish)' : 'var(--bearish)',
            }}
          >
            {isUp ? '+' : ''}
            {instrument.changePercent.toFixed(2)}%
          </span>
        </div>

        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          OpenAlgo Canvas Engine (TradingView Parity)
        </div>
      </div>

      {/* Professional Canvas Chart */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        <OpenAlgoChart
          symbol={pane.symbol}
          timeframe={pane.timeframe}
          chartMode={pane.chartMode}
          onSymbolChange={(newSym) => updatePane(index, { symbol: newSym })}
          showRail={true}
        />
      </div>
    </div>
  );
};
