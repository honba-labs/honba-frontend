import type { ChartBar } from '../chart-data';
import type { StrategyGraphShape } from '../../graph/model';
import type { RoundTrip } from '../trade-pairing';
import { computeGraphIndicators, evaluateBarSignals, type EvaluatedIndicators } from './strategy-evaluator';
import { executeSimulatedTrade, updatePortfolioMarkPrice, calculatePositionPnL } from './portfolio-adapter';
import type {
  ActivePosition,
  ConfluenceSnapshot,
  ReplayStatus,
  SignalEvaluation,
  SimulatedTick,
  SimulationEngineState,
} from './types';

export interface ReplayCallbacks {
  onTick?: (tick: SimulatedTick) => void;
  onBarChange?: (barIndex: number, visibleBars: ChartBar[]) => void;
  onConfluence?: (confluence: ConfluenceSnapshot) => void;
  onTrade?: (trade: NonNullable<ConfluenceSnapshot['executedTrade']>, position: ActivePosition | null) => void;
  onStateChange?: (state: SimulationEngineState) => void;
}

export class ReplayController {
  private bars: ChartBar[] = [];
  private graph: StrategyGraphShape | null = null;
  private symbol: string = 'TCS';
  private exchange: string = 'NSE';
  private indicators: EvaluatedIndicators | null = null;

  private status: ReplayStatus = 'idle';
  private speed: number = 10; // multiplier
  private currentBarIndex: number = 0;
  private currentTickPhase: number = 0; // 0: open, 1: intra1, 2: intra2, 3: close

  private timerId: number | null = null;
  private callbacks: ReplayCallbacks = {};

  private activeSignals: SignalEvaluation[] = [];
  private lastConfluence: ConfluenceSnapshot | null = null;
  private confluenceHistory: ConfluenceSnapshot[] = [];
  private roundTrips: RoundTrip[] = [];

  private activePosition: ActivePosition | null = null;
  private realizedPnl: number = 0;
  private initialCapital: number = 100_000;
  private selectedAccountId: string = 'acc-sandbox-primary';
  private multiTimeframe: boolean = false;
  private secondaryTimeframe: string = '1h';

  constructor(callbacks: ReplayCallbacks = {}) {
    this.callbacks = callbacks;
  }

  public init(
    bars: ChartBar[],
    graph: StrategyGraphShape,
    symbol: string = 'TCS',
    exchange: string = 'NSE',
    initialCapital: number = 100_000,
    accountId: string = 'acc-sandbox-primary',
  ) {
    this.stop();
    this.bars = [...bars];
    this.graph = graph;
    this.symbol = symbol;
    this.exchange = exchange;
    this.initialCapital = initialCapital;
    this.selectedAccountId = accountId;

    this.currentBarIndex = 0;
    this.currentTickPhase = 0;
    this.status = 'idle';
    this.activeSignals = [];
    this.lastConfluence = null;
    this.confluenceHistory = [];
    this.roundTrips = [];
    this.activePosition = null;
    this.realizedPnl = 0;

    // Pre-calculate indicators over the dataset
    this.indicators = computeGraphIndicators(graph, this.bars);

    this.notifyState();
  }

