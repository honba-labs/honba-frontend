import type { ChartBar } from '../chart-data';

/**
 * Fast client-side indicator calculator.
 *
 * Computes standard indicator values incrementally over candlestick arrays
 * without needing server computation.
 */

export function calculateSMA(bars: readonly ChartBar[], period: number): number[] {
  const result: number[] = new Array(bars.length);
  let sum = 0;
  for (let i = 0; i < bars.length; i++) {
    sum += bars[i].close;
    if (i >= period) {
      sum -= bars[i - period].close;
    }
    result[i] = i >= period - 1 ? sum / period : NaN;
  }
  return result;
}

export function calculateEMA(bars: readonly ChartBar[], period: number): number[] {
  const result: number[] = new Array(bars.length);
  if (bars.length === 0) return result;
  const k = 2 / (period + 1);
  let ema = bars[0].close;
  result[0] = ema;
  for (let i = 1; i < bars.length; i++) {
    ema = bars[i].close * k + ema * (1 - k);
    result[i] = i >= period - 1 ? ema : NaN;
  }
  return result;
}

export function calculateRSI(bars: readonly ChartBar[], period: number = 14): number[] {
  const result: number[] = new Array(bars.length).fill(NaN);
  if (bars.length <= period) return result;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = bars[i].close - bars[i - 1].close;
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < bars.length; i++) {
    const change = bars[i].close - bars[i - 1].close;
    const gain = change >= 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return result;
}

export interface MACDResult {
  macd: number[];
  signal: number[];
  histogram: number[];
}

export function calculateMACD(
  bars: readonly ChartBar[],
  fast: number = 12,
  slow: number = 26,
  signalPeriod: number = 9,
): MACDResult {
  const fastEMA = calculateEMA(bars, fast);
  const slowEMA = calculateEMA(bars, slow);
  const macdLine: number[] = new Array(bars.length);

  for (let i = 0; i < bars.length; i++) {
    macdLine[i] = Number.isFinite(fastEMA[i]) && Number.isFinite(slowEMA[i]) ? fastEMA[i] - slowEMA[i] : NaN;
  }

  const validIndex = slow - 1;
  const signalLine: number[] = new Array(bars.length).fill(NaN);
  const histogram: number[] = new Array(bars.length).fill(NaN);

  if (bars.length > validIndex + signalPeriod) {
    const k = 2 / (signalPeriod + 1);
    let sig = macdLine[validIndex];
    signalLine[validIndex] = sig;

    for (let i = validIndex + 1; i < bars.length; i++) {
      if (Number.isFinite(macdLine[i])) {
        sig = macdLine[i] * k + sig * (1 - k);
        signalLine[i] = i >= validIndex + signalPeriod - 1 ? sig : NaN;
        if (Number.isFinite(signalLine[i])) {
          histogram[i] = macdLine[i] - signalLine[i];
        }
      }
    }
  }

  return { macd: macdLine, signal: signalLine, histogram };
}

export interface BollingerResult {
  upper: number[];
  middle: number[];
  lower: number[];
}

export function calculateBollinger(
  bars: readonly ChartBar[],
  period: number = 20,
  stdDevMult: number = 2.0,
): BollingerResult {
  const middle = calculateSMA(bars, period);
  const upper: number[] = new Array(bars.length).fill(NaN);
  const lower: number[] = new Array(bars.length).fill(NaN);

  for (let i = period - 1; i < bars.length; i++) {
    const mean = middle[i];
    let sumSquares = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = bars[j].close - mean;
      sumSquares += diff * diff;
    }
    const stdDev = Math.sqrt(sumSquares / period);
    upper[i] = mean + stdDevMult * stdDev;
    lower[i] = mean - stdDevMult * stdDev;
  }

  return { upper, middle, lower };
}
