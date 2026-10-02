import React, { useMemo } from 'react';
import { Instrument, CandleData } from '../../../core/market-data';
import { dataLayer } from '../../../core/data-layer';
import { generateInstrumentCandles } from '../../../core/candle-generator';
import { ChartControls, ChartDisplayMode } from './chart-controls';
import { InteractiveChart } from './interactive-chart';

export interface InstrumentChartCardProps {
  instrument: Instrument;
  /** Custom candle array if provided externally (e.g. from backend endpoint) */
  customCandles?: CandleData[];
  /** Controlled timeframe selection */
  selectedRange?: string;
  /** Callback when user clicks a timeframe range */
  onRangeChange?: (range: string) => void;
  /** Controlled chart display mode */
  chartMode?: ChartDisplayMode;
  /** Callback when user changes chart mode */
  onChartModeChange?: (mode: ChartDisplayMode) => void;
  /** Allowed timeframe ranges */
  ranges?: string[];
  /** Height in pixels of chart canvas */
  height?: number;
  /** Whether to show mode buttons labels */
  showModeLabels?: boolean;
  /** Whether to display volume subplot */
  showVolume?: boolean;
  /** Whether to display the header meta summary (range % and high/low stats) */
  showHeaderMeta?: boolean;
  /** Optional container class */
  className?: string;
  /** Currency symbol (defaults to market currency symbol or ₹) */
  currencySymbol?: string;
}

export const InstrumentChartCard: React.FC<InstrumentChartCardProps> = ({
  instrument: inst,
  customCandles,
  selectedRange: controlledRange,
  onRangeChange,
  chartMode: controlledMode,
  onChartModeChange,
  ranges = ['1D', '5D', '1M', '6M', '1Y', '5Y'],
  height = 340,
  showModeLabels = true,
  showVolume = true,
  showHeaderMeta = false,
  className = '',
  currencySymbol,
}) => {
  // Uncontrolled state fallbacks
  const [internalRange, setInternalRange] = React.useState<string>(ranges[0] || '1D');
  const [internalMode, setInternalMode] = React.useState<ChartDisplayMode>('candles');
  const [hoverCandle, setHoverCandle] = React.useState<CandleData | null>(null);

  const activeRange = controlledRange !== undefined ? controlledRange : internalRange;
  const activeMode = controlledMode !== undefined ? controlledMode : internalMode;

  const handleRangeSelect = (r: string) => {
    if (onRangeChange) {
      onRangeChange(r);
    } else {
      setInternalRange(r);
    }
    setHoverCandle(null);
  };

  const handleModeSelect = (m: ChartDisplayMode) => {
    if (onChartModeChange) {
      onChartModeChange(m);
    } else {
      setInternalMode(m);
    }
  };

  // Derive candles for the active timeframe
  const candles = useMemo(() => {
    if (customCandles && customCandles.length > 0) {
      return customCandles;
    }
    return generateInstrumentCandles(inst, activeRange);
  }, [inst, activeRange, customCandles]);

  const market = dataLayer.getCurrentMarketInfo();
  const effectiveCurrency = currencySymbol || market?.currencySymbol || '₹';

  // Calculate range change & extremes for meta display
  const { minPrice, maxPrice, changeVal, changePct, isUp } = useMemo(() => {
    if (!candles || candles.length === 0) {
      return { minPrice: inst.price, maxPrice: inst.price, changeVal: 0, changePct: 0, isUp: true };
    }
    const lows = candles.map((c) => c.low);
    const highs = candles.map((c) => c.high);
    const minP = Math.min(...lows);
    const maxP = Math.max(...highs);
    const firstClose = candles[0].open;
    const lastClose = candles[candles.length - 1].close;
    const delta = lastClose - firstClose;
    const pct = firstClose !== 0 ? (delta / firstClose) * 100 : 0;
    return {
      minPrice: minP,
      maxPrice: maxP,
      changeVal: delta,
      changePct: pct,
      isUp: delta >= 0,
    };
  }, [candles, inst.price]);

  return (
    <div className={`inst-chart-wrapper ${className}`}>
      {/* Chart Control Toolbar */}
      <div className="inst-chart-controls">
        <ChartControls
          chartMode={activeMode}
          onChartModeChange={handleModeSelect}
          selectedRange={activeRange}
          onRangeChange={handleRangeSelect}
          ranges={ranges}
          showLabels={showModeLabels}
        />
      </div>

      {/* Optional Range Meta Summary Row */}
      {showHeaderMeta && (
        <div className="drawer-chart-meta-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px', fontSize: 11 }}>
          <div className="drawer-chart-meta-left">
            <span
              className={`drawer-chart-meta-change ${isUp ? 'val-up' : 'val-down'}`}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: isUp ? 'var(--bullish, #089981)' : 'var(--bearish, #f23645)',
                fontFamily: 'var(--font-family-mono)',
              }}
            >
              {isUp ? '+' : ''}
              {effectiveCurrency}
              {Math.abs(changeVal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
              ({isUp ? '+' : ''}{changePct.toFixed(2)}%)
            </span>
          </div>
          <div className="drawer-chart-meta-scale" style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-family-mono)' }}>
            <span>L: {effectiveCurrency}{minPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span>H: {effectiveCurrency}{maxPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      )}

      {/* Interactive Chart Display Area */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height,
          background: 'var(--bg-app)',
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        <InteractiveChart
          candles={candles}
          chartMode={activeMode}
          hoverCandle={hoverCandle}
          onHoverCandle={setHoverCandle}
          height={height}
          currencySymbol={effectiveCurrency}
          showVolume={showVolume}
          showTooltipBadge={true}
        />
      </div>
    </div>
  );
};
