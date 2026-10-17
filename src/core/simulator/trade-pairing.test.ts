import { describe, expect, it } from 'vitest';

import type { Trade } from '../types/generated/domain';

import { markerToleranceSec, snapToBars, type ChartBar } from './chart-data';
import { fillsFromTrades, markersFromPairing, pairTrades, tripForMarker } from './trade-pairing';

const JAN1 = Math.floor(Date.UTC(2024, 0, 2) / 1000);

function fill(
  side: 'buy' | 'sell',
  quantity: number,
  price: number,
  minute: number,
  options: { costs?: number; symbol?: string; exchange?: string; order?: string } = {},
): Trade {
  const ts = JAN1 + minute * 60;
  return {
    costs: { amount: options.costs ?? 0, currency: 'INR' },
    instrument_id: { symbol: options.symbol ?? 'TCS', exchange: options.exchange ?? 'NSE' },
    order_id: options.order ?? `o-${side}-${minute}`,
    price,
    quantity,
    side,
    ts_event: { iso: new Date(ts * 1000).toISOString(), unix_nanos: `${ts}000000000` },
    ts_init: { iso: new Date(ts * 1000).toISOString(), unix_nanos: `${ts}000000000` },
  };
}

describe('fillsFromTrades', () => {
  it('orders fills by ts_event and keeps wire order on ties', () => {
    const { fills, dropped } = fillsFromTrades([fill('sell', 1, 110, 30), fill('buy', 1, 100, 10)]);
    expect(fills.map((f) => [f.side, f.ts])).toEqual([
      ['buy', JAN1 + 600],
      ['sell', JAN1 + 1800],
    ]);
    expect(dropped).toBe(0);
  });

  it('drops fills it cannot pair and counts them', () => {
    const noSide = { ...fill('buy', 1, 100, 10), side: 'no_order_side' as const };
    const noTime: Trade = { ...fill('buy', 1, 100, 10), ts_event: { iso: '', unix_nanos: '' } };
    const noSize = { ...fill('buy', 0, 100, 10) };
    const { fills, dropped } = fillsFromTrades([noSide, noTime, noSize, fill('buy', 1, 100, 20)]);
    expect(fills).toHaveLength(1);
    expect(dropped).toBe(3);
  });
});

