import React, { useMemo } from 'react';

import type { MonthlyHeatmap as Heatmap } from '../../../core/simulator/analytics';

/**
 * Monthly heatmap (Phase 8).
 *
 * Month × year realised-PnL matrix from the journal. Intensity scales with the
 * month's return on the running realised equity. The matrix reconciles with the
 * realised total by construction (it is a partition of the same closed-trip PnL);
 * the wire `total_return` is shown alongside, labelled, rather than asserted to
 * equal a *realised* figure it need not match (risk R5).
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface MonthlyHeatmapProps {
  heatmap: Heatmap;
  /** The payload's total return, for the labelled comparison. */
  wireTotalReturn?: number | null;
}

function cellColor(pct: number | null, maxAbs: number): string {
  if (pct === null || maxAbs <= 0) return 'var(--bg-surface, #1e222d)';
  const intensity = Math.min(1, Math.abs(pct) / maxAbs);
  const alpha = 0.12 + intensity * 0.68;
  return pct >= 0 ? `rgba(8, 153, 129, ${alpha})` : `rgba(242, 54, 69, ${alpha})`;
}

export const MonthlyHeatmap: React.FC<MonthlyHeatmapProps> = ({ heatmap, wireTotalReturn }) => {
  const byYear = useMemo(() => {
    const map = new Map<number, Map<number, Heatmap['cells'][number]>>();
    for (const cell of heatmap.cells) {
      const months = map.get(cell.year) ?? new Map();
      months.set(cell.month, cell);
      map.set(cell.year, months);
    }
    return map;
  }, [heatmap]);

  const maxAbs = useMemo(
    () => heatmap.cells.reduce((max, cell) => Math.max(max, Math.abs(cell.returnPct ?? 0)), 0),
    [heatmap],
  );

  if (heatmap.years.length === 0) {
    return (
      <div data-testid="monthly-heatmap" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
        No closed round trips, so there is no monthly breakdown.
      </div>
    );
  }

  return (
    <div data-testid="monthly-heatmap" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(12, minmax(0, 1fr))', gap: 3, alignItems: 'center' }}>
        <span />
        {MONTHS.map((month) => (
          <span key={month} style={{ fontSize: 9, textAlign: 'center', color: 'var(--text-muted)' }}>
            {month}
          </span>
        ))}
        {heatmap.years.map((year) => (
          <React.Fragment key={year}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-family-mono, monospace)' }}>{year}</span>
            {MONTHS.map((_, month) => {
              const cell = byYear.get(year)?.get(month);
              return (
                <div
                  key={`${year}-${month}`}
                  title={
                    cell
                      ? `${MONTHS[month]} ${year}: ${cell.pnl >= 0 ? '+' : ''}${cell.pnl.toFixed(2)} over ${cell.trades} trip(s)`
                      : `${MONTHS[month]} ${year}: no round trips`
                  }
                  style={{
                    height: 26,
                    borderRadius: 4,
                    background: cell ? cellColor(cell.returnPct, maxAbs) : 'transparent',
                    border: cell ? 'none' : '1px dashed var(--border-subtle, #2a2e39)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    color: 'var(--text-primary)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {cell && cell.returnPct !== null ? `${(cell.returnPct * 100).toFixed(1)}%` : cell ? '·' : ''}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
        <span>
          Realised total:{' '}
          <strong style={{ color: heatmap.totalPnl >= 0 ? 'var(--bullish, #089981)' : 'var(--bearish, #f23645)' }}>
            {heatmap.totalPnl >= 0 ? '+' : ''}
            {heatmap.totalPnl.toFixed(2)}
          </strong>
        </span>
        <span>
          Realised return:{' '}
          <strong>{heatmap.totalReturnPct === null ? '—' : `${(heatmap.totalReturnPct * 100).toFixed(2)}%`}</strong>
        </span>
        <span style={{ color: 'var(--text-muted)' }}>
          Payload total return:{' '}
          {wireTotalReturn === null || wireTotalReturn === undefined ? '—' : `${(wireTotalReturn * 100).toFixed(2)}%`} (reported; a
          realised matrix need not match a mark-to-market figure)
        </span>
      </div>
    </div>
  );
};
