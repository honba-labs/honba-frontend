import React, { useMemo } from 'react';
import { INSTRUMENTS_DATABASE } from '../../../core/market-data';

interface MarketDepthProps {
  symbol: string;
}

export const MarketDepth: React.FC<MarketDepthProps> = ({ symbol }) => {
  const ltp = useMemo(() => {
    const inst = INSTRUMENTS_DATABASE.find((i) => i.symbol.toUpperCase() === symbol.toUpperCase());
    return inst?.price ?? 1500;
  }, [symbol]);

  const depth = useMemo(() => {
    const tick = Number((ltp * 0.0005).toFixed(2)) || 0.05;
    const bids = [
      { price: Number((ltp - tick * 1).toFixed(2)), orders: 14, qty: 1250 },
      { price: Number((ltp - tick * 2).toFixed(2)), orders: 28, qty: 3400 },
      { price: Number((ltp - tick * 3).toFixed(2)), orders: 42, qty: 5800 },
      { price: Number((ltp - tick * 4).toFixed(2)), orders: 19, qty: 2100 },
      { price: Number((ltp - tick * 5).toFixed(2)), orders: 35, qty: 4500 },
    ];
    const asks = [
      { price: Number((ltp + tick * 1).toFixed(2)), orders: 18, qty: 1600 },
      { price: Number((ltp + tick * 2).toFixed(2)), orders: 31, qty: 2900 },
      { price: Number((ltp + tick * 3).toFixed(2)), orders: 50, qty: 6200 },
      { price: Number((ltp + tick * 4).toFixed(2)), orders: 22, qty: 2400 },
      { price: Number((ltp + tick * 5).toFixed(2)), orders: 29, qty: 3800 },
    ];
    const totalBidQty = bids.reduce((acc, b) => acc + b.qty, 0);
    const totalAskQty = asks.reduce((acc, a) => acc + a.qty, 0);
    const spread = Number((asks[0].price - bids[0].price).toFixed(2));
    const spreadPct = Number(((spread / ltp) * 100).toFixed(3));
    return { bids, asks, spread, spreadPct, totalBidQty, totalAskQty };
  }, [ltp]);

  const maxQty = Math.max(
    ...depth.bids.map((b) => b.qty),
    ...depth.asks.map((a) => a.qty)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, fontFamily: 'var(--font-family-mono)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 4px', color: 'var(--text-secondary)' }}>
        <span>Market Depth ({symbol})</span>
        <span>Spread: ₹{depth.spread} ({depth.spreadPct}%)</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {/* Bids */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 10, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 2 }}>
            <span>Orders</span>
            <span>Qty</span>
            <span style={{ color: 'var(--bullish)' }}>Bid</span>
          </div>
          {depth.bids.map((b, i) => (
            <div key={i} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: `${(b.qty / maxQty) * 100}%`,
                  background: 'var(--bullish-subtle)',
                  opacity: 0.5,
                  zIndex: 0,
                }}
              />
              <span style={{ position: 'relative', zIndex: 1, color: 'var(--text-muted)' }}>{b.orders}</span>
              <span style={{ position: 'relative', zIndex: 1, color: 'var(--text-primary)' }}>{b.qty.toLocaleString()}</span>
              <span style={{ position: 'relative', zIndex: 1, color: 'var(--bullish)', fontWeight: 600 }}>{b.price.toFixed(2)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, paddingTop: 4, borderTop: '1px solid var(--border-subtle)', color: 'var(--bullish)', fontWeight: 600 }}>
            <span>Total</span>
            <span>{depth.totalBidQty.toLocaleString()}</span>
          </div>
        </div>

        {/* Asks */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 10, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 2 }}>
            <span style={{ color: 'var(--bearish)' }}>Ask</span>
            <span>Qty</span>
            <span>Orders</span>
          </div>
          {depth.asks.map((a, i) => (
            <div key={i} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${(a.qty / maxQty) * 100}%`,
                  background: 'var(--bearish-subtle)',
                  opacity: 0.5,
                  zIndex: 0,
                }}
              />
              <span style={{ position: 'relative', zIndex: 1, color: 'var(--bearish)', fontWeight: 600 }}>{a.price.toFixed(2)}</span>
              <span style={{ position: 'relative', zIndex: 1, color: 'var(--text-primary)' }}>{a.qty.toLocaleString()}</span>
              <span style={{ position: 'relative', zIndex: 1, color: 'var(--text-muted)' }}>{a.orders}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, paddingTop: 4, borderTop: '1px solid var(--border-subtle)', color: 'var(--bearish)', fontWeight: 600 }}>
            <span>Total</span>
            <span>{depth.totalAskQty.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
