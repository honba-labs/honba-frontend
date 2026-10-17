import { describe, expect, it } from 'vitest';

import type { BacktestMetrics, Trade } from '../types/generated/domain';

import {
  annualisedReturn,
  benchmarkEquity,
  csvField,
  deriveRibbonMetrics,
  equitySeries,
  exposureFraction,
  formatMetricValue,
  formatTimestamp,
  istYearMonth,
  journalRows,
  mergeIntervals,
  monthlyHeatmap,
  roundTripStats,
  safeRatio,
  toCsv,
  yearsBetween,
  type AnalyticsInput,
} from './analytics';
import { pairTrades, type RoundTrip } from './trade-pairing';

// --- fixtures ---------------------------------------------------------------

const JAN_2 = Math.floor(Date.UTC(2024, 0, 2) / 1000); // 2024-01-02
const WINDOW = { start: '2024-01-02', end: '2024-04-02' }; // ~0.2447 yrs

function fill(side: 'buy' | 'sell', quantity: number, price: number, at: number, costs = 0): Trade {
  return {
    costs: { amount: costs, currency: 'INR' },
    instrument_id: { symbol: 'TCS', exchange: 'NSE' },
    order_id: `o-${side}-${at}`,
    price,
    quantity,
    side,
    ts_event: { iso: new Date(at * 1000).toISOString(), unix_nanos: `${at}000000000` },
    ts_init: { iso: new Date(at * 1000).toISOString(), unix_nanos: `${at}000000000` },
  };
}

const HOURS = 3600;
const DAYS = 86_400;

/** Two winners, one loser — a small journal the metrics can be checked against. */
const FIXTURE_TRADES: Trade[] = [
  fill('buy', 10, 100, JAN_2, 1), // +100
  fill('sell', 10, 110, JAN_2 + 10 * DAYS, 1),
  fill('buy', 10, 100, JAN_2 + 31 * DAYS, 1), // −50
  fill('sell', 10, 95, JAN_2 + 40 * DAYS, 1),
  fill('buy', 10, 100, JAN_2 + 60 * DAYS, 1), // +50
  fill('sell', 10, 105, JAN_2 + 70 * DAYS, 1),
];

function tripsOf(trades: Trade[]): RoundTrip[] {
  return pairTrades(trades).trips;
}

const FIXTURE_METRICS: BacktestMetrics = {
  total_return: 0.1,
  sharpe: 1.25,
  max_drawdown: 0.2,
  net_pnl: 100,
  trades: 6,
};

function input(overrides: Partial<AnalyticsInput> = {}): AnalyticsInput {
  return { metrics: FIXTURE_METRICS, trips: tripsOf(FIXTURE_TRADES), window: WINDOW, initialCapital: 100_000, ...overrides };
}

// --- tests ------------------------------------------------------------------

describe('ratio & window helpers', () => {
  it('safeRatio refuses a zero denominator', () => {
    expect(safeRatio(1, 2)).toBe(0.5);
    expect(safeRatio(1, 0)).toBeNull();
    expect(safeRatio(null, 2)).toBeNull();
    expect(safeRatio(Infinity, 2)).toBeNull();
  });

  it('yearsBetween counts whole-window years and rejects inverted windows', () => {
    expect(yearsBetween('2024-01-01', '2025-01-01')).toBeCloseTo(366 / 365.25, 6);
    expect(yearsBetween('2024-01-02', '2024-01-02')).toBeNull();
    expect(yearsBetween('2024-01-02', '2024-04-02')).toBeCloseTo(91 / 365.25, 6);
    expect(yearsBetween(null, '2024-01-02')).toBeNull();
  });

  it('annualisedReturn compounds, clamps a total wipeout and refuses no window', () => {
    expect(annualisedReturn(0, 1)).toBeCloseTo(0, 9);
    expect(annualisedReturn(0.1, 1)).toBeCloseTo(0.1, 9);
    expect(annualisedReturn(0.44, 2)).toBeCloseTo(0.2, 6);
    expect(annualisedReturn(-1, 1)).toBe(-1);
    expect(annualisedReturn(0.1, null)).toBeNull();
    expect(annualisedReturn(0.1, 0)).toBeNull();
    expect(annualisedReturn(null, 1)).toBeNull();
  });
});

