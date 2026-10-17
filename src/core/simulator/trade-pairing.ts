import type { Trade } from '../types/generated/domain';

import { unixNanosToSeconds } from './chart-data';

/**
 * Fill → round-trip pairing (Phase 7, risk R6).
 *
 * `GET /backtests/{id}/journal` returns **fills** (`TradesResponse.trades`),
 * not round trips: there is no entry/exit field, no PnL, no size-in-size-out
 * and no signal reason. Everything a round trip reports is therefore *derived*
 * here, by one documented rule set, so the chart markers, the tooltip and the
 * P8 trade journal all agree:
 *
 * - Fills are ordered by `ts_event`, stable, per instrument.
 * - A **round trip = one position episode**: it opens when the net position
 *   leaves zero and closes when it returns to zero (or flips through it).
 * - Scale-in fills join the open episode as more lots; scale-out fills consume
 *   those lots **FIFO**. One episode with three exits is one round trip with
 *   three exit legs — not three trips.
 * - Realised PnL is **derived**: `(exit − entry) × closed qty × direction`,
 *   net of the run's fill costs, with entry costs allocated pro-rata to the
 *   closed quantity so an open trip is not charged for inventory it still holds.
 * - A position still open when the run ends is reported with `status: 'open'`
 *   and no exit reason, and is labelled as derived wherever it is drawn.
 * - `exit_reason` is one of the three *derived* states below. The journal
 *   carries no strategy-level reason (stop, target, signal) — that is a
 *   contract gap, never a guess.
 */

export type FillSide = 'buy' | 'sell';

export interface PairedFill {
  /** Original index in the response, so ties keep wire order. */
  index: number;
  /** UTC seconds. */
  ts: number;
  side: FillSide;
  price: number;
  quantity: number;
  /** `costs.amount` from the wire fill. */
  costs: number;
  currency: string;
  orderId: string;
  instrument: string;
}

export interface RoundTripLeg {
  ts: number;
  price: number;
  quantity: number;
  costs: number;
  orderId: string;
}

export type RoundTripExitReason = 'position_closed' | 'flipped' | 'open_at_end';

export interface RoundTrip {
  id: string;
  instrument: string;
  direction: 'long' | 'short';
  status: 'closed' | 'open';
  /** Quantity paired into this trip (its entry size). */
  quantity: number;
  /** Quantity still held at the run's end; 0 for a closed trip. */
  openQuantity: number;
  entryTs: number;
  exitTs: number | null;
  /** Weighted-average entry/exit price. `avgExit` is null while nothing has closed. */
  avgEntry: number;
  avgExit: number | null;
  entryFills: RoundTripLeg[];
  exitFills: RoundTripLeg[];
  /** Recorded fill costs, entry + exit (unrounded, as the venue reported them). */
  fees: number;
  /** Derived, net of allocated costs. Null until part of the trip has closed. */
  realizedPnl: number | null;
  /** Derived `realizedPnl / (avgEntry × closed qty)`. */
  returnPct: number | null;
  /** Derived — the journal carries no strategy-level exit reason. */
  exitReason: RoundTripExitReason;
}

export interface OpenPosition {
  instrument: string;
  direction: 'long' | 'short';
  quantity: number;
  avgPrice: number;
  sinceTs: number;
}

export interface PairingResult {
  fills: PairedFill[];
  trips: RoundTrip[];
  openPositions: OpenPosition[];
  /** Fills that could not be paired (no side, no timestamp, no size). */
  dropped: number;
}

export type TradeMarkerKind = 'entry' | 'exit' | 'open';

export interface TradeMarker {
  /** Stable id, echoed by the chart's click handler. */
  key: string;
  /** UTC seconds; snapped to a bar timestamp before it is drawn. */
  ts: number;
  side: FillSide;
  kind: TradeMarkerKind;
  price: number;
  quantity: number;
  tripId: string;
  instrument: string;
  /** True when the marker is derived rather than a fill (the open-position tail). */
  derived: boolean;
}

const EPSILON = 1e-9;

function isSide(value: unknown): value is FillSide {
  return value === 'buy' || value === 'sell';
}

/** Wire fills → sorted, timestamped, side-checked fills. */
export function fillsFromTrades(trades: readonly Trade[] | null | undefined): {
  fills: PairedFill[];
  dropped: number;
} {
  const fills: PairedFill[] = [];
  let dropped = 0;
  (trades ?? []).forEach((trade, index) => {
    const ts = unixNanosToSeconds(trade?.ts_event);
    if (ts === null || !isSide(trade?.side) || !(trade.quantity > 0) || !(trade.price >= 0)) {
      dropped += 1;
      return;
    }
    fills.push({
      index,
      ts,
      side: trade.side,
      price: trade.price,
      quantity: trade.quantity,
      costs: Number.isFinite(trade.costs?.amount) ? trade.costs.amount : 0,
      currency: trade.costs?.currency ?? '',
      orderId: trade.order_id ?? '',
      instrument: `${trade.instrument_id?.symbol ?? ''}.${trade.instrument_id?.exchange ?? ''}`,
    });
  });
  fills.sort((a, b) => a.ts - b.ts || a.index - b.index);
  return { fills, dropped };
}