  public setCallbacks(callbacks: ReplayCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public setSpeed(speed: number) {
    this.speed = Math.max(1, speed);
    if (this.status === 'playing') {
      this.stopTimer();
      this.startTimer();
    }
    this.notifyState();
  }

  public setAccountId(accountId: string) {
    this.selectedAccountId = accountId;
    this.notifyState();
  }

  public setMultiTimeframe(enabled: boolean, tf: string = '1h') {
    this.multiTimeframe = enabled;
    this.secondaryTimeframe = tf;
    this.notifyState();
  }

  public play() {
    if (this.bars.length === 0 || !this.graph) return;
    if (this.currentBarIndex >= this.bars.length - 1) {
      this.reset();
    }
    this.status = 'playing';
    // Immediately emit first tick/bar so the chart responds without delay
    this.advanceTick();
    this.startTimer();
    this.notifyState();
  }

  public pause() {
    this.status = 'paused';
    this.stopTimer();
    this.notifyState();
  }

  public stop() {
    this.status = 'idle';
    this.stopTimer();
  }

  public reset() {
    this.stop();
    this.currentBarIndex = 0;
    this.currentTickPhase = 0;
    this.activePosition = null;
    this.realizedPnl = 0;
    this.confluenceHistory = [];
    this.roundTrips = [];
    this.lastConfluence = null;
    this.activeSignals = [];
    this.status = 'paused';
    const firstBar = this.bars.length > 0 ? [this.bars[0]] : [];
    this.callbacks.onBarChange?.(0, firstBar);
    this.notifyState();
  }

  public step() {
    if (this.bars.length === 0) return;
    if (this.status === 'playing') {
      this.pause();
    }
    this.advanceTick();
    this.notifyState();
  }

  public jumpToBar(targetIndex: number) {
    if (this.bars.length === 0) return;
    const bounded = Math.max(0, Math.min(this.bars.length - 1, targetIndex));
    this.currentBarIndex = bounded;
    this.currentTickPhase = 3; // end of bar
    this.evaluateCurrentBar();
    const visibleBars = this.bars.slice(0, bounded + 1);
    this.callbacks.onBarChange?.(bounded, visibleBars);
    this.notifyState();
  }

  public instantRunToEnd() {
    if (this.bars.length === 0 || !this.graph || !this.indicators) return;
    this.stop();
    this.currentBarIndex = 0;
    this.currentTickPhase = 0;
    this.activePosition = null;
    this.realizedPnl = 0;
    this.confluenceHistory = [];
    this.roundTrips = [];

    for (let i = 0; i < this.bars.length; i++) {
      this.currentBarIndex = i;
      this.currentTickPhase = 3;
      this.evaluateCurrentBar();
    }

    this.currentBarIndex = this.bars.length - 1;
    this.status = 'completed';
    this.callbacks.onBarChange?.(this.bars.length - 1, [...this.bars]);
    this.notifyState();
  }

  private startTimer() {
    this.stopTimer();
    // High speed interval calculation
    // Base 60ms divided by speed multiplier, clamped between 10ms and 500ms
    const intervalMs = Math.max(12, Math.round(180 / Math.min(this.speed, 20)));

    this.timerId = window.setInterval(() => {
      // If speed is very high (>= 25x), advance multiple ticks per frame
      const ticksPerFrame = this.speed >= 50 ? 8 : this.speed >= 25 ? 4 : 1;
      for (let t = 0; t < ticksPerFrame; t++) {
        if (!this.advanceTick()) {
          this.status = 'completed';
          this.stopTimer();
          this.notifyState();
          break;
        }
      }
    }, intervalMs);
  }

  private stopTimer() {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private advanceTick(): boolean {
    if (this.currentBarIndex >= this.bars.length) {
      return false;
    }

    const bar = this.bars[this.currentBarIndex];
    const isBullish = bar.close >= bar.open;

    // 4 phases: 0=open, 1=swing 1 (low/high), 2=swing 2 (high/low), 3=close
    let tickPrice = bar.open;
    let phaseName: SimulatedTick['phase'] = 'open';

    if (this.currentTickPhase === 0) {
      tickPrice = bar.open;
      phaseName = 'open';
    } else if (this.currentTickPhase === 1) {
      tickPrice = isBullish ? bar.low : bar.high;
      phaseName = 'intra1';
    } else if (this.currentTickPhase === 2) {
      tickPrice = isBullish ? bar.high : bar.low;
      phaseName = 'intra2';
    } else {
      tickPrice = bar.close;
      phaseName = 'close';
    }

    const tick: SimulatedTick = {
      timestamp: bar.time,
      timeStr: new Date(bar.time * 1000).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
      price: tickPrice,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
      barIndex: this.currentBarIndex,
      phase: phaseName,
    };

    // Update Mark Price on tick
    updatePortfolioMarkPrice(this.symbol, this.exchange, tickPrice);

    // Callbacks
    this.callbacks.onTick?.(tick);

    // Dynamic forming candle for real-time intra-bar animation
    const currentHigh = Math.max(bar.open, tickPrice, this.currentTickPhase > 1 ? bar.high : tickPrice);
    const currentLow = Math.min(bar.open, tickPrice, this.currentTickPhase > 0 ? bar.low : tickPrice);
    const formingBar: ChartBar = {
      time: bar.time,
      open: bar.open,
      high: currentHigh,
      low: currentLow,
      close: tickPrice,
      volume: Math.max(1, Math.round(bar.volume * ((this.currentTickPhase + 1) / 4))),
    };

    const visibleBars = [...this.bars.slice(0, this.currentBarIndex), formingBar];
    this.callbacks.onBarChange?.(this.currentBarIndex, visibleBars);

    // Evaluate strategy on candle close phase
    if (this.currentTickPhase === 3) {
      this.evaluateCurrentBar();
    }

    // Advance phase or next bar
    this.currentTickPhase += 1;
    if (this.currentTickPhase > 3) {
      this.currentTickPhase = 0;
      this.currentBarIndex += 1;
      if (this.currentBarIndex >= this.bars.length) {
        return false;
      }
    }

    return true;
  }

  private evaluateCurrentBar() {
    if (!this.graph || !this.indicators || this.currentBarIndex >= this.bars.length) return;

    const bar = this.bars[this.currentBarIndex];
    const confluence = evaluateBarSignals(this.graph, this.bars, this.currentBarIndex, this.indicators);

    this.activeSignals = confluence.signals;
    this.lastConfluence = confluence;

    // Process trade execution if action is buy/sell
    if (confluence.executedTrade) {
      this.handleTradeExecution(confluence.executedTrade, bar);
      this.confluenceHistory.unshift(confluence); // latest first
      this.callbacks.onConfluence?.(confluence);
    }

    this.notifyState();
  }

  private handleTradeExecution(
    trade: NonNullable<ConfluenceSnapshot['executedTrade']>,
    bar: ChartBar,
  ) {
    const isBuy = trade.side === 'buy';

    if (!this.activePosition) {
      // Open new position
      this.activePosition = {
        symbol: this.symbol,
        exchange: this.exchange,
        side: isBuy ? 'long' : 'short',
        quantity: trade.quantity,
        entryPrice: trade.price,
        currentPrice: trade.price,
        unrealizedPnl: 0,
        unrealizedReturnPct: 0,
        entryTimestamp: bar.time,
      };

      // Dispatched into Sandboxed Portfolio!
      executeSimulatedTrade(
        this.symbol,
        this.exchange,
        trade.side,
        trade.quantity,
        trade.price,
        bar.time,
      );
    } else {
      // Existing position logic: if opposite side, close or reverse
      const currentSide = this.activePosition.side;
      const isOpposite = (currentSide === 'long' && !isBuy) || (currentSide === 'short' && isBuy);

      if (isOpposite) {
        // Position Closed! Calculate Realized PnL
        const mult = currentSide === 'long' ? 1 : -1;
        const pnl = (trade.price - this.activePosition.entryPrice) * this.activePosition.quantity * mult;
        this.realizedPnl += pnl;

        const roundTrip: RoundTrip = {
          id: `trip-${this.roundTrips.length + 1}`,
          instrument: `${this.symbol}.${this.exchange}`,
          direction: currentSide,
          quantity: this.activePosition.quantity,
          openQuantity: 0,
          entryTs: this.activePosition.entryTimestamp,
          exitTs: bar.time,
          avgEntry: this.activePosition.entryPrice,
          avgExit: trade.price,
          realizedPnl: pnl,
          returnPct: this.activePosition.entryPrice > 0 ? ((trade.price - this.activePosition.entryPrice) / this.activePosition.entryPrice) * mult : 0,
          fees: 20.0,
          status: 'closed',
          exitReason: 'position_closed',
          entryFills: [{
            orderId: 'sim-entry',
            ts: this.activePosition.entryTimestamp,
            price: this.activePosition.entryPrice,
            quantity: this.activePosition.quantity,
            costs: 10,
          }],
          exitFills: [{
            orderId: 'sim-exit',
            ts: bar.time,
            price: trade.price,
            quantity: trade.quantity,
            costs: 10,
          }],
        };

        this.roundTrips.unshift(roundTrip);

        // Execute closing trade in sandbox portfolio
        executeSimulatedTrade(
          this.symbol,
          this.exchange,
          trade.side,
          trade.quantity,
          trade.price,
          bar.time,
        );

        this.activePosition = null;
      }
    }

    this.callbacks.onTrade?.(trade, this.activePosition);
  }

  public getState(): SimulationEngineState {
    const currentPrice =
      this.currentBarIndex < this.bars.length ? this.bars[this.currentBarIndex].close : 0;
    const { unrealizedPnl } = calculatePositionPnL(this.activePosition, currentPrice);

    return {
      status: this.status,
      speed: this.speed,
      currentBarIndex: this.currentBarIndex,
      totalBars: this.bars.length,
      currentTick:
        this.currentBarIndex < this.bars.length
          ? {
              timestamp: this.bars[this.currentBarIndex].time,
              timeStr: '',
              price: currentPrice,
              open: this.bars[this.currentBarIndex].open,
              high: this.bars[this.currentBarIndex].high,
              low: this.bars[this.currentBarIndex].low,
              close: this.bars[this.currentBarIndex].close,
              volume: this.bars[this.currentBarIndex].volume,
              barIndex: this.currentBarIndex,
              phase: 'close',
            }
          : null,
      activeSignals: this.activeSignals,
      lastConfluence: this.lastConfluence,
      confluenceHistory: this.confluenceHistory,
      roundTrips: this.roundTrips,
      activePosition: this.activePosition,
      realizedPnl: this.realizedPnl,
      unrealizedPnl,
      equity: this.initialCapital + this.realizedPnl + unrealizedPnl,
      initialCapital: this.initialCapital,
      selectedAccountId: this.selectedAccountId,
      multiTimeframe: this.multiTimeframe,
      secondaryTimeframe: this.secondaryTimeframe,
    };
  }

  private notifyState() {
    this.callbacks.onStateChange?.(this.getState());
  }
}
