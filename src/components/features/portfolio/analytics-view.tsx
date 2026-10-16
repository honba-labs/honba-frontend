import React from 'react';
import { usePortfolioStore } from '../../../core/portfolio/store';
import { formatMoney, formatPercent, moneyToMajor } from '../../../core/portfolio/money';
import { ShieldCheck, Cpu, PieChart, Activity, Wallet, Layers } from 'lucide-react';

export const AnalyticsView: React.FC = () => {
  const { getActiveAccount, snapshot } = usePortfolioStore();

  const account = getActiveAccount();
  if (!account) return null;

  const equity = moneyToMajor(account.equity);
  const cash = moneyToMajor(account.cash);
  const marginUsed = moneyToMajor(account.margin_used);
  const marginAvail = moneyToMajor(account.margin_available);
  const unrealized = moneyToMajor(account.unrealized_pnl);
  const realized = moneyToMajor(account.realized_pnl);
  const totalPnl = unrealized + realized;

  // Holdings invested value
  let holdingsValue = 0;
  const holdingWeights = account.holdings.map((h) => {
    const val = h.quantity * h.mark;
    holdingsValue += val;
    return {
      symbol: h.instrument_id.symbol,
      exchange: h.instrument_id.exchange,
      value: val,
      weight: equity > 0 ? (val / equity) * 100 : 0,
    };
  });

  holdingWeights.sort((a, b) => b.value - a.value);

  const cashWeight = equity > 0 ? Math.max(0, (cash / equity) * 100) : 100;
  const holdingsWeight = equity > 0 ? Math.min(100, (holdingsValue / equity) * 100) : 0;
  const marginWeight = equity > 0 ? Math.min(100, (marginUsed / equity) * 100) : 0;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 12,
        padding: '12px 14px',
        fontSize: 11,
      }}
    >
      {/* Card 1: Asset Allocation Breakdown */}
      <div
        style={{
          background: 'var(--bg-app)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 6,
          padding: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontWeight: 700,
            fontSize: 11.5,
            color: 'var(--text-primary)',
            marginBottom: 10,
          }}
        >
          <PieChart size={13} color="var(--accent-primary)" />
          <span>Asset Allocation & Capital Split</span>
        </div>

        {/* Visual Progress Bar */}
        <div
          style={{
            display: 'flex',
            height: 10,
            borderRadius: 5,
            overflow: 'hidden',
            background: 'var(--border-subtle)',
            marginBottom: 10,
          }}
        >
          <div
            title={`Holdings: ${holdingsWeight.toFixed(1)}%`}
            style={{
              width: `${holdingsWeight}%`,
              background: 'var(--accent-primary)',
            }}
          />
          <div
            title={`Free Cash: ${cashWeight.toFixed(1)}%`}
            style={{
              width: `${cashWeight}%`,
              background: 'var(--bullish)',
            }}
          />
          <div
            title={`Margin Used: ${marginWeight.toFixed(1)}%`}
            style={{
              width: `${marginWeight}%`,
              background: 'var(--accent-gold, #f59e0b)',
            }}
          />
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent-primary)' }} />
              <span>Delivery Holdings</span>
            </span>
            <span style={{ fontFamily: 'var(--font-family-mono)', fontWeight: 600 }}>
              {formatMoney(holdingsValue, account.currency)} ({holdingsWeight.toFixed(1)}%)
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--bullish)' }} />
              <span>Free Uncommitted Cash</span>
            </span>
            <span style={{ fontFamily: 'var(--font-family-mono)', fontWeight: 600 }}>
              {formatMoney(cash, account.currency)} ({cashWeight.toFixed(1)}%)
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent-gold, #f59e0b)' }} />
              <span>Intraday Margin Blocked</span>
            </span>
            <span style={{ fontFamily: 'var(--font-family-mono)', fontWeight: 600 }}>
              {formatMoney(marginUsed, account.currency)} ({marginWeight.toFixed(1)}%)
            </span>
          </div>
        </div>
      </div>

      {/* Card 2: Margin & Leverage Health */}
      <div
        style={{
          background: 'var(--bg-app)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 6,
          padding: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontWeight: 700,
            fontSize: 11.5,
            color: 'var(--text-primary)',
            marginBottom: 10,
          }}
        >
          <Activity size={13} color="var(--bullish)" />
          <span>Margin & Leverage Status</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ padding: 8, background: 'var(--bg-surface)', borderRadius: 4 }}>
            <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Margin Available
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-family-mono)', color: 'var(--bullish)', marginTop: 2 }}>
              {formatMoney(marginAvail, account.currency)}
            </div>
          </div>

          <div style={{ padding: 8, background: 'var(--bg-surface)', borderRadius: 4 }}>
            <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Account Leverage
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-family-mono)', color: 'var(--text-primary)', marginTop: 2 }}>
              {account.leverage.toFixed(2)}x
            </div>
          </div>

          <div style={{ padding: 8, background: 'var(--bg-surface)', borderRadius: 4 }}>
            <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Realized P&L
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                fontFamily: 'var(--font-family-mono)',
                color: realized >= 0 ? 'var(--bullish)' : 'var(--bearish)',
                marginTop: 2,
              }}
            >
              {formatMoney(realized, account.currency, { showSign: true })}
            </div>
          </div>

          <div style={{ padding: 8, background: 'var(--bg-surface)', borderRadius: 4 }}>
            <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Unrealized Mark P&L
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                fontFamily: 'var(--font-family-mono)',
                color: unrealized >= 0 ? 'var(--bullish)' : 'var(--bearish)',
                marginTop: 2,
              }}
            >
              {formatMoney(unrealized, account.currency, { showSign: true })}
            </div>
          </div>
        </div>
      </div>

      {/* Card 3: Top Holdings Concentration */}
      <div
        style={{
          background: 'var(--bg-app)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 6,
          padding: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontWeight: 700,
            fontSize: 11.5,
            color: 'var(--text-primary)',
            marginBottom: 8,
          }}
        >
          <Layers size={13} color="var(--accent-gold, #f59e0b)" />
          <span>Top Portfolio Weights</span>
        </div>

        {holdingWeights.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 11, padding: '12px 0' }}>
            No holdings to display concentration.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {holdingWeights.slice(0, 4).map((item) => (
              <div
                key={item.symbol}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '3px 0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.symbol}</span>
                  <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>{item.exchange}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-family-mono)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {formatMoney(item.value, account.currency)}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: 3,
                      background: 'rgba(255,255,255,0.06)',
                      color: 'var(--text-primary)',
                      minWidth: 42,
                      textAlign: 'right',
                    }}
                  >
                    {item.weight.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Card 4: Ledger & Audit Metadata (ADR 0032) */}
      <div
        style={{
          background: 'var(--bg-app)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 6,
          padding: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontWeight: 700,
            fontSize: 11.5,
            color: 'var(--text-primary)',
            marginBottom: 8,
          }}
        >
          <Wallet size={13} color="var(--text-secondary)" />
          <span>Account Audit & Specifications</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 10.5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Account ID:</span>
            <span style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--text-primary)' }}>
              {account.id}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Execution Mode:</span>
            <span
              style={{
                fontWeight: 700,
                textTransform: 'uppercase',
                color:
                  account.mode === 'live' ? 'var(--bullish)' : 'var(--accent-gold, #f59e0b)',
              }}
            >
              {account.mode === 'live' ? 'Live Broker (Real Money)' : 'Sandbox (Simulated Paper)'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Book Source:</span>
            <span style={{ color: 'var(--text-secondary)' }}>
              {account.source === 'broker' ? `External Broker (${account.broker})` : 'Internal Honba Ledger'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Snapshot Revision:</span>
            <span style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--text-secondary)' }}>
              rev #{snapshot.revision}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Valuation Timestamp:</span>
            <span style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--text-secondary)', fontSize: 9.5 }}>
              {new Date(snapshot.as_of.iso).toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
