import React, { useRef, useState, useEffect, useId } from 'react';
import { CandleData } from '../../../core/market-data';

export interface InteractiveChartProps {
  candles: CandleData[];
  chartMode: 'candles' | 'area';
  hoverCandle?: CandleData | null;
  onHoverCandle?: (candle: CandleData | null) => void;
  height?: number;
  currencySymbol?: string;
  showVolume?: boolean;
  showTooltipBadge?: boolean;
}

export const InteractiveChart: React.FC<InteractiveChartProps> = ({
  candles,
  chartMode,
  hoverCandle: controlledHoverCandle,
  onHoverCandle,
  height = 340,
  currencySymbol = '₹',
  showVolume = true,
  showTooltipBadge = true,
}) => {
  const containerRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height });
  const [internalHoverCandle, setInternalHoverCandle] = useState<CandleData | null>(null);
  const gradUniqueId = useId().replace(/:/g, '_');

  const hoverCandle = controlledHoverCandle !== undefined ? controlledHoverCandle : internalHoverCandle;

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth || 800,
          height: containerRef.current.clientHeight || height,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [height]);

  if (!candles || candles.length === 0) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          background: 'var(--bg-app)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 12,
        }}
      >
        No historical candle data available
      </div>
    );
  }

  const { width, height: chartBoxHeight } = dimensions;
  const padding = {
    top: showTooltipBadge ? 28 : 16,
    right: 56,
    bottom: showVolume ? 36 : 22,
    left: 12,
  };

  const chartWidth = Math.max(80, width - padding.left - padding.right);
  const chartHeight = Math.max(80, chartBoxHeight - padding.top - padding.bottom);
  const priceChartHeight = showVolume ? chartHeight * 0.76 : chartHeight;
  const volumeChartHeight = showVolume ? chartHeight * 0.20 : 0;
  const volumeYOffset = padding.top + priceChartHeight + 8;

  // Calculate scales
  const prices = candles.flatMap((c) => [c.high, c.low]);
  const minPrice = Math.min(...prices) * 0.995;
  const maxPrice = Math.max(...prices) * 1.005;
  const priceRange = maxPrice - minPrice || 1;

  const volumes = candles.map((c) => c.volume);
  const maxVolume = Math.max(...volumes) || 1;

  const getX = (index: number) => padding.left + (index / Math.max(1, candles.length - 1)) * chartWidth;
  const getY = (val: number) => padding.top + priceChartHeight - ((val - minPrice) / priceRange) * priceChartHeight;
  const getVolY = (vol: number) => volumeYOffset + volumeChartHeight - (vol / maxVolume) * volumeChartHeight;

  const candleWidth = Math.max(2, Math.min(14, (chartWidth / candles.length) * 0.72));

  // Determine overall price direction for area gradient / stroke
  const firstClose = candles[0]?.open ?? minPrice;
  const lastClose = candles[candles.length - 1]?.close ?? maxPrice;
  const isNetUp = lastClose >= firstClose;
  const areaStrokeColor = isNetUp ? 'var(--bullish, #089981)' : 'var(--bearish, #f23645)';

  // Area path for line/area mode
  const linePoints = candles.map((c, i) => `${getX(i).toFixed(1)},${getY(c.close).toFixed(1)}`).join(' ');
  const areaPoints = `${getX(0).toFixed(1)},${(padding.top + priceChartHeight).toFixed(1)} ${linePoints} ${getX(
    candles.length - 1
  ).toFixed(1)},${(padding.top + priceChartHeight).toFixed(1)}`;

  const setHover = (c: CandleData | null) => {
    setInternalHoverCandle(c);
    onHoverCandle?.(c);
  };

  const activeCandleIndex = hoverCandle ? candles.indexOf(hoverCandle) : -1;
  const hoverX = activeCandleIndex >= 0 ? getX(activeCandleIndex) : null;
  const hoverY = hoverCandle ? getY(hoverCandle.close) : null;

  return (
    <div style={{ position: 'relative', width: '100%', height: chartBoxHeight, overflow: 'hidden' }}>
      {/* Tooltip Badge */}
      {showTooltipBadge && hoverCandle && (
        <div
          className="chart-tooltip-badge"
          style={{
            position: 'absolute',
            top: 6,
            left: 10,
            zIndex: 10,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 8px',
            borderRadius: 'var(--radius-xs, 4px)',
            background: 'var(--bg-surface-elevated, #1e222d)',
            border: '1px solid var(--border-subtle, #2a2e39)',
            fontSize: '11px',
            fontFamily: 'var(--font-family-mono)',
            color: 'var(--text-primary)',
            boxShadow: 'var(--shadow-sm, 0 2px 6px rgba(0,0,0,0.3))',
            pointerEvents: 'none',
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>{hoverCandle.time}</span>
          <span>•</span>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
            {currencySymbol}
            {hoverCandle.close.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: hoverCandle.close >= hoverCandle.open ? 'var(--bullish)' : 'var(--bearish)',
            }}
          >
            ({hoverCandle.close >= hoverCandle.open ? '+' : ''}
            {(hoverCandle.close - hoverCandle.open).toFixed(2)})
          </span>
        </div>
      )}

      <svg
        ref={containerRef}
        style={{ width: '100%', height: chartBoxHeight, cursor: 'crosshair', display: 'block' }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          if (!containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          const mouseX = e.clientX - rect.left - padding.left;
          const idx = Math.round((mouseX / chartWidth) * (candles.length - 1));
          if (idx >= 0 && idx < candles.length) {
            setHover(candles[idx]);
          }
        }}
      >
        <defs>
          <linearGradient id={`interactiveChartAreaGrad_${gradUniqueId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={areaStrokeColor} stopOpacity="0.32" />
            <stop offset="100%" stopColor={areaStrokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid Lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const yVal = padding.top + priceChartHeight * pct;
          const pVal = maxPrice - pct * priceRange;
          return (
            <g key={pct}>
              <line
                x1={padding.left}
                y1={yVal}
                x2={padding.left + chartWidth}
                y2={yVal}
                stroke="var(--border-table-row, #2a2e39)"
                strokeDasharray="3 3"
                opacity="0.6"
              />
              <text
                x={padding.left + chartWidth + 6}
                y={yVal + 3.5}
                fill="var(--text-muted, #787b86)"
                fontSize="9.5"
                fontFamily="var(--font-family-mono)"
              >
                {currencySymbol}{pVal.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Volume bars */}
        {showVolume &&
          candles.map((c, i) => {
            const isUp = c.close >= c.open;
            const vx = getX(i) - candleWidth / 2;
            const vy = getVolY(c.volume);
            const vh = volumeYOffset + volumeChartHeight - vy;
            return (
              <rect
                key={`vol-${i}`}
                x={vx}
                y={vy}
                width={candleWidth}
                height={Math.max(1, vh)}
                fill={isUp ? 'var(--bullish)' : 'var(--bearish)'}
                opacity="0.3"
              />
            );
          })}

        {/* Candlesticks OR Area */}
        {chartMode === 'candles' ? (
          candles.map((c, i) => {
            const isUp = c.close >= c.open;
            const color = isUp ? 'var(--bullish)' : 'var(--bearish)';
            const cx = getX(i);
            const openY = getY(c.open);
            const closeY = getY(c.close);
            const highY = getY(c.high);
            const lowY = getY(c.low);
            const bodyY = Math.min(openY, closeY);
            const bodyHeight = Math.max(2, Math.abs(closeY - openY));

            return (
              <g key={`candle-${i}`}>
                {/* Wick */}
                <line x1={cx} y1={highY} x2={cx} y2={lowY} stroke={color} strokeWidth="1.2" />
                {/* Body */}
                <rect
                  x={cx - candleWidth / 2}
                  y={bodyY}
                  width={candleWidth}
                  height={bodyHeight}
                  fill={color}
                  rx="1"
                />
              </g>
            );
          })
        ) : (
          <g>
            <polygon points={areaPoints} fill={`url(#interactiveChartAreaGrad_${gradUniqueId})`} />
            <polyline points={linePoints} fill="none" stroke={areaStrokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}

        {/* Hover Crosshair & Details Tooltip */}
        {hoverX !== null && hoverY !== null && (
          <g pointerEvents="none">
            {/* Vertical crosshair */}
            <line
              x1={hoverX}
              y1={padding.top}
              x2={hoverX}
              y2={padding.top + priceChartHeight}
              stroke="var(--text-muted, #787b86)"
              strokeDasharray="2 2"
              strokeWidth="1"
            />
            {/* Horizontal crosshair */}
            <line
              x1={padding.left}
              y1={hoverY}
              x2={padding.left + chartWidth}
              y2={hoverY}
              stroke="var(--text-muted, #787b86)"
              strokeDasharray="2 2"
              strokeWidth="1"
            />
            {/* Hover marker dot */}
            <circle
              cx={hoverX}
              cy={hoverY}
              r="4"
              fill={areaStrokeColor}
              stroke="#ffffff"
              strokeWidth="1.5"
            />
          </g>
        )}
      </svg>
    </div>
  );
};