describe('roundTripStats', () => {
  it('counts wins/losses, gross PnL and profit factor from the journal', () => {
    const stats = roundTripStats(tripsOf(FIXTURE_TRADES));
    expect(stats.closed).toBe(3);
    expect(stats.wins).toBe(2);
    expect(stats.losses).toBe(1);
    expect(stats.breakeven).toBe(0);
    // Each trip nets its move less the two ₹1 fill costs: 100−2, −50−2, 50−2.
    expect(stats.grossProfit).toBeCloseTo(146, 6);
    expect(stats.grossLoss).toBeCloseTo(52, 6);
    expect(stats.winRate).toBeCloseTo(2 / 3, 6);
    expect(stats.profitFactor).toBeCloseTo(146 / 52, 6);
    expect(stats.realizedPnl).toBeCloseTo(94, 6);
  });

  it('reports open trips separately and returns null ratios with nothing closed', () => {
    const open = pairTrades([fill('buy', 10, 100, JAN_2)]).trips;
    const stats = roundTripStats(open);
    expect(stats.open).toBe(1);
    expect(stats.closed).toBe(0);
    expect(stats.winRate).toBeNull();
    expect(stats.profitFactor).toBeNull();
  });

  it('reports profit factor null when nothing lost (never Infinity)', () => {
    const winner = pairTrades([fill('buy', 10, 100, JAN_2), fill('sell', 10, 120, JAN_2 + HOURS)]).trips;
    const stats = roundTripStats(winner);
    expect(stats.profitFactor).toBeNull();
    expect(stats.winRate).toBe(1);
  });
});

describe('exposure', () => {
  it('merges overlapping intervals and clips them to the window', () => {
    expect(mergeIntervals([{ start: 0, end: 10 }, { start: 5, end: 20 }, { start: 30, end: 40 }])).toEqual([
      { start: 0, end: 20 },
      { start: 30, end: 40 },
    ]);
    expect(mergeIntervals([])).toEqual([]);
  });

  it('is the fraction of the window with an open position', () => {
    const exposure = exposureFraction(input());
    expect(exposure).not.toBeNull();
    expect(exposure!).toBeGreaterThan(0);
    expect(exposure!).toBeLessThanOrEqual(1);
  });

  it('is null without a run window and 0 with no trades', () => {
    expect(exposureFraction(input({ window: null }))).toBeNull();
    expect(exposureFraction(input({ trips: [] }))).toBe(0);
  });

  it('counts a position still open at the end up to the window end', () => {
    const openTrip = pairTrades([fill('buy', 10, 100, JAN_2)]).trips;
    const exposure = exposureFraction(input({ trips: openTrip }));
    // entry 2024-01-02 → window end 2024-04-02 covers the whole window.
    expect(exposure).toBeCloseTo(1, 6);
  });
});

describe('equitySeries', () => {
  it('samples realised equity daily and starts at the initial capital', () => {
    const series = equitySeries(input());
    expect(series.sampling).toBe('daily');
    expect(series.initial).toBe(100_000);
    // 2024-01-02 → 2024-04-02 is 91 days; the grid adds the leading capital point.
    expect(series.equity[0]).toBe(100_000);
    expect(series.steps).toBe(92);
    expect(series.final).toBeCloseTo(100_094, 6);
    expect(Math.min(...series.equity)).toBe(100_000);
    // Peaks after the first winner, before the second trip's loss is realised.
    expect(Math.max(...series.equity)).toBe(100_098);
  });

  it('is non-decreasing while every trade wins and flat with no trades', () => {
    const winning = pairTrades([fill('buy', 10, 100, JAN_2), fill('sell', 10, 110, JAN_2 + 5 * DAYS)]).trips;
    const series = equitySeries(input({ trips: winning }));
    for (let i = 1; i < series.equity.length; i += 1) {
      expect(series.equity[i]).toBeGreaterThanOrEqual(series.equity[i - 1]);
    }
    expect(equitySeries(input({ trips: [] })).equity.every((v) => v === 100_000)).toBe(true);
  });

  it('falls back to a trade-sampled curve when no window is known', () => {
    const series = equitySeries(input({ window: null }));
    expect(series.sampling).toBe('trade');
    expect(series.steps).toBe(1 + 3); // capital + three closed trips
    expect(series.final).toBeCloseTo(100_094, 6);
  });

  it('uses the supplied capital, not a hard-coded default', () => {
    const series = equitySeries(input({ initialCapital: 1_000_000, trips: [] }));
    expect(series.initial).toBe(1_000_000);
  });
});

