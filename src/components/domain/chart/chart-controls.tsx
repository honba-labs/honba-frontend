import React from 'react';

export type ChartDisplayMode = 'area' | 'candles';

export interface ChartControlsProps {
  chartMode: ChartDisplayMode;
  onChartModeChange: (mode: ChartDisplayMode) => void;
  selectedRange: string;
  onRangeChange: (range: string) => void;
  ranges?: string[];
  className?: string;
  showLabels?: boolean;
}

const DEFAULT_RANGES = ['1D', '5D', '1M', '6M', '1Y', '5Y'];

export const ChartControls: React.FC<ChartControlsProps> = ({
  chartMode,
  onChartModeChange,
  selectedRange,
  onRangeChange,
  ranges = DEFAULT_RANGES,
  className = '',
  showLabels = true,
}) => {
  return (
    <div className={`drawer-chart-controls ${className}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%', flexWrap: 'wrap' }}>
      {/* Chart Mode Toggle (Area vs Candles) */}
      <div className="drawer-chart-type-toggle">
        <button
          type="button"
          className={`chart-toggle-btn ${chartMode === 'area' ? 'active' : ''}`}
          onClick={() => onChartModeChange('area')}
          title="Area Chart"
        >
          📈 {showLabels ? 'Area' : ''}
        </button>
        <button
          type="button"
          className={`chart-toggle-btn ${chartMode === 'candles' ? 'active' : ''}`}
          onClick={() => onChartModeChange('candles')}
          title="Candlestick Chart"
        >
          🕯️ {showLabels ? 'Candles' : ''}
        </button>
      </div>

      {/* Timeframe Range Pills */}
      <div className="drawer-range-pills">
        {ranges.map((r) => (
          <button
            key={r}
            type="button"
            className={`range-pill ${selectedRange === r ? 'active' : ''}`}
            onClick={() => onRangeChange(r)}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
};
