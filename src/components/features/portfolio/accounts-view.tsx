import React, { useEffect, useState } from 'react';
import { usePortfolioStore } from '../../../core/portfolio/store';
import { formatMoney, moneyToMajor } from '../../../core/portfolio/money';
import { useHonbaClient } from '../../../core/api/use-honba-client';
import { Wallet, ShieldCheck, Cpu, TrendingUp, TrendingDown } from 'lucide-react';
import type { PortfolioAccount } from '../../../core/portfolio/types';

export const AccountsView: React.FC = () => {
  const { snapshot, getActiveAccount, loadPortfolioAccounts } = usePortfolioStore();
  const client = useHonbaClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeAccount = getActiveAccount();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        await loadPortfolioAccounts(client);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [client, loadPortfolioAccounts]);

  if (loading) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading accounts...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '16px', color: 'var(--bearish)', fontSize: 12 }}>
        {error}
      </div>
    );
  }

  const accounts = snapshot.accounts || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {accounts.map((acc: PortfolioAccount) => {
        const equity = acc.equity;
        const cash = acc.cash;
        const mkt = acc.market_value;
        const unrealized = acc.unrealized_pnl;
        const realized = acc.realized_pnl;
        const totalPnl = moneyToMajor(unrealized) + moneyToMajor(realized); // conceptual, sum major
        const isLive = acc.mode === 'live';
        const isActive = activeAccount?.id === acc.id;

        // compute totals
        const totalUnrealized = Number(unrealized.amount || 0) * (unrealized.currency === 'INR' ? 0.01 : 1); // hack, but better use moneyToMajor
        // simpler: compute via values

        return (
          <div
            key={acc.id}
            style={{
              background: 'var(--bg-surface)',
              border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
              borderRadius: 6,
              padding: 12,
              opacity: isActive ? 1 : 0.9,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{acc.name}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  <span style={{ textTransform: 'uppercase', color: isLive ? 'var(--bullish)' : 'var(--accent-gold, #f59e0b)' }}>
                    {acc.mode}
                  </span>
                  <span>•</span>
                  <span>{acc.source === 'broker' ? (acc.broker || 'Broker') : 'Ledger'}</span>
                  <span>•</span>
                  <span>{acc.currency}</span>
                </div>
              </div>
              {isActive && (
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: 'var(--accent-subtle)', color: 'var(--accent-primary)', fontWeight: 700 }}>
                  Active
                </span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, fontSize: 11 }}>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>Equity</div>
                <div style={{ fontWeight: 600, fontFamily: 'var(--font-family-mono)' }}>{formatMoney(equity)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>Cash</div>
                <div style={{ fontFamily: 'var(--font-family-mono)' }}>{formatMoney(cash)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>Market Value</div>
                <div style={{ fontFamily: 'var(--font-family-mono)' }}>{formatMoney(mkt)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>Margin Used</div>
                <div style={{ fontFamily: 'var(--font-family-mono)' }}>{formatMoney(acc.margin_used)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>Margin Available</div>
                <div style={{ fontFamily: 'var(--font-family-mono)' }}>{formatMoney(acc.margin_available)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11 }}>
              <div style={{ color: 'var(--text-muted)' }}>Holdings: {acc.holdings.length}</div>
              <div style={{ color: 'var(--text-muted)' }}>Positions: {acc.positions.length}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