describe('benchmarkEquity', () => {
  it('normalises a benchmark bar series to the same capital and length', () => {
    const equity = equitySeries(input());
    const bars = Array.from({ length: 91 }, (_, i) => ({ time: JAN_2 + i * DAYS + 10 * HOURS, close: 100 + i }));
    const benchmark = benchmarkEquity(bars, equity, input());
    expect(benchmark).not.toBeNull();
    expect(benchmark!.length).toBe(equity.equity.length);
    expect(benchmark![0]).toBe(100_000);
    expect(benchmark![benchmark!.length - 1]).toBeCloseTo(100_000 * (190 / 100), 6);
  });

  it('is null when there are no usable bars or no window', () => {
    const equity = equitySeries(input());
    expect(benchmarkEquity([], equity, input())).toBeNull();
    expect(benchmarkEquity([{ time: JAN_2, close: 100 }], equity, input({ window: null }))).toBeNull();
  });
});

describe('monthlyHeatmap', () => {
  it('buckets realised PnL by IST month and reconciles to the total', () => {
    const map = monthlyHeatmap(input());
    expect(map.years).toEqual([2024]);
    expect(map.totalPnl).toBeCloseTo(94, 6);
    const sum = map.cells.reduce((acc, cell) => acc + cell.pnl, 0);
    expect(sum).toBeCloseTo(map.totalPnl, 6);
    expect(map.totalReturnPct).toBeCloseTo(94 / 100_000, 9);
    // 2024-01 (exit on Jan 12), 2024-02 (exit on Feb 11), 2024-03 (exit on Mar 13).
    expect(map.cells.map((c) => c.month)).toEqual([0, 1, 2]);
    expect(map.cells[0].trades).toBe(1);
  });

  it('returns an empty matrix with nothing closed and still sums to zero', () => {
    const map = monthlyHeatmap(input({ trips: [] }));
    expect(map.cells).toEqual([]);
    expect(map.years).toEqual([]);
    expect(map.totalPnl).toBe(0);
    expect(map.totalReturnPct).toBe(0);
  });

  it('istYearMonth rolls into the previous month for timestamps just after IST midnight', () => {
    const utcMidnight = Math.floor(Date.UTC(2024, 0, 1, 0, 0, 0) / 1000); // 00:00 UTC on Jan 1 = 05:30 IST
    expect(istYearMonth(utcMidnight)).toEqual({ year: 2024, month: 0 });
    // 20:30 UTC on Jan 31 = 02:00 IST on Feb 1 — belongs to February.
    const lateNight = Math.floor(Date.UTC(2024, 0, 31, 20, 30) / 1000);
    expect(istYearMonth(lateNight)).toEqual({ year: 2024, month: 1 });
  });
});

describe('journalRows', () => {
  it('flattens every round trip with its derived values', () => {
    const rows = journalRows(tripsOf(FIXTURE_TRADES));
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ id: 'trip-1', instrument: 'TCS.NSE', direction: 'long', status: 'closed' });
    expect(rows[0].avgEntry).toBe(100);
    expect(rows[0].avgExit).toBe(110);
    expect(rows[0].fees).toBe(2);
    expect(rows[0].exitReason).toBe('position_closed');
  });

  it('keeps an open trip open with null exit fields', () => {
    const rows = journalRows(pairTrades([fill('buy', 5, 200, JAN_2)]).trips);
    expect(rows[0].status).toBe('open');
    expect(rows[0].exitTs).toBeNull();
    expect(rows[0].avgExit).toBeNull();
    expect(rows[0].realizedPnl).toBeNull();
    expect(rows[0].exitReason).toBe('open_at_end');
  });
});

