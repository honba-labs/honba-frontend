import React from 'react';
import { usePortfolioStore } from '../../../core/portfolio/store';
import { useWorkbenchStore } from '../../../core/workbench/store';
import { formatMoney, moneyToMajor } from '../../../core/portfolio/money';
import { Ban, ArrowUpRight, ArrowDownRight, XCircle } from 'lucide-react';
import type { PortfolioPosition } from '../../../core/portfolio/types';
import type { HonbaClient } from '../../../core/api/generated/client';
import { SortableHeader, useSort } from './sortable-table';

interface PositionsTableProps {
  client?: HonbaClient;
}

type SortKey = 'symbol' | 'side' | 'product' | 'quantity' | 'avg_price' | 'mark' | 'market_value' | 'unrealized' | 'realized';

export const PositionsTable: React.FC<PositionsTableProps> = ({ client }) => {
  const { getActiveAccount, searchQuery, closePosition, closeAllPositions } = usePortfolioStore();
  const { closePosition: wbClosePosition, closeAllPositions: wbCloseAll } = useWorkbenchStore();
  const { sort, handleSort } = useSort<SortKey>('symbol');

  const account = getActiveAccount();
  if (!account) return null;

  let positions = account.positions.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.instrument_id.symbol.toLowerCase().includes(q) ||
      p.instrument_id.exchange.toLowerCase().includes(q)
    );
  });

  if (sort.key) {
    positions = [...positions].sort((a, b) => {
      let va: any, vb: any;
      const getMetrics = (p: PortfolioPosition) => {
        const sign = p.side === 'long' ? 1 : -1;
        const marketVal = p.quantity * p.mark;
        const unrealized = (p.mark - p.avg_price) * sign * p.quantity;
        const realized = 0; // use stored; but easier compare numbers
        return { marketVal, unrealized, realized: p.realized_pnl?.amount || 0 };
      };
      if (sort.key === 'symbol') { va = a.instrument_id.symbol; vb = b.instrument_id.symbol; }
      else if (sort.key === 'side') { va = a.side; vb = b.side; }
      else if (sort.key === 'product') { va = a.product; vb = b.product; }
      else if (sort.key === 'quantity') { va = a.quantity; vb = b.quantity; }
      else if (sort.key === 'avg_price') { va = a.avg_price; vb = b.avg_price; }
      else if (sort.key === 'mark') { va = a.mark; vb = b.mark; }
      else {
        const ma = getMetrics(a), mb = getMetrics(b);
        if (sort.key === 'market_value') { va = ma.marketVal; vb = mb.marketVal; }
        else if (sort.key === 'unrealized') { va = ma.unrealized; vb = mb.unrealized; }
        else { va = ma.realized; vb = mb.realized; }
      }
      if (va < vb) return sort.direction === 'asc' ? -1 : 1;
      if (va > vb) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const handleClosePosition = (symbol: string) => {
    closePosition(symbol);
    void wbClosePosition(client, symbol);
  };

  const handleCloseAll = () => {
    closeAllPositions();
    void wbCloseAll(client);
  };

  if (positions.length === 0) {
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
        }}
      >
        <span>No open intraday or derivative positions in {account.name}.</span>
      </div>
    );
  }

  let totalMarketValue = 0;
  let totalUnrealized = 0;
  let totalRealized = 0;

  for (const p of positions) {
    const sign = p.side === 'long' ? 1 : -1;
    const mkt = p.quantity * p.mark;
    const un = (p.mark - p.avg_price) * sign * p.quantity;
    const rl = moneyToMajor(p.realized_pnl);

    totalMarketValue += mkt;
    totalUnrealized += un;
    totalRealized += rl;
  }

  const isOverallPositive = totalUnrealized >= 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* Table Action Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '4px 8px',
          background: 'rgba(255,255,255,0.01)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <button
          onClick={handleCloseAll}
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
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Ban size={11} />
          <span>Square Off All Positions</span>
        </button>
      </div>

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
            <SortableHeader label="Side" sortKey="side" sortState={sort} onSort={handleSort as any} align="left" />
            <SortableHeader label="Product" sortKey="product" sortState={sort} onSort={handleSort as any} align="left" />
            <SortableHeader label="Qty" sortKey="quantity" sortState={sort} onSort={handleSort as any} align="right" />
            <SortableHeader label="Avg Price" sortKey="avg_price" sortState={sort} onSort={handleSort as any} align="right" />
            <SortableHeader label="LTP / Mark" sortKey="mark" sortState={sort} onSort={handleSort as any} align="right" />
            <SortableHeader label="Market Value" sortKey="market_value" sortState={sort} onSort={handleSort as any} align="right" />
            <SortableHeader label="Unrealized P&L" sortKey="unrealized" sortState={sort} onSort={handleSort as any} align="right" />
            <SortableHeader label="Realized P&L" sortKey="realized" sortState={sort} onSort={handleSort as any} align="right" />
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p: PortfolioPosition) => {
            const sym = p.instrument_id.symbol;
            const exch = p.instrument_id.exchange;
            const sign = p.side === 'long' ? 1 : -1;
            const marketVal = p.quantity * p.mark;
            const unrealized = (p.mark - p.avg_price) * sign * p.quantity;
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
                    {p.group_name && (
                      <span
                        style={{
                          fontSize: 8.5,
                          padding: '1px 5px',
                          borderRadius: 3,
                          background: 'var(--accent-subtle, rgba(99, 102, 241, 0.15))',
                          color: 'var(--accent-primary)',
                          fontWeight: 600,
                        }}
                      >
                        {p.group_name}
                      </span>
                    )}
                    {p.strategy_id && (
                      <span
                        title={`Strategy: ${p.strategy_id}`}
                        style={{
                          fontSize: 8.5,
                          padding: '1px 5px',
                          borderRadius: 3,
                          background: 'rgba(245, 158, 11, 0.15)',
                          color: 'var(--accent-gold, #f59e0b)',
                          fontWeight: 600,
                        }}
                      >
                        {p.strategy_id}
                      </span>
                    )}
                  </div>
                  {p.tags && p.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
                      {p.tags.map((t) => (
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
                <td style={{ padding: '6px 8px' }}>
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: 3,
                      textTransform: 'uppercase',
                      background:
                        p.side === 'long' ? 'var(--bullish-subtle)' : 'var(--bearish-subtle)',
                      color: p.side === 'long' ? 'var(--bullish)' : 'var(--bearish)',
                    }}
                  >
                    {p.side}
                  </span>
                </td>
                <td style={{ padding: '6px 8px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  {p.product}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-primary)' }}>
                  {p.quantity}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                  {formatMoney(p.avg_price, account.currency)}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-primary)', fontWeight: 600 }}>
                  {formatMoney(p.mark, account.currency)}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-primary)' }}>
                  {formatMoney(marketVal, account.currency)}
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
                <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-muted)' }}>
                  {formatMoney(p.realized_pnl, account.currency)}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                  <button
                    onClick={() => handleClosePosition(sym)}
                    title="Exit / Square off position"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 3,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-app)',
                      color: 'var(--bearish)',
                      cursor: 'pointer',
                    }}
                  >
                    <XCircle size={10} />
                    <span>Exit</span>
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
              TOTAL ({positions.length} Open)
            </td>
            <td colSpan={5} />
            <td style={{ padding: '8px 8px', textAlign: 'right', color: 'var(--text-primary)' }}>
              {formatMoney(totalMarketValue, account.currency)}
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
            <td style={{ padding: '8px 8px', textAlign: 'right', color: 'var(--text-muted)' }}>
              {formatMoney(totalRealized, account.currency)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
};
