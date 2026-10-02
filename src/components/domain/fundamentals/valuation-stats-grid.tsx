import React from 'react';
import { Instrument } from '../../../core/market-data';

export interface ValuationStatsGridProps {
  instrument: Instrument;
  className?: string;
}

export const ValuationStatsGrid: React.FC<ValuationStatsGridProps> = ({
  instrument: inst,
  className = '',
}) => {
  const fmt = (n: number | undefined | null, decimals = 2) => {
    if (n === undefined || n === null || isNaN(n)) return '—';
    return n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const fmtCompact = (n: number | undefined | null) => {
    if (n === undefined || n === null || isNaN(n)) return '—';
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
    return `₹${n.toFixed(0)}`;
  };

  return (
    <div className={`inst-stats-grid ${className}`}>
      <div className="inst-stat-item">
        <span className="inst-stat-label">Market Cap</span>
        <span className="inst-stat-value">{fmtCompact(inst.marketCap)}</span>
      </div>
      <div className="inst-stat-item">
        <span className="inst-stat-label">P/E Ratio</span>
        <span className="inst-stat-value">{fmt(inst.pe)}</span>
      </div>
      <div className="inst-stat-item">
        <span className="inst-stat-label">Forward P/E</span>
        <span className="inst-stat-value">{fmt(inst.forwardPe)}</span>
      </div>
      <div className="inst-stat-item">
        <span className="inst-stat-label">P/B Ratio</span>
        <span className="inst-stat-value">{fmt(inst.pb)}</span>
      </div>
      <div className="inst-stat-item">
        <span className="inst-stat-label">Dividend Yield</span>
        <span className="inst-stat-value">{inst.dividendYield !== undefined ? `${inst.dividendYield.toFixed(2)}%` : '—'}</span>
      </div>
      <div className="inst-stat-item">
        <span className="inst-stat-label">EPS (TTM)</span>
        <span className="inst-stat-value">₹{fmt(inst.eps)}</span>
      </div>
      <div className="inst-stat-item">
        <span className="inst-stat-label">ROCE</span>
        <span className="inst-stat-value">{inst.roce ? `${inst.roce.toFixed(1)}%` : '—'}</span>
      </div>
      <div className="inst-stat-item">
        <span className="inst-stat-label">ROE</span>
        <span className="inst-stat-value">{inst.roe ? `${inst.roe.toFixed(1)}%` : '—'}</span>
      </div>
      <div className="inst-stat-item">
        <span className="inst-stat-label">Debt to Equity</span>
        <span className="inst-stat-value">{fmt(inst.debtToEquity)}</span>
      </div>
    </div>
  );
};