describe('CSV export', () => {
  type Row = { symbol: string; pnl: number; note?: string | null };
  const columns: Array<{ header: string; value: (row: Row) => string | number | null | undefined }> = [
    { header: 'Symbol', value: (row) => row.symbol },
    { header: 'PnL', value: (row) => row.pnl },
    { header: 'Note', value: (row) => row.note },
  ];

  it('emits a header and one CRLF line per row', () => {
    const csv = toCsv([{ symbol: 'TCS', pnl: 10 }, { symbol: 'INFY', pnl: -4 }], columns);
    expect(csv).toBe('Symbol,PnL,Note\r\nTCS,10,\r\nINFY,-4,');
  });

  it('quotes fields holding separators and doubles embedded quotes', () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('line\nbreak')).toBe('"line\nbreak"');
    expect(csvField(null)).toBe('');
    expect(csvField(1.5)).toBe('1.5');
  });

  it('serialises the journal rows so the CSV matches the on-screen table', () => {
    const rows = journalRows(tripsOf(FIXTURE_TRADES));
    const csv = toCsv(rows, [
      { header: 'id', value: (r) => r.id },
      { header: 'entry_ts', value: (r) => formatTimestamp(r.entryTs) },
      { header: 'exit_ts', value: (r) => formatTimestamp(r.exitTs) },
      { header: 'qty', value: (r) => r.quantity },
      { header: 'avg_entry', value: (r) => r.avgEntry },
      { header: 'avg_exit', value: (r) => r.avgExit },
      { header: 'net_pnl', value: (r) => r.realizedPnl },
      { header: 'return_pct', value: (r) => (r.returnPct === null ? '' : (r.returnPct * 100).toFixed(4)) },
      { header: 'fees', value: (r) => r.fees },
      { header: 'slippage', value: () => '' },
    ]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('id,entry_ts,exit_ts,qty,avg_entry,avg_exit,net_pnl,return_pct,fees,slippage');
    expect(lines).toHaveLength(1 + rows.length);
    const first = lines[1].split(',');
    expect(first[0]).toBe('trip-1');
    expect(first[3]).toBe('10');
    expect(first[4]).toBe('100');
    expect(first[5]).toBe('110');
    expect(Number(first[6])).toBeCloseTo(98, 6);
    expect(first[9]).toBe(''); // slippage: the journal carries no signal price (R5)
  });
});

describe('formatTimestamp', () => {
  it('formats UTC seconds and renders absent timestamps as an em dash', () => {
    expect(formatTimestamp(JAN_2)).toBe('2024-01-02 00:00');
    expect(formatTimestamp(null)).toBe('—');
    expect(formatTimestamp(NaN)).toBe('—');
  });
});

