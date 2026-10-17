import { describe, expect, it } from 'vitest';
import { calculateSMA, calculateRSI, calculateBollinger } from './indicator-calculator';
import { computeGraphIndicators, evaluateBarSignals } from './strategy-evaluator';
import { ReplayController } from './replay-controller';
import type { ChartBar } from '../chart-data';
import type { StrategyGraphShape } from '../../graph/model';

function mockBars(count: number = 30): ChartBar[] {
  const bars: ChartBar[] = [];
  let price = 100;
  const baseTime = 1700000000;

  for (let i = 0; i < count; i++) {
    // Oscillating trend
    const delta = Math.sin(i / 3) * 2 + (i % 2 === 0 ? 1 : -0.5);
    const open = price;
    const close = price + delta;
    const high = Math.max(open, close) + 1;
    const low = Math.min(open, close) - 1;
    price = close;

    bars.push({
      time: baseTime + i * 300,
      open,
      high,
      low,
      close,
      volume: 1000 + i * 10,
    });
  }
  return bars;
}

const mockMultiSignalGraph: StrategyGraphShape = {
  schema_version: 1,
  name: 'multi_signal_strategy',
  universe: { explicit: [{ symbol: 'TCS', exchange: 'NSE' }] },
  driving_timeframe: { interval: 5, aggregation: 'minute' },
  warmup_bars: 10,
  nodes: [
    { id: 'n1', type: 'universe' },
    { id: 'f', type: 'indicator', indicator: 'sma', params: { period: 3 } },
    { id: 's', type: 'indicator', indicator: 'sma', params: { period: 8 } },
    { id: 'r', type: 'indicator', indicator: 'rsi', params: { period: 14 } },
    { id: 'c1', type: 'condition', label: 'SMA Cross', params: { op: 'crosses_above' } },
    { id: 'c2', type: 'condition', label: 'RSI Oversold', params: { op: 'lt', threshold: 40 } },
    { id: 'o_buy', type: 'order', params: { side: 'buy', quantity: 10 } },
    { id: 'o_sell', type: 'order', params: { side: 'sell', quantity: 10 } },
  ],
  edges: [
    { id: 'e1', from_node: 'n1', from_port: 'bars', to_node: 'f', to_port: 'input' },
    { id: 'e2', from_node: 'n1', from_port: 'bars', to_node: 's', to_port: 'input' },
    { id: 'e3', from_node: 'n1', from_port: 'bars', to_node: 'r', to_port: 'input' },
    { id: 'e4', from_node: 'f', from_port: 'value', to_node: 'c1', to_port: 'left' },
    { id: 'e5', from_node: 's', from_port: 'value', to_node: 'c1', to_port: 'right' },
    { id: 'e6', from_node: 'r', from_port: 'value', to_node: 'c2', to_port: 'left' },
  ],
};

describe('Simulation Engine', () => {
  it('calculates indicators accurately client-side', () => {
    const bars = mockBars(20);
    const sma3 = calculateSMA(bars, 3);
    expect(sma3.length).toBe(20);
    expect(Number.isNaN(sma3[0])).toBe(true);
    expect(Number.isNaN(sma3[1])).toBe(true);
    expect(Number.isFinite(sma3[2])).toBe(true);

    const rsi = calculateRSI(bars, 14);
    expect(rsi.length).toBe(20);
    expect(Number.isFinite(rsi[15])).toBe(true);

    const bollinger = calculateBollinger(bars, 10, 2);
    expect(bollinger.upper.length).toBe(20);
    expect(bollinger.lower.length).toBe(20);
  });

  it('evaluates multi-signal confluence scoring and indications', () => {
    const bars = mockBars(25);
    const indicators = computeGraphIndicators(mockMultiSignalGraph, bars);
    expect(indicators.sma.has('f')).toBe(true);
    expect(indicators.sma.has('s')).toBe(true);
    expect(indicators.rsi.has('r')).toBe(true);

    const confluence = evaluateBarSignals(mockMultiSignalGraph, bars, 15, indicators);
    expect(confluence.totalSignals).toBeGreaterThanOrEqual(2);
    expect(confluence.signals.length).toBe(2);
    expect(confluence.price).toBe(bars[15].close);
  });

  it('runs replay controller with step and instant run', () => {
    const bars = mockBars(30);
    const controller = new ReplayController();
    controller.init(bars, mockMultiSignalGraph);

    expect(controller.getState().status).toBe('idle');
    expect(controller.getState().currentBarIndex).toBe(0);

    // Step forward 4 ticks (1 whole bar)
    controller.step();
    controller.step();
    controller.step();
    controller.step();

    expect(controller.getState().currentBarIndex).toBe(1);

    // Instant run
    controller.instantRunToEnd();
    const finalState = controller.getState();
    expect(finalState.status).toBe('completed');
    expect(finalState.currentBarIndex).toBe(bars.length - 1);
  });
});
