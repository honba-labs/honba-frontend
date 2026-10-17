import type { StrategyGraphShape, GraphNode } from '../../graph/model';
import type { ChartBar } from '../chart-data';
import {
  calculateBollinger,
  calculateEMA,
  calculateMACD,
  calculateRSI,
  calculateSMA,
} from './indicator-calculator';
import type { ConfluenceSnapshot, SignalEvaluation } from './types';

/**
 * Client-Side Strategy & Multi-Signal Evaluator.
 *
 * Evaluates strategy graphs bar-by-bar:
 * 1. Computes all graph indicators
 * 2. Evaluates condition & signal nodes
 * 3. Aggregates multi-signal confluence ("more signals indicating buy/sell the better")
 * 4. Yields signal indications and order actions.
 */

export interface EvaluatedIndicators {
  sma: Map<string, number[]>;
  ema: Map<string, number[]>;
  rsi: Map<string, number[]>;
  macd: Map<string, { macd: number[]; signal: number[]; histogram: number[] }>;
  bollinger: Map<string, { upper: number[]; middle: number[]; lower: number[] }>;
}

export function computeGraphIndicators(
  graph: StrategyGraphShape,
  bars: readonly ChartBar[],
): EvaluatedIndicators {
  const result: EvaluatedIndicators = {
    sma: new Map(),
    ema: new Map(),
    rsi: new Map(),
    macd: new Map(),
    bollinger: new Map(),
  };

  const indicatorNodes = graph.nodes.filter(
    (n) => n.type === 'indicator' || typeof n.indicator === 'string',
  );

  for (const node of indicatorNodes) {
    const kind = (node.indicator || 'sma').toLowerCase();
    const params = node.params || {};

    if (kind === 'sma') {
      const period = Number(params.period ?? params.length ?? 10);
      result.sma.set(node.id, calculateSMA(bars, period));
    } else if (kind === 'ema') {
      const period = Number(params.period ?? params.length ?? 10);
      result.ema.set(node.id, calculateEMA(bars, period));
    } else if (kind === 'rsi') {
      const period = Number(params.period ?? params.length ?? 14);
      result.rsi.set(node.id, calculateRSI(bars, period));
    } else if (kind === 'macd') {
      const fast = Number(params.fast ?? 12);
      const slow = Number(params.slow ?? 26);
      const signal = Number(params.signal ?? 9);
      result.macd.set(node.id, calculateMACD(bars, fast, slow, signal));
    } else if (kind === 'bollinger') {
      const length = Number(params.length ?? params.period ?? 20);
      const std = Number(params.std ?? 2.0);
      result.bollinger.set(node.id, calculateBollinger(bars, length, std));
    }
  }

  return result;
}