describe('deriveRibbonMetrics — provenance', () => {
  const metricsByKey = (input_: AnalyticsInput) =>
    Object.fromEntries(deriveRibbonMetrics(input_).map((m) => [m.key, m]));

  it('echoes every wire metric exactly as the payload reports it', () => {
    const ribbon = metricsByKey(input());
    expect(ribbon.total_return.value).toBe(FIXTURE_METRICS.total_return);
    expect(ribbon.total_return.provenance).toBe('wire');
    expect(ribbon.sharpe.value).toBe(FIXTURE_METRICS.sharpe);
    expect(ribbon.sharpe.provenance).toBe('wire');
    expect(ribbon.max_drawdown.value).toBe(FIXTURE_METRICS.max_drawdown);
    expect(ribbon.max_drawdown.provenance).toBe('wire');
    expect(ribbon.trades.value).toBe(FIXTURE_METRICS.trades);
    expect(ribbon.trades.provenance).toBe('wire');
  });

  it('derives CAGR, Calmar, win rate, profit factor and exposure with a note', () => {
    const ribbon = metricsByKey(input());
    const years = yearsBetween(WINDOW.start, WINDOW.end)!;
    const expectedCagr = (1 + FIXTURE_METRICS.total_return) ** (1 / years) - 1;
    expect(ribbon.cagr.value).toBeCloseTo(expectedCagr, 9);
    expect(ribbon.cagr.provenance).toBe('derived');
    expect(ribbon.cagr.note).toContain('total return');
    expect(ribbon.calmar.value).toBeCloseTo(expectedCagr / 0.2, 9);
    expect(ribbon.calmar.provenance).toBe('derived');
    expect(ribbon.win_rate.value).toBeCloseTo(2 / 3, 6);
    expect(ribbon.win_rate.provenance).toBe('derived');
    expect(ribbon.profit_factor.value).toBeCloseTo(146 / 52, 6);
    expect(ribbon.exposure.value).toBeGreaterThan(0);
    expect(ribbon.exposure.provenance).toBe('derived');
  });

  it('reports Sortino unavailable — never a fabricated number', () => {
    const ribbon = metricsByKey(input());
    expect(ribbon.sortino.value).toBeNull();
    expect(ribbon.sortino.provenance).toBe('unavailable');
    expect(ribbon.sortino.note).toMatch(/periodic return series/i);
  });

  it('marks CAGR/Calmar/exposure unavailable when the window is unknown', () => {
    const ribbon = metricsByKey(input({ window: null }));
    expect(ribbon.cagr.provenance).toBe('unavailable');
    expect(ribbon.cagr.value).toBeNull();
    expect(ribbon.calmar.value).toBeNull();
    expect(ribbon.exposure.provenance).toBe('unavailable');
    expect(ribbon.exposure.value).toBeNull();
    // Wire values survive regardless of the window.
    expect(ribbon.sharpe.value).toBe(FIXTURE_METRICS.sharpe);
  });

  it('tolerates an absent payload without crashing', () => {
    const ribbon = metricsByKey(input({ metrics: null }));
    expect(ribbon.total_return.value).toBeNull();
    expect(ribbon.total_return.provenance).toBe('wire');
    expect(ribbon.calmar.value).toBeNull();
    expect(deriveRibbonMetrics({ metrics: null, trips: [], window: null })).toHaveLength(10);
  });
});

describe('formatMetricValue', () => {
  it('formats each metric kind, including drawdown as negative', () => {
    expect(formatMetricValue(0.1234, 'percent')).toBe('+12.34%');
    expect(formatMetricValue(-0.05, 'percent')).toBe('-5.00%');
    expect(formatMetricValue(0.2, 'drawdown')).toBe('-20.00%');
    expect(formatMetricValue(1.5, 'ratio')).toBe('1.50');
    expect(formatMetricValue(42, 'count')).toBe('42');
    expect(formatMetricValue(1234.5, 'currency')).toContain('1');
    expect(formatMetricValue(null, 'percent')).toBe('—');
    expect(formatMetricValue(Number.NaN, 'ratio')).toBe('—');
  });
});

describe('reconciliation — fixture payload', () => {
  it('every wire metric matches the payload and derived totals reconcile', () => {
    const analytics = input();
    const ribbon = deriveRibbonMetrics(analytics);
    const wire = ribbon.filter((metric) => metric.provenance === 'wire');
    for (const metric of wire) {
      expect(metric.value).toBe((FIXTURE_METRICS as unknown as Record<string, number>)[metric.key]);
    }
    // The heatmap reconciles with realised PnL, and the equity curve's last point
    // lands on capital + that same realised PnL.
    const heatmap = monthlyHeatmap(analytics);
    const stats = roundTripStats(analytics.trips);
    expect(heatmap.totalPnl).toBeCloseTo(stats.realizedPnl, 6);
    expect(equitySeries(analytics).final).toBeCloseTo(100_000 + heatmap.totalPnl, 6);
  });
});