interface Lot {
  remaining: number;
  price: number;
}

interface Episode {
  instrument: string;
  direction: 'long' | 'short';
  entryFills: RoundTripLeg[];
  exitFills: RoundTripLeg[];
  entryQty: number;
  entryNotional: number;
  entryCosts: number;
  exitQty: number;
  exitNotional: number;
  exitCosts: number;
  entryTs: number;
  exitTs: number | null;
  lots: Lot[];
  exitReason: RoundTripExitReason;
}

function openEpisode(fill: PairedFill): Episode {
  return {
    instrument: fill.instrument,
    direction: fill.side === 'buy' ? 'long' : 'short',
    entryFills: [{ ts: fill.ts, price: fill.price, quantity: fill.quantity, costs: fill.costs, orderId: fill.orderId }],
    exitFills: [],
    entryQty: fill.quantity,
    entryNotional: fill.quantity * fill.price,
    entryCosts: fill.costs,
    exitQty: 0,
    exitNotional: 0,
    exitCosts: 0,
    entryTs: fill.ts,
    exitTs: null,
    lots: [{ remaining: fill.quantity, price: fill.price }],
    exitReason: 'open_at_end',
  };
}

function addEntry(episode: Episode, fill: PairedFill): void {
  episode.entryFills.push({
    ts: fill.ts,
    price: fill.price,
    quantity: fill.quantity,
    costs: fill.costs,
    orderId: fill.orderId,
  });
  episode.entryQty += fill.quantity;
  episode.entryNotional += fill.quantity * fill.price;
  episode.entryCosts += fill.costs;
  episode.lots.push({ remaining: fill.quantity, price: fill.price });
}

/** Pair one instrument's ordered fills into position episodes. */
function pairInstrument(fills: readonly PairedFill[]): { episodes: Episode[]; open: Episode | null } {
  const episodes: Episode[] = [];
  let open: Episode | null = null;

  for (const fill of fills) {
    const openingSide = fill.side === 'buy' ? 'long' : 'short';
    if (!open) {
      open = openEpisode(fill);
      continue;
    }

    if (openingSide === open.direction) {
      addEntry(open, fill);
      continue;
    }

    // Closing (or reversing) fill: consume the open lots FIFO.
    const perUnit = fill.costs / fill.quantity;
    let remaining = fill.quantity;
    open.exitFills.push({
      ts: fill.ts,
      price: fill.price,
      quantity: fill.quantity,
      costs: fill.costs,
      orderId: fill.orderId,
    });

    while (remaining > EPSILON && open.lots.length > 0) {
      const lot = open.lots[0];
      const taken = Math.min(lot.remaining, remaining);
      lot.remaining -= taken;
      remaining -= taken;
      open.exitQty += taken;
      open.exitNotional += taken * fill.price;
      open.exitCosts += taken * perUnit;
      if (lot.remaining <= EPSILON) open.lots.shift();
    }
    open.exitTs = fill.ts;

    if (open.lots.length === 0) {
      open.exitReason = remaining > EPSILON ? 'flipped' : 'position_closed';
      episodes.push(open);
      open = null;
      if (remaining > EPSILON) {
        // The fill ran past flat: the residue opens the opposite episode.
        const residue: PairedFill = { ...fill, quantity: remaining, costs: perUnit * remaining };
        open = openEpisode(residue);
      }
    }
  }

  return { episodes, open };
}

function round(value: number, digits = 10): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function finalizeEpisode(episode: Episode, id: string, open: boolean): RoundTrip {
  const closedQty = episode.exitQty;
  const avgEntry = episode.entryQty > 0 ? episode.entryNotional / episode.entryQty : 0;
  const avgExit = closedQty > 0 ? episode.exitNotional / closedQty : null;
  const openQuantity = episode.lots.reduce((sum, lot) => sum + lot.remaining, 0);
  const sign = episode.direction === 'long' ? 1 : -1;
  const allocatedEntryCosts = closedQty > 0 && episode.entryQty > 0 ? episode.entryCosts * (closedQty / episode.entryQty) : 0;
  const realizedPnl =
    avgExit === null ? null : sign * (avgExit - avgEntry) * closedQty - (allocatedEntryCosts + episode.exitCosts);
  const capital = avgEntry * closedQty;

  return {
    id,
    instrument: episode.instrument,
    direction: episode.direction,
    status: open ? 'open' : 'closed',
    quantity: round(episode.entryQty, 8),
    openQuantity: round(openQuantity, 8),
    entryTs: episode.entryTs,
    exitTs: episode.exitTs,
    avgEntry: round(avgEntry),
    avgExit: avgExit === null ? null : round(avgExit),
    entryFills: episode.entryFills,
    exitFills: episode.exitFills,
    fees: round(episode.entryCosts + episode.exitCosts),
    realizedPnl: realizedPnl === null ? null : round(realizedPnl),
    returnPct: realizedPnl !== null && capital > 0 ? round(realizedPnl / capital) : null,
    exitReason: open ? 'open_at_end' : episode.exitReason,
  };
}

