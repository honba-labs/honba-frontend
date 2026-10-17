import React, { useState, useRef, useEffect } from 'react';
import { usePortfolioStore } from '../../../core/portfolio/store';
import { formatMoney, formatPercent, moneyToMajor } from '../../../core/portfolio/money';
import {
  RefreshCw,
  Search,
  ChevronDown,
  ShieldCheck,
  Cpu,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Check,
} from 'lucide-react';
import type { PortfolioMode } from '../../../core/portfolio/types';

export const PortfolioHeader: React.FC = () => {
  const {
    snapshot,
    activeAccountId,
    setActiveAccount,
    searchQuery,
    setSearchQuery,
    modeFilter,
    setModeFilter,
    loadPortfolio,
    isLoading,
    getActiveAccount,
  } = usePortfolioStore();

  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const activeAccount = getActiveAccount();
  if (!activeAccount) return null;

  const accounts = snapshot.accounts.filter((a) => {
    if (modeFilter === 'all') return true;
    return a.mode === modeFilter;
  });

  const equityMajor = moneyToMajor(activeAccount.equity);
  const cashMajor = moneyToMajor(activeAccount.cash);
  const marginUsedMajor = moneyToMajor(activeAccount.margin_used);
  const unrealizedMajor = moneyToMajor(activeAccount.unrealized_pnl);
  const realizedMajor = moneyToMajor(activeAccount.realized_pnl);
  const totalPnlMajor = unrealizedMajor + realizedMajor;
  const investedMajor = Math.max(0, equityMajor - cashMajor);
  const pnlPercent = investedMajor > 0 ? (totalPnlMajor / investedMajor) * 100 : 0;
  const isPnlPositive = totalPnlMajor >= 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        background: 'var(--bg-app)',
        borderBottom: '1px solid var(--border-subtle)',
        gap: 12,
        flexWrap: 'wrap',
        fontSize: 11,
      }}
    >
      {/* Left: Account Selector & Mode Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div ref={accountMenuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setAccountMenuOpen((o) => !o)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 8px',
              borderRadius: 4,
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background:
                  activeAccount.mode === 'live' ? 'var(--bullish)' : 'var(--accent-gold, #f59e0b)',
              }}
            />
            <span>{activeAccount.name}</span>
            <span
              style={{
                fontSize: 9.5,
                padding: '1px 5px',
                borderRadius: 3,
                fontWeight: 700,
                textTransform: 'uppercase',
                background:
                  activeAccount.mode === 'live'
                    ? 'var(--bullish-subtle)'
                    : 'rgba(245, 158, 11, 0.15)',
                color:
                  activeAccount.mode === 'live' ? 'var(--bullish)' : 'var(--accent-gold, #f59e0b)',
              }}
            >
              {activeAccount.mode}
            </span>
            <ChevronDown size={11} style={{ opacity: 0.7 }} />
          </button>

          {accountMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 4,
                width: 260,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                zIndex: 100,
                padding: 4,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '4px 8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>Portfolio Accounts</span>
                <div style={{ display: 'flex', gap: 2 }}>
                  {(['all', 'sandbox', 'live'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={(e) => {
                        e.stopPropagation();
                        setModeFilter(mode);
                      }}
                      style={{
                        fontSize: 9,
                        padding: '1px 5px',
                        borderRadius: 3,
                        border: 'none',
                        cursor: 'pointer',
                        background: modeFilter === mode ? 'var(--accent-primary)' : 'transparent',
                        color: modeFilter === mode ? '#fff' : 'var(--text-secondary)',
                      }}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {accounts.map((acc) => {
                const isSelected = acc.id === activeAccountId;
                return (
                  <button
                    key={acc.id}
                    onClick={() => {
                      setActiveAccount(acc.id);
                      setAccountMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: 4,
                      border: 'none',
                      background: isSelected ? 'var(--bg-app)' : 'transparent',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      marginBottom: 2,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: isSelected ? 700 : 500, fontSize: 11 }}>
                        {acc.name}
                      </div>
                      <div
                        style={{
                          fontSize: 9.5,
                          color: 'var(--text-muted)',
                          display: 'flex',
                          gap: 6,
                          alignItems: 'center',
                          marginTop: 2,
                        }}
                      >
                        <span
                          style={{
                            color:
                              acc.mode === 'live'
                                ? 'var(--bullish)'
                                : 'var(--accent-gold, #f59e0b)',
                            textTransform: 'uppercase',
                            fontWeight: 600,
                          }}
                        >
                          {acc.mode}
                        </span>
                        <span>•</span>
                        <span>{acc.source === 'broker' ? acc.broker ?? 'Broker' : 'Ledger'}</span>
                        <span>•</span>
                        <span>{acc.currency}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, fontSize: 11, fontFamily: 'var(--font-family-mono)' }}>
                        {formatMoney(acc.equity, acc.currency)}
                      </div>
                      {isSelected && <Check size={12} color="var(--accent-primary)" style={{ marginTop: 2 }} />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Source info pill */}
        <span
          style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {activeAccount.source === 'broker' ? (
            <>
              <ShieldCheck size={12} color="var(--bullish)" />
              <span>Synced via {activeAccount.broker ?? 'broker'}</span>
            </>
          ) : (
            <>
              <Cpu size={12} color="var(--accent-primary)" />
              <span>Honba Ledger</span>
            </>
          )}
        </span>
      </div>

      {/* Center: Financial KPI Chips */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontFamily: 'var(--font-family-mono)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Net Equity
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
            {formatMoney(activeAccount.equity, activeAccount.currency)}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Available Cash
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {formatMoney(activeAccount.cash, activeAccount.currency)}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Margin Used
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
            {formatMoney(activeAccount.margin_used, activeAccount.currency)}
          </span>
        </div>

        {activeAccount.greeks && (
          <div
            title="Net Options Greeks (OpenAlgo Strategy Risk)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '2px 8px',
              borderRadius: 4,
              background: 'var(--accent-subtle, rgba(99, 102, 241, 0.1))',
              border: '1px solid var(--border-subtle)',
              fontSize: 10,
            }}
          >
            <span>Δ: <strong>{activeAccount.greeks.delta.toFixed(2)}</strong></span>
            <span>Θ: <strong>{activeAccount.greeks.theta.toFixed(1)}</strong></span>
          </div>
        )}

        {/* Total Day P&L Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 4,
            background: isPnlPositive ? 'var(--bullish-subtle)' : 'var(--bearish-subtle)',
            color: isPnlPositive ? 'var(--bullish)' : 'var(--bearish)',
            fontWeight: 700,
            fontSize: 11,
          }}
        >
          {isPnlPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          <span>{formatMoney(totalPnlMajor, activeAccount.currency, { showSign: true })}</span>
          <span style={{ opacity: 0.85, fontSize: 10 }}>
            ({formatPercent(pnlPercent, { showSign: true })})
          </span>
        </div>
      </div>

      {/* Right: Search Filter & Refresh */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 6px',
            borderRadius: 4,
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
          }}
        >
          <Search size={11} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Filter symbols..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: 10.5,
              width: 90,
            }}
          />
        </div>

        <button
          onClick={() => void loadPortfolio()}
          disabled={isLoading}
          title="Refresh Portfolio"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '3px 6px',
            borderRadius: 4,
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          <RefreshCw
            size={11}
            style={{
              animation: isLoading ? 'spin 1s linear infinite' : undefined,
            }}
          />
        </button>
      </div>
    </div>
  );
};
