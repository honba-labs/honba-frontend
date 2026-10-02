import React, { useRef, useState, useEffect } from 'react';
import { CandleData } from '../../../core/market-data';

export interface InteractiveChartProps {
  candles: CandleData[];
  chartMode: 'candles' | 'area';
  hoverCandle?: CandleData | null;
  onHoverCandle?: (candle: CandleData | null) => void;
  height?: number;
  currencySymbol?: string;
  showVolume?: boolean;
}

export const InteractiveChart: React.FC<InteractiveChartProps> = ({
  candles,
  chartMode,
  hoverCandle = null,
  onHoverCandle,
  height = 340,
  currencySymbol = '₹',
  showVolume = true,
}) => {
  const containerRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height });

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
        }}
      >
        No historical candle data available
      </div>
    );
  }

  const { width, height: chartBoxHeight } = dimensions;
  const padding = { top: 20, right: 60, bottom: showVolume ? 36 : 24, left: 10 };

  const chartWidth = Math.max(100, width - padding.left - padding.right);
  const chartHeight = Math.max(100, chartBoxHeight - padding.top - padding.bottom);
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

  const candleWidth = Math.max(3, Math.min(14, (chartWidth / candles.length) * 0.7));

  // Area path for line/area mode
  const linePoints = candles.map((c, i) => `${getX(i)},${getY(c.close)}`).join(' ');
  const areaPoints = `${getX(0)},${padding.top + priceChartHeight} ${linePoints} ${getX(
    candles.length - 1
  )},${padding.top + priceChartHeight}`;

  return (
    <svg
      ref={containerRef}
      style={{ width: '100%', height: chartBoxHeight, cursor: 'crosshair', display: 'block' }}
      onMouseLeave={() => onHoverCandle?.(null)}
      onMouseMove={(e) => {
        if (!containerRef.current || !onHoverCandle) return;
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - padding.left;
        const idx = Math.round((mouseX / chartWidth) * (candles.length - 1));
        if (idx >= 0 && idx < candles.length) {
          onHoverCandle(candles[idx]);
        }
      }}
    >
      <defs>
        <linearGradient id="domainChartAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2962ff" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#2962ff" stopOpacity="0.0" />
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
              stroke="var(--border-table-row)"
              strokeDasharray="3 3"
            />
            <text
              x={padding.left + chartWidth + 8}
              y={yVal + 4}
              fill="var(--text-muted)"
              fontSize="10"
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
              />
            </g>
          );
        })
      ) : (
        <g>
          <polygon points={areaPoints} fill="url(#domainChartAreaGrad)" />
          <polyline points={linePoints} fill="none" stroke="var(--accent-primary)" strokeWidth="2" />
        </g>
      )}

      {/* Hover Crosshair & Details Tooltip */}
      {hoverCandle && (
        <g>
          <line
            x1={getX(candles.indexOf(hoverCandle))}
            y1={padding.top}
            x2={getX(candles.indexOf(hoverCandle))}
            y2={padding.top + priceChartHeight}
            stroke="var(--text-secondary)"
            strokeDasharray="2 2"
          />
          <line
            x1={padding.left}
            y1={getY(hoverCandle.close)}
            x2={padding.left + chartWidth}
            y2={getY(hoverCandle.close)}
            stroke="var(--text-secondary)"
            strokeDasharray="2 2"
          />
          <circle
            cx={getX(candles.indexOf(hoverCandle))}
            cy={getY(hoverCandle.close)}
            r="4"
            fill="var(--accent-primary)"
            stroke="#ffffff"
            strokeWidth="1.5"
          />
        </g>
      )}
    </svg>
  );
};