export function evaluateBarSignals(
  graph: StrategyGraphShape,
  bars: readonly ChartBar[],
  barIndex: number,
  indicators: EvaluatedIndicators,
): ConfluenceSnapshot {
  const currentBar = bars[barIndex];
  const prevBar = barIndex > 0 ? bars[barIndex - 1] : null;
  const timeStr = new Date(currentBar.time * 1000).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const conditionNodes = graph.nodes.filter(
    (n) => n.type === 'condition' || n.type === 'logic',
  );

  const signals: SignalEvaluation[] = [];

  // Helper to resolve series value for a node/port
  function getSeriesValue(nodeId: string, port: string, idx: number): number {
    if (idx < 0 || idx >= bars.length) return NaN;
    if (indicators.sma.has(nodeId)) return indicators.sma.get(nodeId)![idx];
    if (indicators.ema.has(nodeId)) return indicators.ema.get(nodeId)![idx];
    if (indicators.rsi.has(nodeId)) return indicators.rsi.get(nodeId)![idx];
    if (indicators.macd.has(nodeId)) {
      const m = indicators.macd.get(nodeId)!;
      return port === 'signal' ? m.signal[idx] : port === 'histogram' ? m.histogram[idx] : m.macd[idx];
    }
    if (indicators.bollinger.has(nodeId)) {
      const b = indicators.bollinger.get(nodeId)!;
      return port === 'upper' ? b.upper[idx] : port === 'lower' ? b.lower[idx] : b.middle[idx];
    }
    // Fallback: price series
    return bars[idx].close;
  }

  // Find edges leading into condition nodes
  for (const node of conditionNodes) {
    const inEdges = graph.edges.filter((e) => e.to_node === node.id);
    const leftEdge = inEdges.find((e) => e.to_port === 'left' || e.to_port === 'a');
    const rightEdge = inEdges.find((e) => e.to_port === 'right' || e.to_port === 'b');

    const op = String(node.params?.op || 'gt').toLowerCase();
    const threshold = node.params?.threshold !== undefined ? Number(node.params.threshold) : undefined;

    let leftVal = leftEdge ? getSeriesValue(leftEdge.from_node, leftEdge.from_port, barIndex) : currentBar.close;
    let prevLeftVal = prevBar && leftEdge ? getSeriesValue(leftEdge.from_node, leftEdge.from_port, barIndex - 1) : NaN;

    let rightVal = rightEdge
      ? getSeriesValue(rightEdge.from_node, rightEdge.from_port, barIndex)
      : threshold !== undefined
      ? threshold
      : NaN;

    let prevRightVal =
      prevBar && rightEdge
        ? getSeriesValue(rightEdge.from_node, rightEdge.from_port, barIndex - 1)
        : threshold !== undefined
        ? threshold
        : NaN;

    let active = false;
    let indication: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let details = '';

    if (op === 'crosses_above') {
      active = prevLeftVal <= prevRightVal && leftVal > rightVal;
      indication = 'bullish';
      details = `Crossed above (${leftVal.toFixed(2)} > ${rightVal.toFixed(2)})`;
    } else if (op === 'crosses_below') {
      active = prevLeftVal >= prevRightVal && leftVal < rightVal;
      indication = 'bearish';
      details = `Crossed below (${leftVal.toFixed(2)} < ${rightVal.toFixed(2)})`;
    } else if (op === 'lt' || op === '<') {
      active = leftVal < rightVal;
      // In mean-reversion, e.g. RSI < 30 is bullish oversold
      indication = threshold && threshold <= 35 ? 'bullish' : 'bearish';
      details = `${leftVal.toFixed(2)} < ${rightVal.toFixed(2)}`;
    } else if (op === 'gt' || op === '>') {
      active = leftVal > rightVal;
      // In momentum, RSI > 70 is overbought (bearish exit/sell) or strong trend
      indication = threshold && threshold >= 70 ? 'bearish' : 'bullish';
      details = `${leftVal.toFixed(2)} > ${rightVal.toFixed(2)}`;
    } else if (op === 'and') {
      // Logic node
      active = true;
      indication = 'bullish';
      details = 'All conditions met';
    }

    signals.push({
      id: `${node.id}-${barIndex}`,
      nodeId: node.id,
      label: node.label || `Signal ${node.id}`,
      condition: op,
      active,
      indication,
      weight: 1,
      indicatorValue: Number.isFinite(leftVal) ? Number(leftVal.toFixed(2)) : undefined,
      threshold: Number.isFinite(rightVal) ? Number(rightVal.toFixed(2)) : undefined,
      details,
    });
  }

  // Confluence Calculation
  const bullishSignals = signals.filter((s) => s.active && s.indication === 'bullish');
  const bearishSignals = signals.filter((s) => s.active && s.indication === 'bearish');

  const bullishScore = bullishSignals.reduce((acc, s) => acc + s.weight, 0);
  const bearishScore = bearishSignals.reduce((acc, s) => acc + s.weight, 0);
  const totalSignals = Math.max(1, signals.length);

  // Strategy order nodes
  const orderNodes = graph.nodes.filter((n) => n.type === 'order');
  const buyNode = orderNodes.find((n) => String(n.params?.side || 'buy').toLowerCase() === 'buy');
  const sellNode = orderNodes.find((n) => String(n.params?.side).toLowerCase() === 'sell');

  let action: 'buy' | 'sell' | 'hold' = 'hold';
  let reason = 'Holding';

  // Rule: Confluence threshold (if single condition, 1 is enough; if multiple, >= 1 or majority)
  const reqBullish = Math.min(bullishSignals.length, Math.max(1, Math.ceil(signals.length / 2)));
  
  if (bullishScore >= reqBullish && bullishScore > bearishScore) {
    action = 'buy';
    reason = `Bullish Confluence (${bullishScore}/${totalSignals} signals): ${bullishSignals.map((s) => s.label).join(' + ')}`;
  } else if (bearishScore >= 1 && bearishScore > bullishScore) {
    action = 'sell';
    reason = `Bearish Confluence (${bearishScore}/${totalSignals} signals): ${bearishSignals.map((s) => s.label).join(' + ')}`;
  }

  const confluenceRatio = totalSignals > 0 ? Math.max(bullishScore, bearishScore) / totalSignals : 0;

  const snapshot: ConfluenceSnapshot = {
    barIndex,
    timestamp: currentBar.time,
    timeStr,
    price: currentBar.close,
    signals,
    bullishScore,
    bearishScore,
    totalSignals,
    confluenceRatio,
    action,
    reason,
  };

  if (action === 'buy' && buyNode) {
    snapshot.executedTrade = {
      side: 'buy',
      quantity: Number(buyNode.params?.quantity ?? 10),
      price: currentBar.close,
    };
  } else if (action === 'sell' && sellNode) {
    snapshot.executedTrade = {
      side: 'sell',
      quantity: Number(sellNode.params?.quantity ?? 10),
      price: currentBar.close,
    };
  }

  return snapshot;
}
