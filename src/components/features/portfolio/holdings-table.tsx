import React from 'react';
import { usePortfolioStore } from '../../../core/portfolio/store';
import { useWorkbenchStore } from '../../../core/workbench/store';
import { formatMoney, formatPercent, moneyToMajor } from '../../../core/portfolio/money';
import { ArrowUpRight, ArrowDownRight, ShoppingCart } from 'lucide-react';
import type { PortfolioHolding } from '../../../core/portfolio/types';

export const HoldingsTable: React.FC = () => {
  const { getActiveAccount, searchQuery } = usePortfolioStore();
  const { openOrderModal } = useWorkbenchStore();

  const account = getActiveAccount();
  if (!account) return null;

  const holdings = account.holdings.filter((h) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      h.instrument_id.symbol.toLowerCase().includes(q) ||
      h.instrument_id.exchange.toLowerCase().includes(q)
    );
  });

  if (holdings.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 16px',
          color: 'var(--text-muted)',
          fontSize: 12,
          gap: 8,
        }}
      >
        <span>No delivery holdings found in {account.name}.</span>
        <button
          onClick={() => openOrderModal({ side: 'buy' })}
          style={{
            fontSize: 11,
            padding: '4px 10px',
            borderRadius: 4,
            border: 'none',
            background: 'var(--accent-primary)',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Buy Delivery Shares
        </button>
      </div>
    );
  }

  // Calculate totals for footer
  let totalInvested = 0;
  let totalCurrent = 0;
  let totalUnrealized = 0;
  let totalRealized = 0;

  for (const h of holdings) {
    const inv = h.quantity * h.avg_price;
    const cur = h.quantity * h.mark;
    const un = (h.mark - h.avg_price) * h.quantity;
    const rl = moneyToMajor(h.realized_pnl);

    totalInvested += inv;
    totalCurrent += cur;
    totalUnrealized += un;
    totalRealized += rl;
  }

  const overallPercent = totalInvested > 0 ? (totalUnrealized / totalInvested) * 100 : 0;
  const isOverallPositive = totalUnrealized >= 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 11,
          fontFamily: 'var(--font-family-mono)',
        }}
      >
        <thead>
          <tr
            style={{
              color: 'var(--text-muted)',
              textAlign: 'left',
              borderBottom: '1px solid var(--border-subtle)',
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            <th style={{ padding: '6px 8px' }}>Instrument</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Qty</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Avg Price</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>LTP / Mark</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Invested</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Current Value</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Unrealized P&L</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Return %</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h: PortfolioHolding) => {
            const sym = h.instrument_id.symbol;
            const exch = h.instrument_id.exchange;
            const invested = h.quantity * h.avg_price;
            const current = h.quantity * h.mark;
            const unrealized = (h.mark - h.avg_price) * h.quantity;
            const retPercent = invested > 0 ? (unrealized / invested) * 100 : 0;
            const isUp = unrealized >= 0;

            return (
              <tr
                key={`${exch}-${sym}`}
                style={{
                  borderBottom: '1px solid var(--border-table-row, rgba(255,255,255,0.04))',
                }}
              >
                <td style={{ padding: '6px 8px' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{sym}</span>
                  <span
                    style={{
                      fontSize: 9.5,
                      color: 'var(--text-muted)',
                      marginLeft: 6,
                    }}
                  >
                    {exch}
                  </span>
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-primary)' }}>
                  {h.quantity}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                  {formatMoney(h.avg_price, account.currency)}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-primary)', fontWeight: 600 }}>
                  {formatMoney(h.mark, account.currency)}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                  {formatMoney(invested, account.currency)}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-primary)', fontWeight: 600 }}>
                  {formatMoney(current, account.currency)}
                </td>
                <td
                  style={{
                    padding: '6px 8px',
                    textAlign: 'right',
                    color: isUp ? 'var(--bullish)' : 'var(--bearish)',
                    fontWeight: 700,
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    {isUp ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                    {formatMoney(unrealized, account.currency, { showSign: true })}
                  </span>
                </td>
                <td
                  style={{
                    padding: '6px 8px',
                    textAlign: 'right',
                    color: isUp ? 'var(--bullish)' : 'var(--bearish)',
                    fontWeight: 600,
                  }}
                >
                  {formatPercent(retPercent, { showSign: true })}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                  <button
                    onClick={() =>
                      openOrderModal({
                        symbol: sym,
                        side: 'buy',
                        price: h.mark,
                      })
                    }
                    title="Trade Instrument"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                      fontSize: 10,
                      padding: '2px 7px',
                      borderRadius: 3,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-app)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    <ShoppingCart size={10} />
                    <span>Trade</span>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr
            style={{
              borderTop: '2px solid var(--border-subtle)',
              fontWeight: 700,
              fontSize: 11,
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            <td style={{ padding: '8px 8px', color: 'var(--text-muted)' }}>
              TOTAL ({holdings.length} Holdings)
            </td>
            <td colSpan={3} />
            <td style={{ padding: '8px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>
              {formatMoney(totalInvested, account.currency)}
            </td>
            <td style={{ padding: '8px 8px', textAlign: 'right', color: 'var(--text-primary)' }}>
              {formatMoney(totalCurrent, account.currency)}
            </td>
            <td
              style={{
                padding: '8px 8px',
                textAlign: 'right',
                color: isOverallPositive ? 'var(--bullish)' : 'var(--bearish)',
              }}
            >
              {formatMoney(totalUnrealized, account.currency, { showSign: true })}
            </td>
            <td
              style={{
                padding: '8px 8px',
                textAlign: 'right',
                color: isOverallPositive ? 'var(--bullish)' : 'var(--bearish)',
              }}
            >
              {formatPercent(overallPercent, { showSign: true })}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
};