describe('pairTrades — round trips', () => {
  it('pairs a simple long round trip and derives PnL net of fill costs', () => {
    const result = pairTrades([fill('buy', 100, 100, 10, { costs: 10 }), fill('sell', 100, 110, 60, { costs: 5 })]);
    expect(result.trips).toHaveLength(1);
    const [trip] = result.trips;
    expect(trip).toMatchObject({
      direction: 'long',
      status: 'closed',
      quantity: 100,
      openQuantity: 0,
      avgEntry: 100,
      avgExit: 110,
      exitReason: 'position_closed',
    });
    expect(trip.entryFills).toHaveLength(1);
    expect(trip.exitFills).toHaveLength(1);
    expect(trip.fees).toBe(15);
    expect(trip.realizedPnl).toBeCloseTo(10 * 100 - 15, 6);
    expect(trip.returnPct).toBeCloseTo(0.0985, 6);
    expect(result.openPositions).toEqual([]);
  });

  it('aggregates scale-in fills into one weighted entry', () => {
    const result = pairTrades([
      fill('buy', 50, 100, 10),
      fill('buy', 50, 110, 20),
      fill('sell', 100, 120, 30),
    ]);
    expect(result.trips).toHaveLength(1);
    expect(result.trips[0]).toMatchObject({ quantity: 100, avgEntry: 105, avgExit: 120 });
    expect(result.trips[0].entryFills).toHaveLength(2);
    expect(result.trips[0].realizedPnl).toBeCloseTo(1500, 6);
  });

  it('folds scale-out exits into one trip with two exit legs (risk R6)', () => {
    const result = pairTrades([
      fill('buy', 100, 100, 10),
      fill('sell', 50, 110, 20),
      fill('sell', 50, 120, 30),
    ]);
    expect(result.trips).toHaveLength(1);
    const [trip] = result.trips;
    expect(trip.exitFills).toHaveLength(2);
    expect(trip).toMatchObject({ quantity: 100, avgExit: 115, exitTs: JAN1 + 1800 });
    expect(trip.realizedPnl).toBeCloseTo(1500, 6);
  });

  it('leaves a partially closed position open at the run end, charging only the closed share of entry costs', () => {
    const result = pairTrades([fill('buy', 100, 100, 10, { costs: 20 }), fill('sell', 40, 110, 60, { costs: 4 })]);
    const [trip] = result.trips;
    expect(trip.status).toBe('open');
    expect(trip.exitReason).toBe('open_at_end');
    expect(trip.openQuantity).toBe(60);
    expect(trip.exitFills).toHaveLength(1);
    // 40 closed: (110-100) * 40 - (20 * 40/100 + 4)
    expect(trip.realizedPnl).toBeCloseTo(400 - 12, 6);
    expect(result.openPositions).toEqual([{ instrument: 'TCS.NSE', direction: 'long', quantity: 60, avgPrice: 100, sinceTs: JAN1 + 600 }]);
  });

  it('treats a reversal through flat as two trips, the second derived as a flip', () => {
    const result = pairTrades([fill('buy', 100, 100, 10), fill('sell', 150, 110, 20)]);
    expect(result.trips).toHaveLength(2);
    expect(result.trips[0]).toMatchObject({ direction: 'long', status: 'closed', quantity: 100, exitReason: 'flipped' });
    expect(result.trips[1]).toMatchObject({ direction: 'short', status: 'open', quantity: 50, avgEntry: 110, openQuantity: 50 });
    expect(result.trips[1].realizedPnl).toBeNull();
    expect(result.openPositions).toHaveLength(1);
  });

  it('pairs a short round trip with the short sign on PnL', () => {
    const result = pairTrades([fill('sell', 100, 200, 10), fill('buy', 100, 180, 40)]);
    const [trip] = result.trips;
    expect(trip).toMatchObject({ direction: 'short', avgEntry: 200, avgExit: 180 });
    expect(trip.realizedPnl).toBeCloseTo(2000, 6);
  });

  it('keeps instruments independent', () => {
    const result = pairTrades([
      fill('buy', 10, 100, 10, { symbol: 'TCS' }),
      fill('buy', 20, 50, 11, { symbol: 'INFY' }),
      fill('sell', 10, 120, 40, { symbol: 'TCS' }),
    ]);
    expect(result.trips).toHaveLength(2);
    expect(result.trips.map((t) => t.instrument).sort()).toEqual(['INFY.NSE', 'TCS.NSE']);
    expect(result.trips.find((t) => t.instrument === 'TCS.NSE')?.status).toBe('closed');
    expect(result.trips.find((t) => t.instrument === 'INFY.NSE')?.status).toBe('open');
  });

  it('numbers trips in entry order and reports nothing for an empty journal', () => {
    const result = pairTrades([fill('buy', 1, 100, 30), fill('buy', 1, 100, 10), fill('sell', 1, 110, 15)]);
    expect(result.trips.map((t) => t.id)).toEqual(['trip-1', 'trip-2']);
    expect(pairTrades([]).trips).toEqual([]);
    expect(pairTrades(null).dropped).toBe(0);
  });
});

