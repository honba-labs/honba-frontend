import React from 'react';
import { usePortfolioStore } from '../../../core/portfolio/store';
import { useWorkbenchStore } from '../../../core/workbench/store';
import { formatMoney, formatPercent, moneyToMajor } from '../../../core/portfolio/money';
import { ArrowUpRight, ArrowDownRight, ShoppingCart } from 'lucide-react';
import type { PortfolioHolding } from '../../../core/portfolio/types';
import { SortableHeader, useSort } from './sortable-table';

type SortKey = 'symbol' | 'quantity' | 'avg_price' | 'mark' | 'invested' | 'current' | 'unrealized' | 'return';

export const HoldingsTable: React.FC = () => {
  const { getActiveAccount, searchQuery } = usePortfolioStore();
  const { openOrderModal } = useWorkbenchStore();
  const { sort, handleSort } = useSort<SortKey>('symbol');

  const account = getActiveAccount();
  if (!account) return null;

  let holdings = account.holdings.filter((h) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      h.instrument_id.symbol.toLowerCase().includes(q) ||
      h.instrument_id.exchange.toLowerCase().includes(q)
    );
  });

  if (sort.key) {
    holdings = [...holdings].sort((a, b) => {
      let va: any, vb: any;
      const getMetrics = (h: PortfolioHolding) => {
        const invested = h.quantity * h.avg_price;
        const current = h.quantity * h.mark;
        const unrealized = (h.mark - h.avg_price) * h.quantity;
        const ret = invested > 0 ? (unrealized / invested) * 100 : 0;
        return { invested, current, unrealized, ret };
      };
      if (sort.key === 'symbol') {
        va = a.instrument_id.symbol;
        vb = b.instrument_id.symbol;
      } else if (sort.key === 'quantity') {
        va = a.quantity; vb = b.quantity;
      } else if (sort.key === 'avg_price') {
        va = a.avg_price; vb = b.avg_price;
      } else if (sort.key === 'mark') {
        va = a.mark; vb = b.mark;
      } else {
        const ma = getMetrics(a), mb = getMetrics(b);
        if (sort.key === 'invested') { va = ma.invested; vb = mb.invested; }
        else if (sort.key === 'current') { va = ma.current; vb = mb.current; }
        else if (sort.key === 'unrealized') { va = ma.unrealized; vb = mb.unrealized; }
        else { va = ma.ret; vb = mb.ret; }
      }
      if (va < vb) return sort.direction === 'asc' ? -1 : 1;
      if (va > vb) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

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
            <SortableHeader label="Instrument" sortKey="symbol" sortState={sort} onSort={handleSort as any} align="left" />
            <SortableHeader label="Qty" sortKey="quantity" sortState={sort} onSort={handleSort as any} align="right" />
            <SortableHeader label="Avg Price" sortKey="avg_price" sortState={sort} onSort={handleSort as any} align="right" />
            <SortableHeader label="LTP / Mark" sortKey="mark" sortState={sort} onSort={handleSort as any} align="right" />
            <SortableHeader label="Invested" sortKey="invested" sortState={sort} onSort={handleSort as any} align="right" />
            <SortableHeader label="Current Value" sortKey="current" sortState={sort} onSort={handleSort as any} align="right" />
            <SortableHeader label="Unrealized P&L" sortKey="unrealized" sortState={sort} onSort={handleSort as any} align="right" />
            <SortableHeader label="Return %" sortKey="return" sortState={sort} onSort={handleSort as any} align="right" />
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{sym}</span>
                    <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>{exch}</span>
                    {h.group_name && (
                      <span
                        style={{
                          fontSize: 8.5,
                          padding: '1px 5px',
                          borderRadius: 3,
                          background: 'var(--accent-subtle, rgba(99, 102, 241, 0.15))',
                          color: 'var(--accent-primary)' ,
                          fontWeight: 600,
                        }}
                      >
                        {h.group_name}
                      </span>
                    )}
                  </div>
                  {h.tags && h.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
                      {h.tags.map((t) => (
                        <span
                          key={t}
                          style={{
                            fontSize: 8,
                            padding: '0 4px',
                            borderRadius: 2,
                            background: 'var(--border-subtle)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
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