function openPositionOf(episode: Episode): OpenPosition | null {
  const quantity = episode.lots.reduce((sum, lot) => sum + lot.remaining, 0);
  if (quantity <= EPSILON) return null;
  const notional = episode.lots.reduce((sum, lot) => sum + lot.remaining * lot.price, 0);
  return {
    instrument: episode.instrument,
    direction: episode.direction,
    quantity: round(quantity, 8),
    avgPrice: round(notional / quantity),
    sinceTs: episode.entryTs,
  };
}

/** Pair journal fills into round trips, per instrument. */
export function pairFills(fills: readonly PairedFill[]): PairingResult {
  const byInstrument = new Map<string, PairedFill[]>();
  for (const fill of fills) {
    const bucket = byInstrument.get(fill.instrument);
    if (bucket) bucket.push(fill);
    else byInstrument.set(fill.instrument, [fill]);
  }

  const closed: Episode[] = [];
  const opens: Episode[] = [];
  for (const bucket of byInstrument.values()) {
    const { episodes, open } = pairInstrument(bucket);
    closed.push(...episodes);
    if (open) opens.push(open);
  }

  closed.sort((a, b) => a.entryTs - b.entryTs || a.exitTs! - b.exitTs!);
  const trips = closed.map((episode, index) => finalizeEpisode(episode, `trip-${index + 1}`, false));
  const openPositions: OpenPosition[] = [];

  opens.forEach((episode, index) => {
    const id = `trip-${closed.length + index + 1}`;
    trips.push(finalizeEpisode(episode, id, true));
    const position = openPositionOf(episode);
    if (position) openPositions.push(position);
  });

  trips.sort((a, b) => a.entryTs - b.entryTs);
  return { fills: [...fills], trips, openPositions, dropped: 0 };
}

/** Wire trades → paired round trips in one call. */
export function pairTrades(trades: readonly Trade[] | null | undefined): PairingResult {
  const { fills, dropped } = fillsFromTrades(trades);
  return { ...pairFills(fills), dropped };
}

/**
 * Chart markers for a pairing: one marker per fill leg, plus a clearly labelled
 * marker for any position still open at the run's end (derived, not a fill).
 */
export function markersFromPairing(result: PairingResult): TradeMarker[] {
  const markers: TradeMarker[] = [];
  for (const trip of result.trips) {
    trip.entryFills.forEach((leg, index) => {
      markers.push({
        key: `${trip.id}:entry:${index}`,
        ts: leg.ts,
        side: trip.direction === 'long' ? 'buy' : 'sell',
        kind: 'entry',
        price: leg.price,
        quantity: leg.quantity,
        tripId: trip.id,
        instrument: trip.instrument,
        derived: false,
      });
    });
    trip.exitFills.forEach((leg, index) => {
      markers.push({
        key: `${trip.id}:exit:${index}`,
        ts: leg.ts,
        side: trip.direction === 'long' ? 'sell' : 'buy',
        kind: 'exit',
        price: leg.price,
        quantity: leg.quantity,
        tripId: trip.id,
        instrument: trip.instrument,
        derived: false,
      });
    });
    if (trip.status === 'open' && trip.openQuantity > EPSILON) {
      markers.push({
        key: `${trip.id}:open`,
        ts: trip.exitTs ?? trip.entryTs,
        side: trip.direction === 'long' ? 'buy' : 'sell',
        kind: 'open',
        price: trip.avgEntry,
        quantity: trip.openQuantity,
        tripId: trip.id,
        instrument: trip.instrument,
        derived: true,
      });
    }
  }
  markers.sort((a, b) => a.ts - b.ts);
  return markers;
}

/** Look up the round trip a marker belongs to, for the chart tooltip. */
export function tripForMarker(result: PairingResult, tripId: string | null | undefined): RoundTrip | null {
  if (!tripId) return null;
  return result.trips.find((trip) => trip.id === tripId) ?? null;
}
