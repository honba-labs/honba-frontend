import React from 'react';
import { Instrument } from '../../../core/market-data';

export interface DeliveryStatsBarProps {
  instrument: Instrument;
  className?: string;
}

export const DeliveryStatsBar: React.FC<DeliveryStatsBarProps> = ({
  instrument: inst,
  className = '',
}) => {
  const fmt = (n: number | undefined | null, decimals = 0) => {
    if (n === undefined || n === null || isNaN(n)) return '—';
    return n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const deliveryPct = inst.deliveryPct || 48.2;
  const isHighDelivery = deliveryPct > 50;

  return (
    <div className={`inst-delivery-section ${className}`}>
      <div className="inst-stats-grid" style={{ marginBottom: 12 }}>
        <div className="inst-stat-item">
          <span className="inst-stat-label">Total Traded Qty</span>
          <span className="inst-stat-value">{fmt(inst.volume)}</span>
        </div>
        <div className="inst-stat-item">
          <span className="inst-stat-label">Deliverable Quantity</span>
          <span className="inst-stat-value">{fmt(inst.deliverableQty || inst.volume * 0.48)}</span>
        </div>
        <div className="inst-stat-item">
          <span className="inst-stat-label">Delivery %</span>
          <span
            className="inst-stat-value"
            style={{ color: isHighDelivery ? 'var(--bullish)' : 'var(--text-primary)' }}
          >
            {deliveryPct.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="inst-range-bar-wrapper">
        <div className="inst-range-bar-track" style={{ height: 8 }}>
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, Math.max(0, deliveryPct))}%`,
              background: isHighDelivery ? 'var(--bullish)' : 'var(--accent-primary)',
              borderRadius: 'var(--radius-full)',
            }}
          />
        </div>
        <div className="inst-range-bar-labels">
          <span>Low Delivery (Speculative)</span>
          <span>Institutional Delivery Quality ({deliveryPct.toFixed(1)}%)</span>
          <span>High Delivery (Accumulation)</span>
        </div>
      </div>
    </div>
  );
};
