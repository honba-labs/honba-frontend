import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

import '../styles/theme.css';
import '../styles/base.css';
import '../styles/components.css';

import { themeEngine } from '../core/theme-engine';
import { AppShell } from '../layouts/app-shell';
import { HonbaClient } from '../core/api/generated/client';
import { usePortfolioStore } from '../core/portfolio/store';
import { useWorkbenchStore } from '../core/workbench/store';
import { formatMoney, formatPercent, moneyToMajor } from '../core/portfolio/money';
import { PortfolioHeader } from '../components/features/portfolio/portfolio-header';
import { HoldingsTable } from '../components/features/portfolio/holdings-table';
import { PositionsTable } from '../components/features/portfolio/positions-table';
import { AnalyticsView } from '../components/features/portfolio/analytics-view';
import { AccountsView } from '../components/features/portfolio/accounts-view';
import { TradesTable } from '../components/features/portfolio/trades-table';
import { OrderModal } from '../components/features/workbench/order-modal';
import {
  Briefcase,
  Layers,
  FileText,
  Clock,
  PieChart,
  PlusCircle,
  X,
  Wallet,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Cpu,
  Users,
} from 'lucide-react';
import type { PortfolioTab } from '../core/portfolio/types';

export const PortfolioApp: React.FC = () => {
  const client = useMemo(() => new HonbaClient({}), []);
  const [activeTab, setActiveTab] = useState<PortfolioTab>('holdings');

  const {
    snapshot,
    getActiveAccount,
    loadPortfolio,
    isLoading,
    error,
    lastLoadedAt,
  } = usePortfolioStore();

  const { orders, trades, cancelOrder, openOrderModal, fetchState } = useWorkbenchStore();

  useEffect(() => {
    themeEngine.applyToDOM();
    void loadPortfolio();
    void fetchState(client);
  }, [client, loadPortfolio, fetchState]);

  const account = getActiveAccount();
  if (!account) return null;

  const holdingsCount = account.holdings.length;
  const positionsCount = account.positions.length;

  const equityMajor = moneyToMajor(account.equity);
  const cashMajor = moneyToMajor(account.cash);
  const mktValMajor = moneyToMajor(account.market_value);
  const marginAvailMajor = moneyToMajor(account.margin_available);
  const unrealizedMajor = moneyToMajor(account.unrealized_pnl);
  const realizedMajor = moneyToMajor(account.realized_pnl);
  const totalPnlMajor = unrealizedMajor + realizedMajor;
  const isPnlPositive = totalPnlMajor >= 0;
  const investedMajor = Math.max(0, equityMajor - cashMajor);
  const pnlPercent = investedMajor > 0 ? (totalPnlMajor / investedMajor) * 100 : 0;

  const tabs: Array<{
    id: PortfolioTab;
    label: string;
    icon: React.ReactNode;
    count?: number;
  }> = [
    { id: 'accounts', label: 'Accounts', icon: <Users size={14} />, count: snapshot.accounts?.length },
    { id: 'holdings', label: 'Holdings', icon: <Briefcase size={14} />, count: holdingsCount },
    { id: 'positions', label: 'Open Positions', icon: <Layers size={14} />, count: positionsCount },
    { id: 'orders', label: 'Orders', icon: <FileText size={14} />, count: orders.length },
    { id: 'trades', label: 'Trade History', icon: <Clock size={14} />, count: trades.length },
    { id: 'analytics', label: 'Portfolio Analytics', icon: <PieChart size={14} /> },
  ];

  return (
    <AppShell currentAppId="portfolio">
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          background: 'var(--bg-app)',
          overflow: 'hidden',
        }}
      >
        {/* Top Control Bar with Account Switcher, Mode, and Search */}
        <PortfolioHeader />
        {lastLoadedAt && (
          <div style={{ padding: '4px 16px', fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}>
            As of: {new Date(lastLoadedAt).toLocaleString()}
          </div>
        )}
        {error && (
          <div style={{ padding: '6px 16px', fontSize: 11, color: 'var(--bearish)', background: 'var(--bearish-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
            {error}
          </div>
        )}
        {isLoading && (
          <div style={{ padding: '4px 16px', fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}>
            Loading portfolio...
          </div>
        )}

        {/* Big KPI Summary Banner */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
            padding: '12px 16px',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          {/* Card 1: Total Equity */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 6,
              background: 'var(--bg-app)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Portfolio Equity
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-family-mono)', color: 'var(--text-primary)', marginTop: 4 }}>
              {formatMoney(account.equity, account.currency)}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>Base: {account.currency}</span>
              <span>•</span>
              <span style={{ textTransform: 'uppercase', color: account.mode === 'live' ? 'var(--bullish)' : 'var(--accent-gold, #f59e0b)', fontWeight: 600 }}>
                {account.mode}
              </span>
            </div>
          </div>

          {/* Card 2: Cash & Margin Available */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 6,
              background: 'var(--bg-app)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Available Cash
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-family-mono)', color: 'var(--text-secondary)', marginTop: 4 }}>
              {formatMoney(account.cash, account.currency)}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              Margin Free: {formatMoney(account.margin_available, account.currency)}
            </div>
          </div>

          {/* Card 3: Holdings Market Value */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 6,
              background: 'var(--bg-app)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Holdings Market Value
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-family-mono)', color: 'var(--text-primary)', marginTop: 4 }}>
              {formatMoney(mktValMajor, account.currency)}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              {holdingsCount} Delivery Instruments
            </div>
          </div>

          {/* Card 4: Total P&L & Day Returns */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 6,
              background: isPnlPositive ? 'var(--bullish-subtle)' : 'var(--bearish-subtle)',
              border: `1px solid ${isPnlPositive ? 'rgba(38, 166, 154, 0.3)' : 'rgba(239, 83, 80, 0.3)'}`,
            }}
          >
            <div style={{ fontSize: 10, color: isPnlPositive ? 'var(--bullish)' : 'var(--bearish)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
              Total Return / P&L
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                fontFamily: 'var(--font-family-mono)',
                color: isPnlPositive ? 'var(--bullish)' : 'var(--bearish)',
                marginTop: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {isPnlPositive ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
              <span>{formatMoney(totalPnlMajor, account.currency, { showSign: true })}</span>
            </div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: isPnlPositive ? 'var(--bullish)' : 'var(--bearish)', marginTop: 4 }}>
              {formatPercent(pnlPercent, { showSign: true })} Return
            </div>
          </div>

          {/* Card 5: Quick Trade Action */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '10px 14px',
              borderRadius: 6,
              background: 'var(--bg-app)',
              border: '1px dashed var(--border-subtle)',
              gap: 6,
            }}
          >
            <button
              onClick={() => openOrderModal({ side: 'buy' })}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 4,
                border: 'none',
                background: 'var(--accent-primary)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <PlusCircle size={14} />
              <span>Place New Order</span>
            </button>
            <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>
              Buy / Sell into {account.name}
            </span>
          </div>
        </div>

        {/* Tab Navigation Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', gap: 4 }}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '10px 14px',
                    fontSize: 12,
                    fontWeight: isActive ? 700 : 500,
                    border: 'none',
                    borderBottom: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    background: 'transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      style={{
                        fontSize: 9.5,
                        padding: '1px 6px',
                        borderRadius: 10,
                        background: tab.count > 0 ? 'var(--accent-subtle)' : 'var(--border-subtle)',
                        color: tab.count > 0 ? 'var(--accent-primary)' : 'var(--text-muted)',
                        fontWeight: 700,
                      }}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content Area */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '16px',
          }}
        >
          {activeTab === 'accounts' && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '8px 12px' }}>
              <AccountsView />
            </div>
          )}

          {activeTab === 'holdings' && (
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                padding: '8px 12px',
              }}
            >
              <HoldingsTable />
            </div>
          )}

          {activeTab === 'positions' && (
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                padding: '8px 12px',
              }}
            >
              <PositionsTable client={client} />
            </div>
          )}

          {activeTab === 'orders' && (
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                padding: '12px',
              }}
            >
              {orders.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: 32, textAlign: 'center' }}>
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
              )}
            </div>
          )}

          {activeTab === 'trades' && (
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                padding: '12px',
              }}
            >
              <TradesTable trades={trades} />
            </div>
          )}

          {activeTab === 'analytics' && <AnalyticsView />}
        </div>

        {/* Modal for executing orders */}
        <OrderModal client={client} />
      </div>
    </AppShell>
  );
};

// Mount to DOM
const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<PortfolioApp />);
}
