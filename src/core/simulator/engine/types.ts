import type { ChartBar } from '../chart-data';
import type { RoundTrip } from '../trade-pairing';

/**
 * Client-Side Simulation & Tick Engine Types.
 *
 * Supports:
 * - Intra-bar micro-tick generation (Open -> Low -> High -> Close)
 * - Multi-signal evaluation and confluence scoring
 * - Multi-chart & multi-timeframe synchronization
 * - Integration with sandboxed portfolio
 */

export type ReplayStatus = 'idle' | 'playing' | 'paused' | 'completed';

export interface SimulatedTick {
  timestamp: number; // Unix seconds
  timeStr: string;
  price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  barIndex: number;
  phase: 'open' | 'intra1' | 'intra2' | 'close';
}

export interface SignalEvaluation {
  id: string;
  nodeId: string;
  label: string;
  condition: string;
  active: boolean;
  indication: 'bullish' | 'bearish' | 'neutral';
  weight: number;
  indicatorValue?: number | string;
  threshold?: number | string;
  details: string;
}

export interface ConfluenceSnapshot {
  barIndex: number;
  timestamp: number;
  timeStr: string;
  price: number;
  signals: SignalEvaluation[];
  bullishScore: number;
  bearishScore: number;
  totalSignals: number;
  confluenceRatio: number; // e.g. 2/3 = 0.67
  action: 'buy' | 'sell' | 'hold';
  reason: string;
  executedTrade?: {
    side: 'buy' | 'sell';
    quantity: number;
    price: number;
  };
}

export interface ActivePosition {
  symbol: string;
  exchange: string;
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedReturnPct: number;
  entryTimestamp: number;
}

export interface SimulationEngineState {
  status: ReplayStatus;
  speed: number; // 1, 2, 5, 10, 25, 50, 100, 1000 (instant)
  currentBarIndex: number;
  totalBars: number;
  currentTick: SimulatedTick | null;
  activeSignals: SignalEvaluation[];
  lastConfluence: ConfluenceSnapshot | null;
  confluenceHistory: ConfluenceSnapshot[];
  roundTrips: RoundTrip[];
  activePosition: ActivePosition | null;
  realizedPnl: number;
  unrealizedPnl: number;
  equity: number;
  initialCapital: number;
  selectedAccountId: string;
  multiTimeframe: boolean;
  secondaryTimeframe: string;
  fillModel: string;
  commission: number;
  slippage: number;
}
