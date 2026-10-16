import React from 'react';
import { usePortfolioStore } from '../../../core/portfolio/store';
import { formatMoney } from '../../../core/portfolio/money';
import { SortableHeader, useSort } from './sortable-table';
import type { Trade } from '../../../core/portfolio/types';

type SortKey = 'symbol' | 'side' | 'quantity' | 'price' | 'cost';

export const TradesTable: React.FC<{ trades: Trade[] }> = ({ trades }) => {
  const { searchQuery } = usePortfolioStore();
  const { sort, handleSort } = useSort<SortKey>('symbol');

  let filtered = trades.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return t.instrument_id?.symbol?.toLowerCase().includes(q) || t.instrument_id?.exchange?.toLowerCase().includes(q);
  });

  if (sort.key) {
    filtered = [...filtered].sort((a, b) => {
      let va: any, vb: any;
      if (sort.key === 'symbol') { va = a.instrument_id?.symbol; vb = b.instrument_id?.symbol; }
      else if (sort.key === 'side') { va = a.side; vb = b.side; }
      else if (sort.key === 'quantity') { va = a.quantity; vb = b.quantity; }
      else if (sort.key === 'price') { va = a.price; vb = b.price; }
      else { va = a.costs?.amount || 0; vb = b.costs?.amount || 0; }
      if (va < vb) return sort.direction === 'asc' ? -1 : 1;
      if (va > vb) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  if (filtered.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: 32, textAlign: 'center' }}>
        No trade executions
      </div>
    );
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-family-mono)' }}>
      <thead>
        <tr style={{ color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', fontSize: 10, textTransform: 'uppercase' }}>
          <th style={{ padding: '6px 8px' }}>Order ID</th>
          <SortableHeader label="Symbol" sortKey="symbol" sortState={sort} onSort={handleSort as any} align="left" />
          <SortableHeader label="Side" sortKey="side" sortState={sort} onSort={handleSort as any} align="left" />
          <SortableHeader label="Exec Price" sortKey="price" sortState={sort} onSort={handleSort as any} align="right" />
          <SortableHeader label="Qty" sortKey="quantity" sortState={sort} onSort={handleSort as any} align="right" />
          <SortableHeader label="Cost" sortKey="cost" sortState={sort} onSort={handleSort as any} align="right" />
        </tr>
      </thead>
      <tbody>
        {filtered.map((t, idx) => (
          <tr key={idx} style={{ borderBottom: '1px solid var(--border-table-row)' }}>
            <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{t.order_id}</td>
            <td style={{ padding: '6px 8px', fontWeight: 600, color: 'var(--text-primary)' }}>{t.instrument_id?.symbol}</td>
            <td style={{ padding: '6px 8px' }}>
              <span style={{
                fontSize: 9.5,
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: 3,
                textTransform: 'uppercase',
                background: t.side === 'buy' ? 'var(--bullish-subtle)' : 'var(--bearish-subtle)',
                color: t.side === 'buy' ? 'var(--bullish)' : 'var(--bearish)',
              }}>
                {t.side}
              </span>
            </td>
            <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-primary)' }}>{t.price.toFixed ? `₹${t.price.toFixed(2)}` : t.price}</td>
            <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-primary)' }}>{t.quantity}</td>
            <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>{formatMoney(t.costs)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
