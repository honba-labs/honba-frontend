import React from 'react';
import { useWorkbenchStore } from '../../../core/workbench/store';
import type { HonbaClient } from '../../../core/api/generated/client';
import type { DrawerTab } from '../../../core/workbench/types';
import { MarketDepth } from './market-depth';
import { X, Ban } from 'lucide-react';

interface TradingDrawerProps {
  client?: HonbaClient;
}

export const TradingDrawer: React.FC<TradingDrawerProps> = ({ client }) => {
  const {
    isDrawerOpen,
    drawerTab,
    setDrawerTab,
    positions,
    orders,
    trades,
    cancelOrder,
    closePosition,
    closeAllPositions,
    orderTicket,
  } = useWorkbenchStore();

  if (!isDrawerOpen) {
    return null;
  }

  const tabs: Array<{ id: DrawerTab; label: string; count?: number }> = [
    { id: 'positions', label: 'Positions', count: positions.length },
    { id: 'orders', label: 'Open Orders', count: orders.length },
    { id: 'trades', label: 'Trade Book', count: trades.length },
    { id: 'depth', label: 'Depth' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 220,
        minHeight: 180,
        maxHeight: 260,
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-subtle)',
        zIndex: 10,
      }}
    >
      {/* Drawer Header Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 12px',
          background: 'var(--bg-app)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', gap: 4 }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setDrawerTab(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: drawerTab === tab.id ? 700 : 500,
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                background: drawerTab === tab.id ? 'var(--bg-surface)' : 'transparent',
                color: drawerTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  style={{
                    fontSize: 10,
                    padding: '0 5px',
                    borderRadius: 10,
                    background: tab.count > 0 ? 'var(--accent-subtle)' : 'var(--border-subtle)',
                    color: tab.count > 0 ? 'var(--accent-primary)' : 'var(--text-muted)',
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {positions.length > 0 && (
            <button
              onClick={() => void closeAllPositions(client)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 10,
                padding: '2px 8px',
                border: 'none',
                borderRadius: 3,
                background: 'var(--bearish-subtle)',
                color: 'var(--bearish)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Ban size={11} /> Close All Positions
            </button>
          )}
          <button
            onClick={useWorkbenchStore.getState().toggleDrawer}
            title="Close Drawer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: 3,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              borderRadius: 3,
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Drawer Body */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px 12px' }}>
        {drawerTab === 'positions' && (
          positions.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: 16, textAlign: 'center' }}>
              No open positions
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-family-mono)' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '4px 6px' }}>Symbol</th>
                  <th style={{ padding: '4px 6px' }}>Side</th>
                  <th style={{ padding: '4px 6px' }}>Qty</th>
                  <th style={{ padding: '4px 6px' }}>Avg Price</th>
                  <th style={{ padding: '4px 6px' }}>LTP</th>
                  <th style={{ padding: '4px 6px' }}>Unrealized P&L</th>
                  <th style={{ padding: '4px 6px' }}>Realized P&L</th>
                  <th style={{ padding: '4px 6px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => {
                  const pnl = (p.ltp - p.avg_price) * p.quantity;
                  const isUp = pnl >= 0;
                  return (
                    <tr key={p.instrument_id.symbol} style={{ borderBottom: '1px solid var(--border-table-row)' }}>
                      <td style={{ padding: '6px 6px', fontWeight: 600, color: 'var(--text-primary)' }}>{p.instrument_id.symbol}</td>
                      <td style={{ padding: '6px 6px' }}>
                        <span style={{ color: p.side === 'long' ? 'var(--bullish)' : 'var(--bearish)', textTransform: 'uppercase' }}>{p.side}</span>
                      </td>
                      <td style={{ padding: '6px 6px', color: 'var(--text-primary)' }}>{p.quantity}</td>
                      <td style={{ padding: '6px 6px', color: 'var(--text-secondary)' }}>₹{p.avg_price.toFixed(2)}</td>
                      <td style={{ padding: '6px 6px', color: 'var(--text-primary)' }}>₹{p.ltp.toFixed(2)}</td>
                      <td style={{ padding: '6px 6px', color: isUp ? 'var(--bullish)' : 'var(--bearish)', fontWeight: 600 }}>
                        {isUp ? '+' : ''}₹{pnl.toFixed(2)}
                      </td>
                      <td style={{ padding: '6px 6px', color: 'var(--text-secondary)' }}>₹{p.realized_pnl.amount.toFixed(2)}</td>
                      <td style={{ padding: '6px 6px', textAlign: 'right' }}>
                        <button
                          onClick={() => void closePosition(client, p.instrument_id.symbol)}
                          style={{
                            fontSize: 10,
                            padding: '2px 6px',
                            borderRadius: 3,
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-app)',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                          }}
                        >
                          Exit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        )}

        {drawerTab === 'orders' && (
          orders.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: 16, textAlign: 'center' }}>
              No open orders
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-family-mono)' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '4px 6px' }}>Order ID</th>
                  <th style={{ padding: '4px 6px' }}>Symbol</th>
                  <th style={{ padding: '4px 6px' }}>Side</th>
                  <th style={{ padding: '4px 6px' }}>Type</th>
                  <th style={{ padding: '4px 6px' }}>Price</th>
                  <th style={{ padding: '4px 6px' }}>Qty</th>
                  <th style={{ padding: '4px 6px' }}>Status</th>
                  <th style={{ padding: '4px 6px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.order_id} style={{ borderBottom: '1px solid var(--border-table-row)' }}>
                    <td style={{ padding: '6px 6px', color: 'var(--text-muted)' }}>{o.order_id}</td>
                    <td style={{ padding: '6px 6px', fontWeight: 600, color: 'var(--text-primary)' }}>{o.instrument_id?.symbol ?? 'Unknown'}</td>
                    <td style={{ padding: '6px 6px' }}>
                      <span style={{ color: o.side === 'buy' ? 'var(--bullish)' : 'var(--bearish)', textTransform: 'uppercase' }}>{o.side}</span>
                    </td>
                    <td style={{ padding: '6px 6px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>{o.order_type}</td>
                    <td style={{ padding: '6px 6px', color: 'var(--text-primary)' }}>₹{o.price?.toFixed(2) ?? '-'}</td>
                    <td style={{ padding: '6px 6px', color: 'var(--text-primary)' }}>{o.quantity}</td>
                    <td style={{ padding: '6px 6px', color: 'var(--accent-gold)' }}>{o.status}</td>
                    <td style={{ padding: '6px 6px', textAlign: 'right' }}>
                      <button
                        onClick={() => void cancelOrder(client, o.order_id)}
                        style={{
                          fontSize: 10,
                          padding: '2px 6px',
                          borderRadius: 3,
                          border: 'none',
                          background: 'var(--bearish-subtle)',
                          color: 'var(--bearish)',
                          cursor: 'pointer',
                        }}
                      >
                        <X size={10} style={{ verticalAlign: 'middle', marginRight: 2 }} />
                        Cancel
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {drawerTab === 'trades' && (
          trades.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: 16, textAlign: 'center' }}>
              No executions in this session
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-family-mono)' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '4px 6px' }}>Order ID</th>
                  <th style={{ padding: '4px 6px' }}>Symbol</th>
                  <th style={{ padding: '4px 6px' }}>Side</th>
                  <th style={{ padding: '4px 6px' }}>Exec Price</th>
                  <th style={{ padding: '4px 6px' }}>Qty</th>
                  <th style={{ padding: '4px 6px' }}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-table-row)' }}>
                    <td style={{ padding: '6px 6px', color: 'var(--text-muted)' }}>{t.order_id}</td>
                    <td style={{ padding: '6px 6px', fontWeight: 600, color: 'var(--text-primary)' }}>{t.instrument_id.symbol}</td>
                    <td style={{ padding: '6px 6px' }}>
                      <span style={{ color: t.side === 'buy' ? 'var(--bullish)' : 'var(--bearish)', textTransform: 'uppercase' }}>{t.side}</span>
                    </td>
                    <td style={{ padding: '6px 6px', color: 'var(--text-primary)' }}>₹{t.price.toFixed(2)}</td>
                    <td style={{ padding: '6px 6px', color: 'var(--text-primary)' }}>{t.quantity}</td>
                    <td style={{ padding: '6px 6px', color: 'var(--text-secondary)' }}>₹{t.costs.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {drawerTab === 'depth' && (
          <div style={{ maxWidth: 500, padding: 8 }}>
            <MarketDepth symbol={orderTicket.symbol} />
          </div>
        )}
      </div>
    </div>
  );
};
