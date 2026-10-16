import React from 'react';
import { useWorkbenchStore } from '../../../core/workbench/store';
import { usePortfolioStore } from '../../../core/portfolio/store';
import { formatMoney, formatPercent, moneyToMajor } from '../../../core/portfolio/money';
import type { HonbaClient } from '../../../core/api/generated/client';
import type { DrawerTab } from '../../../core/workbench/types';
import { MarketDepth } from './market-depth';
import { PortfolioHeader } from '../portfolio/portfolio-header';
import { HoldingsTable } from '../portfolio/holdings-table';
import { PositionsTable } from '../portfolio/positions-table';
import { AnalyticsView } from '../portfolio/analytics-view';
import {
  X,
  ChevronUp,
  ChevronDown,
  Briefcase,
  Layers,
  FileText,
  Clock,
  PieChart,
  BarChart2,
} from 'lucide-react';

interface TradingDrawerProps {
  client?: HonbaClient;
}

export const TradingDrawer: React.FC<TradingDrawerProps> = ({ client }) => {
  const {
    isDrawerOpen,
    drawerTab,
    setDrawerTab,
    orders,
    trades,
    cancelOrder,
    orderTicket,
  } = useWorkbenchStore();

  const { getActiveAccount } = usePortfolioStore();
  const activeAccount = getActiveAccount();

  const holdingsCount = activeAccount?.holdings.length ?? 0;
  const positionsCount = activeAccount?.positions.length ?? 0;

  const tabs: Array<{
    id: DrawerTab;
    label: string;
    icon: React.ReactNode;
    count?: number;
  }> = [
    { id: 'holdings', label: 'Holdings', icon: <Briefcase size={12} />, count: holdingsCount },
    { id: 'positions', label: 'Positions', icon: <Layers size={12} />, count: positionsCount },
    { id: 'orders', label: 'Open Orders', icon: <FileText size={12} />, count: orders.length },
    { id: 'trades', label: 'Trade Book', icon: <Clock size={12} />, count: trades.length },
    { id: 'analytics', label: 'Analytics', icon: <PieChart size={12} /> },
    { id: 'depth', label: 'Market Depth', icon: <BarChart2 size={12} /> },
  ];

  if (!isDrawerOpen) {
    const equityVal = activeAccount ? formatMoney(activeAccount.equity, activeAccount.currency) : '₹0.00';
    const totalPnl = activeAccount
      ? moneyToMajor(activeAccount.unrealized_pnl) + moneyToMajor(activeAccount.realized_pnl)
      : 0;
    const isPnlPositive = totalPnl >= 0;

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 28,
          minHeight: 28,
          background: 'var(--bg-app)',
          borderTop: '1px solid var(--border-subtle)',
          padding: '0 8px',
          zIndex: 10,
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setDrawerTab(tab.id);
                useWorkbenchStore.getState().toggleDrawer();
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '2px 8px',
                fontSize: 11,
                fontWeight: 500,
                border: 'none',
                borderRadius: 3,
                cursor: 'pointer',
                background: 'transparent',
                color: 'var(--text-secondary)',
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  style={{
                    fontSize: 9.5,
                    padding: '0 4px',
                    borderRadius: 8,
                    background: 'var(--accent-subtle)',
                    color: 'var(--accent-primary)',
                    fontWeight: 700,
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {activeAccount && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 10.5,
                fontFamily: 'var(--font-family-mono)',
              }}
            >
              <span style={{ color: 'var(--text-muted)' }}>{activeAccount.name}:</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{equityVal}</span>
              <span
                style={{
                  color: isPnlPositive ? 'var(--bullish)' : 'var(--bearish)',
                  fontWeight: 700,
                }}
              >
                ({isPnlPositive ? '+' : ''}{formatMoney(totalPnl, activeAccount.currency)})
              </span>
            </div>
          )}

          <button
            onClick={useWorkbenchStore.getState().toggleDrawer}
            title="Open Trading Drawer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 6px',
              fontSize: 10.5,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <span>Portfolio Drawer</span>
            <ChevronUp size={12} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 250,
        minHeight: 200,
        maxHeight: 340,
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
          padding: '3px 12px',
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
                gap: 5,
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
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  style={{
                    fontSize: 9.5,
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

        <button
          onClick={useWorkbenchStore.getState().toggleDrawer}
          title="Minimize Drawer"
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
          <ChevronDown size={14} />
        </button>
      </div>

      {/* Portfolio Header Bar: Account Switcher, Mode Badge, KPI Chips, Search & Refresh */}
      <PortfolioHeader />

      {/* Drawer Body Content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 12px' }}>
        {drawerTab === 'holdings' && <HoldingsTable />}

        {drawerTab === 'positions' && <PositionsTable client={client} />}

        {drawerTab === 'orders' && (
          orders.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: 24, textAlign: 'center' }}>
              No open orders
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-family-mono)' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', fontSize: 10, textTransform: 'uppercase' }}>
                  <th style={{ padding: '6px 8px' }}>Order ID</th>
                  <th style={{ padding: '6px 8px' }}>Symbol</th>
                  <th style={{ padding: '6px 8px' }}>Side</th>
                  <th style={{ padding: '6px 8px' }}>Type</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Price</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Qty</th>
                  <th style={{ padding: '6px 8px' }}>Status</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.order_id} style={{ borderBottom: '1px solid var(--border-table-row)' }}>
                    <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{o.order_id}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 600, color: 'var(--text-primary)' }}>{o.instrument_id?.symbol ?? 'Unknown'}</td>
                    <td style={{ padding: '6px 8px' }}>
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: 3,
                          textTransform: 'uppercase',
                          background: o.side === 'buy' ? 'var(--bullish-subtle)' : 'var(--bearish-subtle)',
                          color: o.side === 'buy' ? 'var(--bullish)' : 'var(--bearish)',
                        }}
                      >
                        {o.side}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>{o.order_type}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-primary)' }}>₹{o.price?.toFixed(2) ?? '-'}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-primary)' }}>{o.quantity}</td>
                    <td style={{ padding: '6px 8px', color: 'var(--accent-gold, #f59e0b)' }}>{o.status}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>
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
            <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: 24, textAlign: 'center' }}>
              No executions in this session
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-family-mono)' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', fontSize: 10, textTransform: 'uppercase' }}>
                  <th style={{ padding: '6px 8px' }}>Order ID</th>
                  <th style={{ padding: '6px 8px' }}>Symbol</th>
                  <th style={{ padding: '6px 8px' }}>Side</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Exec Price</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Qty</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-table-row)' }}>
                    <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{t.order_id}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 600, color: 'var(--text-primary)' }}>{t.instrument_id.symbol}</td>
                    <td style={{ padding: '6px 8px' }}>
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: 3,
                          textTransform: 'uppercase',
                          background: t.side === 'buy' ? 'var(--bullish-subtle)' : 'var(--bearish-subtle)',
                          color: t.side === 'buy' ? 'var(--bullish)' : 'var(--bearish)',
                        }}
                      >
                        {t.side}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-primary)' }}>₹{t.price.toFixed(2)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-primary)' }}>{t.quantity}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>₹{t.costs.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {drawerTab === 'analytics' && <AnalyticsView />}

        {drawerTab === 'depth' && (
          <div style={{ maxWidth: 500, padding: 8 }}>
            <MarketDepth symbol={orderTicket.symbol} />
          </div>
        )}
      </div>
    </div>
  );
};
