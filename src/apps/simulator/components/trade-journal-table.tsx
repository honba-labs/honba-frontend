import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Download } from 'lucide-react';

import type { RoundTrip } from '../../../core/simulator/trade-pairing';
import { formatTimestamp, journalRows, toCsv, type JournalRow } from '../../../core/simulator/analytics';

/**
 * Trade journal table (Phase 8).
 *
 * One row per derived round trip (`trade-pairing.ts`), filterable and sortable,
 * with a CSV export built from the very rows on screen so the file and the table
 * agree by construction. **Slippage has no column value**: the journal is fills
 * with no signal price, so it is left blank rather than guessed (risk R5) — the
 * column exists only to document the absence explicitly.
 */

type SortKey = 'entryTs' | 'exitTs' | 'quantity' | 'avgEntry' | 'avgExit' | 'realizedPnl' | 'returnPct' | 'fees';

interface Column {
  key: SortKey | 'instrument' | 'direction' | 'status' | 'slippage';
  header: string;
  numeric?: boolean;
  sortable?: boolean;
}

const COLUMNS: Column[] = [
  { key: 'instrument', header: 'Symbol' },
  { key: 'direction', header: 'Side' },
  { key: 'status', header: 'Status' },
  { key: 'entryTs', header: 'Entry (UTC)', sortable: true },
  { key: 'exitTs', header: 'Exit (UTC)', sortable: true },
  { key: 'quantity', header: 'Qty', numeric: true, sortable: true },
  { key: 'avgEntry', header: 'Avg Entry', numeric: true, sortable: true },
  { key: 'avgExit', header: 'Avg Exit', numeric: true, sortable: true },
  { key: 'realizedPnl', header: 'Net PnL', numeric: true, sortable: true },
  { key: 'returnPct', header: 'Return %', numeric: true, sortable: true },
  { key: 'fees', header: 'Fees', numeric: true, sortable: true },
  { key: 'slippage', header: 'Slippage' },
];

function csvColumns() {
  return [
    { header: 'id', value: (r: JournalRow) => r.id },
    { header: 'symbol', value: (r: JournalRow) => r.instrument },
    { header: 'side', value: (r: JournalRow) => r.direction },
    { header: 'status', value: (r: JournalRow) => r.status },
    { header: 'entry_ts', value: (r: JournalRow) => formatTimestamp(r.entryTs) },
    { header: 'exit_ts', value: (r: JournalRow) => formatTimestamp(r.exitTs) },
    { header: 'qty', value: (r: JournalRow) => r.quantity },
    { header: 'open_qty', value: (r: JournalRow) => r.openQuantity },
    { header: 'avg_entry', value: (r: JournalRow) => r.avgEntry },
    { header: 'avg_exit', value: (r: JournalRow) => r.avgExit },
    { header: 'net_pnl', value: (r: JournalRow) => r.realizedPnl },
    { header: 'return_pct', value: (r: JournalRow) => (r.returnPct === null ? '' : (r.returnPct * 100).toFixed(4)) },
    { header: 'fees', value: (r: JournalRow) => r.fees },
    // The journal carries no signal price, so slippage is deliberately blank (R5).
    { header: 'slippage', value: () => '' },
  ];
}

function num(value: number | null | undefined, digits = 2): string {
  return value === null || value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(digits);
}

export interface TradeJournalTableProps {
  trips: RoundTrip[];
  /** Base file name for the CSV export (strategy/run). */
  exportName?: string;
}

