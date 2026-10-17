import React, { useMemo } from 'react';
import type { ChartBar } from '../../../core/simulator/chart-data';
import { resampleBars } from '../../../core/simulator/chart-data';
import type { ChartIndicatorSpec } from '../../../core/simulator/chart-series';
import type { TradeMarker, RoundTrip } from '../../../core/simulator/trade-pairing';
import { InteractiveChart } from './interactive-chart';

export interface MultiChartViewProps {
  bars: readonly ChartBar[];
  indicators: readonly ChartIndicatorSpec[];
  markers: readonly TradeMarker[];
  trips: readonly RoundTrip[];
  seriesKey: string;
  multiTimeframe: boolean;
  secondaryTimeframe: string;
  instrumentId: string;
  primaryTimeframe: string;
  isReplaying?: boolean;
}

export const MultiChartView: React.FC<MultiChartViewProps> = ({
  bars,
  indicators,
  markers,
  trips,
  seriesKey,
  multiTimeframe,
  secondaryTimeframe,
  instrumentId,
  primaryTimeframe,
  isReplaying,
}) => {
  // Resample higher timeframe bars
  const secondaryBars = useMemo(() => {
    if (!multiTimeframe || bars.length === 0) return [];
    return resampleBars(bars, secondaryTimeframe);
  }, [multiTimeframe, bars, secondaryTimeframe]);

  if (!multiTimeframe) {
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <InteractiveChart
          bars={bars}
          indicators={indicators}
          markers={markers}
          trips={trips}
          seriesKey={seriesKey}
          isReplaying={isReplaying}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 2,
        background: 'var(--border-subtle, #2a2e39)',
        position: 'relative',
      }}
    >
      {/* Primary Driving Timeframe Chart */}
      <div style={{ position: 'relative', height: '100%', background: 'var(--bg-canvas, #131722)', display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            padding: '3px 8px',
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--accent-primary, #4f8cff)',
            background: 'var(--bg-surface-elevated, #1e222d)',
            borderBottom: '1px solid var(--border-subtle, #2a2e39)',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>Primary: {instrumentId} ({primaryTimeframe})</span>
          <span style={{ color: 'var(--text-muted)' }}>{bars.length} bars</span>
        </div>
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <InteractiveChart
            bars={bars}
            indicators={indicators}
            markers={markers}
            trips={trips}
            seriesKey={`${seriesKey}|primary`}
            isReplaying={isReplaying}
          />
        </div>
      </div>

      {/* Secondary Higher Timeframe Chart */}
      <div style={{ position: 'relative', height: '100%', background: 'var(--bg-canvas, #131722)', display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            padding: '3px 8px',
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--accent-gold, #f7a600)',
            background: 'var(--bg-surface-elevated, #1e222d)',
            borderBottom: '1px solid var(--border-subtle, #2a2e39)',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>Higher Timeframe: {instrumentId} ({secondaryTimeframe})</span>
          <span style={{ color: 'var(--text-muted)' }}>{secondaryBars.length} aggregated bars</span>
        </div>
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <InteractiveChart
            bars={secondaryBars}
            indicators={indicators}
            markers={markers}
            trips={trips}
            seriesKey={`${seriesKey}|secondary|${secondaryTimeframe}`}
            showVolume={false}
            isReplaying={isReplaying}
          />
        </div>
      </div>
    </div>
  );
};
