import React from 'react';
import { TechnicalsGauge } from '../../ui/technicals-gauge';

export interface TechnicalIndicatorGridProps {
  technicalRating: string;
  sma20?: number;
  sma50?: number;
  sma200?: number;
  rsi14?: number;
  className?: string;
  currencySymbol?: string;
}

export const TechnicalIndicatorGrid: React.FC<TechnicalIndicatorGridProps> = ({
  technicalRating,
  sma20,
  sma50,
  sma200,
  rsi14,
  className = '',
  currencySymbol = '₹',
}) => {
  const fmt = (n: number | undefined | null) => {
    if (n === undefined || n === null || isNaN(n)) return '—';
    return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const isBuy = technicalRating.includes('Buy');
  const isSell = technicalRating.includes('Sell');
  const color = isBuy ? 'var(--bullish)' : isSell ? 'var(--bearish)' : 'var(--text-primary)';

  return (
    <div className={`inst-technicals-box ${className}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Technical Rating</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{technicalRating}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 16px' }}>
        <TechnicalsGauge rating={technicalRating} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        {sma20 !== undefined && (
          <div className="inst-stat-item">
            <span className="inst-stat-label">SMA 20</span>
            <span className="inst-stat-value">{currencySymbol}{fmt(sma20)}</span>
          </div>
        )}
        {sma50 !== undefined && (
          <div className="inst-stat-item">
            <span className="inst-stat-label">SMA 50</span>
            <span className="inst-stat-value">{currencySymbol}{fmt(sma50)}</span>
          </div>
        )}
        {sma200 !== undefined && (
          <div className="inst-stat-item">
            <span className="inst-stat-label">SMA 200</span>
            <span className="inst-stat-value">{currencySymbol}{fmt(sma200)}</span>
          </div>
        )}
        {rsi14 !== undefined && (
          <div className="inst-stat-item">
            <span className="inst-stat-label">RSI (14)</span>
            <span className="inst-stat-value">{rsi14.toFixed(1)}</span>
          </div>
        )}
      </div>
    </div>
  );
};