export const TradeJournalTable: React.FC<TradeJournalTableProps> = ({ trips, exportName = 'journal' }) => {
  const rows = useMemo(() => journalRows(trips), [trips]);
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'entryTs', dir: 'asc' });

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const filtered = needle
      ? rows.filter((row) =>
          [row.instrument, row.direction, row.status, row.exitReason].some((field) => field.toLowerCase().includes(needle)),
        )
      : rows;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sort.key] ?? Number.NEGATIVE_INFINITY;
      const bv = b[sort.key] ?? Number.NEGATIVE_INFINITY;
      if (av === bv) return a.entryTs - b.entryTs;
      return (av < bv ? -1 : 1) * factor;
    });
  }, [rows, filter, sort]);

  const toggleSort = (key: SortKey) => {
    setSort((current) => (current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  const handleExport = () => {
    const csv = toCsv(visible, csvColumns());
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${exportName.replace(/[^\w.-]+/g, '_')}-journal.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const total = visible.reduce((sum, row) => sum + (row.realizedPnl ?? 0), 0);

  return (
    <div data-testid="trade-journal" style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <input
          type="text"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter by symbol, side, status or exit reason"
          aria-label="Filter the trade journal"
          style={{
            flex: 1,
            minWidth: 0,
            padding: '4px 8px',
            fontSize: 12,
            borderRadius: 6,
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
          }}
        />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {visible.length} of {rows.length} · net {total >= 0 ? '+' : ''}
          {total.toFixed(2)}
        </span>
        <button
          type="button"
          className="shortlist-btn"
          onClick={handleExport}
          disabled={visible.length === 0}
          title="Export the visible rows as CSV (opens in Excel)"
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: 11 }}
        >
          <Download size={12} />
          <span>CSV</span>
        </button>
      </div>

      <div style={{ overflow: 'auto', minHeight: 0, border: '1px solid var(--border-subtle)', borderRadius: 6 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)', textAlign: 'left', position: 'sticky', top: 0 }}>
              {COLUMNS.map((column) => (
                <th key={column.key} style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key as SortKey)}
                      style={{
                        all: 'unset',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        color: sort.key === column.key ? 'var(--text-primary)' : 'inherit',
                      }}
                    >
                      {column.header}
                      {sort.key === column.key ? (sort.dir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : null}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No round trips to show.
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <tr key={row.id} style={{ borderTop: '1px solid var(--border-subtle, #2a2e39)' }}>
                  <td style={{ padding: '5px 8px', fontFamily: 'var(--font-family-mono, monospace)' }}>{row.instrument}</td>
                  <td style={{ padding: '5px 8px', color: row.direction === 'long' ? 'var(--bullish, #089981)' : 'var(--bearish, #f23645)' }}>
                    {row.direction}
                  </td>
                  <td style={{ padding: '5px 8px', color: row.status === 'open' ? 'var(--accent-gold, #f7a600)' : 'var(--text-secondary)' }}>
                    {row.status === 'open' ? `open (${row.exitReason})` : row.exitReason}
                  </td>
                  <td style={{ padding: '5px 8px', fontFamily: 'var(--font-family-mono, monospace)', whiteSpace: 'nowrap' }}>
                    {formatTimestamp(row.entryTs)}
                  </td>
                  <td style={{ padding: '5px 8px', fontFamily: 'var(--font-family-mono, monospace)', whiteSpace: 'nowrap' }}>
                    {formatTimestamp(row.exitTs)}
                  </td>
                  <td style={{ padding: '5px 8px', textAlign: 'right' }}>{num(row.quantity, 0)}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right' }}>{num(row.avgEntry)}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right' }}>{num(row.avgExit)}</td>
                  <td
                    style={{
                      padding: '5px 8px',
                      textAlign: 'right',
                      color:
                        row.realizedPnl === null
                          ? 'var(--text-muted)'
                          : row.realizedPnl >= 0
                            ? 'var(--bullish, #089981)'
                            : 'var(--bearish, #f23645)',
                    }}
                  >
                    {row.realizedPnl === null ? '—' : `${row.realizedPnl >= 0 ? '+' : ''}${row.realizedPnl.toFixed(2)}`}
                  </td>
                  <td style={{ padding: '5px 8px', textAlign: 'right' }}>
                    {row.returnPct === null ? '—' : `${row.returnPct >= 0 ? '+' : ''}${(row.returnPct * 100).toFixed(2)}%`}
                  </td>
                  <td style={{ padding: '5px 8px', textAlign: 'right' }}>{num(row.fees)}</td>
                  <td style={{ padding: '5px 8px', color: 'var(--text-muted)' }} title="The journal is fills with no signal price, so slippage cannot be derived (R5).">
                    —
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
