import React, { useMemo } from 'react';
import { useWorkbenchStore } from '../../../core/workbench/store';
import type { ChartPaneConfig } from '../../../core/workbench/types';
import { INSTRUMENTS_DATABASE } from '../../../core/market-data';
import { generateInstrumentCandles } from '../../../core/candle-generator';
import { InteractiveChart } from '../../domain/chart/interactive-chart';
import { CandlestickChart, LineChart } from 'lucide-react';

interface ChartPaneCardProps {
  pane: ChartPaneConfig;
  index: number;
  isActive: boolean;
}

const TIMEFRAMES = ['1D', '5D', '1M', '6M', '1Y'];

export const ChartPaneCard: React.FC<ChartPaneCardProps> = ({ pane, index, isActive }) => {
  const { setActivePane, updatePane } = useWorkbenchStore();

  const instrument = useMemo(() => {
    return (
      INSTRUMENTS_DATABASE.find((i) => i.symbol.toUpperCase() === pane.symbol.toUpperCase()) ??
      INSTRUMENTS_DATABASE[0]
    );
  }, [pane.symbol]);

  const candles = useMemo(() => {
    return generateInstrumentCandles(instrument, pane.timeframe);
  }, [instrument, pane.timeframe]);

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
      {/* Pane Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: 'var(--bg-app)',
          borderBottom: '1px solid var(--border-subtle)',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
              fontSize: 12,
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

          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-family-mono)' }}>
            ₹{instrument.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>

          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '1px 6px',
              borderRadius: 4,
              background: isUp ? 'var(--bullish-subtle)' : 'var(--bearish-subtle)',
              color: isUp ? 'var(--bullish)' : 'var(--bearish)',
            }}
          >
            {isUp ? '+' : ''}
            {instrument.changePercent.toFixed(2)}%
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={(e) => {
                e.stopPropagation();
                updatePane(index, { timeframe: tf });
              }}
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 6px',
                border: 'none',
                borderRadius: 3,
                cursor: 'pointer',
                background: pane.timeframe === tf ? 'var(--accent-primary)' : 'transparent',
                color: pane.timeframe === tf ? '#ffffff' : 'var(--text-secondary)',
              }}
            >
              {tf}
            </button>
          ))}

          <button
            title={`Switch to ${pane.chartMode === 'candles' ? 'Area' : 'Candles'}`}
            onClick={(e) => {
              e.stopPropagation();
              updatePane(index, { chartMode: pane.chartMode === 'candles' ? 'area' : 'candles' });
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '3px 6px',
              border: '1px solid var(--border-subtle)',
              borderRadius: 3,
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              marginLeft: 4,
            }}
          >
            {pane.chartMode === 'candles' ? <CandlestickChart size={12} /> : <LineChart size={12} />}
          </button>
        </div>
      </div>

      {/* Interactive Chart Canvas */}
      <div style={{ flex: 1, minHeight: 0, padding: '4px 0 0 0', position: 'relative' }}>
        <InteractiveChart
          candles={candles}
          chartMode={pane.chartMode}
          height={260}
          showVolume={true}
          showTooltipBadge={true}
        />
      </div>
    </div>
  );
};