describe('markersFromPairing', () => {
  const result = pairTrades([
    fill('buy', 100, 100, 10),
    fill('sell', 60, 110, 20),
    fill('sell', 40, 120, 30),
  ]);

  it('places an entry marker per entry leg and an exit marker per exit leg, on the fill timestamps', () => {
    const markers = markersFromPairing(result);
    expect(markers.map((m) => [m.kind, m.side, m.ts, m.quantity])).toEqual([
      ['entry', 'buy', JAN1 + 600, 100],
      ['exit', 'sell', JAN1 + 1200, 60],
      ['exit', 'sell', JAN1 + 1800, 40],
    ]);
    expect(markers.every((m) => !m.derived)).toBe(true);
  });

  it('adds one clearly derived marker for a position still open at the run end', () => {
    const open = pairTrades([fill('buy', 50, 100, 10)]);
    const markers = markersFromPairing(open);
    // The fill is still marked as an entry; the open tail is added on top and
    // is the only derived one.
    expect(markers.map((m) => m.kind)).toEqual(['entry', 'open']);
    expect(markers[0].derived).toBe(false);
    expect(markers[1]).toMatchObject({ kind: 'open', derived: true, quantity: 50, price: 100, ts: JAN1 + 600 });
  });

  it('gives every marker a stable key its round trip can be found by', () => {
    const markers = markersFromPairing(result);
    expect(new Set(markers.map((m) => m.key)).size).toBe(markers.length);
    expect(tripForMarker(result, markers[1].tripId)?.id).toBe('trip-1');
    expect(tripForMarker(result, 'trip-99')).toBeNull();
    expect(tripForMarker(result, null)).toBeNull();
  });
});

/**
 * Phase 7 acceptance criterion: buy/sell markers land on the correct *bar*
 * timestamps. Journal fixtures are paired into round trips, converted to
 * markers and snapped onto a real 5-minute bar series whose timestamps are
 * skewed a few seconds off the fill instants — as a venue reports them.
 */
describe('journal fixtures → markers on bars', () => {
  // 2024-01-02, 09:15 IST (the NSE session open) is 03:45 UTC.
  const OPEN = Math.floor(Date.UTC(2024, 0, 2, 3, 45, 0) / 1000);
  const barTimes = [0, 5, 10, 15, 20, 25].map((minute) => OPEN + minute * 60);
  const bars: ChartBar[] = barTimes.map((time, index) => ({
    time,
    open: 100 + index,
    high: 101 + index,
    low: 99 + index,
    close: 100.5 + index,
    volume: 1_000,
  }));

  const tradeAt = (side: 'buy' | 'sell', quantity: number, price: number, barIndex: number, skewSec: number): Trade => {
    const ts = barTimes[barIndex] + skewSec;
    return {
      costs: { amount: 0, currency: 'INR' },
      instrument_id: { symbol: 'TCS', exchange: 'NSE' },
      order_id: `o-${side}-${barIndex}`,
      price,
      quantity,
      side,
      ts_event: { iso: new Date(ts * 1000).toISOString(), unix_nanos: `${ts}000000000` },
      ts_init: { iso: new Date(ts * 1000).toISOString(), unix_nanos: `${ts}000000000` },
    };
  };

  // A long entered on the first bar and scaled out across two later bars.
  const trades = [
    tradeAt('buy', 100, 100, 0, 2), // 2s after the bar open
    tradeAt('sell', 60, 110, 3, 4),
    tradeAt('sell', 40, 120, 5, 1),
  ];

  const markers = snapToBars(markersFromPairing(pairTrades(trades)), bars, markerToleranceSec('5m'));

  it('snaps every marker exactly onto a bar timestamp', () => {
    const times = new Set(barTimes);
    expect(markers.length).toBeGreaterThan(0);
    expect(markers.every((marker) => times.has(marker.ts))).toBe(true);
  });

  it('keeps each entry/exit on the bar its fill belongs to, side intact', () => {
    expect(markers.map((marker) => [marker.kind, marker.side, marker.ts])).toEqual([
      ['entry', 'buy', barTimes[0]],
      ['exit', 'sell', barTimes[3]],
      ['exit', 'sell', barTimes[5]],
    ]);
  });

  it('still lands markers when a fill carries no skew', () => {
    const exact = snapToBars(markersFromPairing(pairTrades([tradeAt('buy', 10, 100, 2, 0)])), bars, markerToleranceSec('5m'));
    expect(exact[0].ts).toBe(barTimes[2]);
  });
});
