import { Instrument, CandleData } from './market-data';

export type ChartTimeframeRange = '1D' | '5D' | '1M' | '6M' | '1Y' | '5Y';

function createRng(seed: number): () => number {
  let s = seed;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/**
 * Deterministically generates high-fidelity OHLCV candles for any instrument across selected timeframes
 * (1D, 5D, 1M, 6M, 1Y, 5Y). If the instrument already has pre-calculated history and range matches default 1M,
 * it returns that or synthesizes candles tailored for the chosen timeframe.
 */
export function generateInstrumentCandles(
  inst: Instrument,
  range: string = '1D'
): CandleData[] {
  const normRange = (range || '1D').toUpperCase();
  const rng = createRng(hashString(`${inst.symbol}_${normRange}`));
  const currentPrice = inst.price;
  const candles: CandleData[] = [];
  const now = new Date();

  if (normRange === '1D') {
    const count = 26; // 15-min intervals between 09:15 and 15:30
    const dayDelta = inst.change ?? (currentPrice * (inst.changePercent / 100));
    const startPrice = Number((currentPrice - dayDelta).toFixed(2));
    let prevClose = startPrice;

    for (let i = 0; i < count; i++) {
      const progress = i / Math.max(1, count - 1);
      const totalMinutes = 9 * 60 + 15 + i * 15;
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

      const expected = startPrice + dayDelta * progress;
      const noise = (rng() - 0.49) * (currentPrice * 0.005);
      const open = Number(prevClose.toFixed(2));
      let close = i === count - 1 ? currentPrice : Number((expected + noise).toFixed(2));
      if (close <= 0) close = Math.max(0.01, open * 0.99);

      const high = Number((Math.max(open, close) + rng() * currentPrice * 0.003).toFixed(2));
      const low = Number((Math.min(open, close) - rng() * currentPrice * 0.003).toFixed(2));
      const volume = Math.floor(15000 + rng() * 60000);

      candles.push({ time: timeStr, open, high, low, close, volume });
      prevClose = close;
    }
  } else if (normRange === '5D') {
    const count = 25; // 5 candles per day for 5 days
    const pct = (inst.perf1W ?? inst.changePercent * 2) / 100;
    const startPrice = Number((currentPrice / (1 + pct)).toFixed(2));
    const totalDelta = currentPrice - startPrice;
    let prevClose = startPrice;

    for (let i = 0; i < count; i++) {
      const progress = i / Math.max(1, count - 1);
      const dayOffset = 4 - Math.floor(i / 5);
      const d = new Date(now);
      d.setDate(d.getDate() - dayOffset);
      const timeStr = `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

      const expected = startPrice + totalDelta * progress;
      const noise = (rng() - 0.49) * (currentPrice * 0.012) * Math.sin(progress * Math.PI);
      const open = Number(prevClose.toFixed(2));
      let close = i === count - 1 ? currentPrice : Number((expected + noise).toFixed(2));
      if (close <= 0) close = Math.max(0.01, open * 0.98);

      const high = Number((Math.max(open, close) + rng() * currentPrice * 0.007).toFixed(2));
      const low = Number((Math.min(open, close) - rng() * currentPrice * 0.007).toFixed(2));
      const volume = Math.floor(40000 + rng() * 120000);

      candles.push({ time: timeStr, open, high, low, close, volume });
      prevClose = close;
    }
  } else if (normRange === '1M') {
    const count = 22; // ~22 trading days
    const pct = (inst.perf1M ?? inst.changePercent * 4) / 100;
    const startPrice = Number((currentPrice / (1 + pct)).toFixed(2));
    const totalDelta = currentPrice - startPrice;
    let prevClose = startPrice;

    for (let i = 0; i < count; i++) {
      const progress = i / Math.max(1, count - 1);
      const d = new Date(now);
      d.setDate(d.getDate() - Math.floor((count - 1 - i) * 1.35));
      const timeStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

      const expected = startPrice + totalDelta * progress;
      const noise = (rng() - 0.48) * (currentPrice * 0.02) * Math.sin(progress * Math.PI);
      const open = Number(prevClose.toFixed(2));
      let close = i === count - 1 ? currentPrice : Number((expected + noise).toFixed(2));
      if (close <= 0) close = Math.max(0.01, open * 0.97);

      const high = Number((Math.max(open, close) + rng() * currentPrice * 0.012).toFixed(2));
      const low = Number((Math.min(open, close) - rng() * currentPrice * 0.012).toFixed(2));
      const volume = Math.floor(100000 + rng() * 350000);

      candles.push({ time: timeStr, open, high, low, close, volume });
      prevClose = close;
    }
  } else if (normRange === '6M') {
    const count = 26; // ~1 candle per week
    const pct = ((inst.perf3M ?? 10) * 1.8) / 100;
    const startPrice = Number((currentPrice / (1 + pct)).toFixed(2));
    const totalDelta = currentPrice - startPrice;
    let prevClose = startPrice;

    for (let i = 0; i < count; i++) {
      const progress = i / Math.max(1, count - 1);
      const d = new Date(now);
      d.setDate(d.getDate() - (count - 1 - i) * 7);
      const timeStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

      const expected = startPrice + totalDelta * progress;
      const noise = (rng() - 0.49) * (currentPrice * 0.028) * Math.sin(progress * Math.PI);
      const open = Number(prevClose.toFixed(2));
      let close = i === count - 1 ? currentPrice : Number((expected + noise).toFixed(2));
      if (close <= 0) close = Math.max(0.01, open * 0.96);

      const high = Number((Math.max(open, close) + rng() * currentPrice * 0.015).toFixed(2));
      const low = Number((Math.min(open, close) - rng() * currentPrice * 0.015).toFixed(2));
      const volume = Math.floor(180000 + rng() * 500000);

      candles.push({ time: timeStr, open, high, low, close, volume });
      prevClose = close;
    }
  } else if (normRange === '1Y') {
    const count = 36;
    const pct = (inst.perf1Y ?? ((inst.high52 - inst.low52) / (inst.low52 || 1)) * 50) / 100;
    const startPrice = Number((currentPrice / (1 + pct)).toFixed(2));
    const totalDelta = currentPrice - startPrice;
    let prevClose = startPrice;

    for (let i = 0; i < count; i++) {
      const progress = i / Math.max(1, count - 1);
      const d = new Date(now);
      d.setDate(d.getDate() - (count - 1 - i) * 10);
      const timeStr = d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });

      const expected = startPrice + totalDelta * progress;
      const swing = Math.sin(progress * Math.PI * 1.5) * (inst.high52 - inst.low52) * 0.15;
      const noise = (rng() - 0.5) * (currentPrice * 0.035);
      const open = Number(prevClose.toFixed(2));
      let close = i === count - 1 ? currentPrice : Number((expected + swing + noise).toFixed(2));

      if (inst.low52 && inst.high52) {
        close = Math.max(inst.low52 * 0.98, Math.min(inst.high52 * 1.02, close));
      }
      if (close <= 0) close = Math.max(0.01, open * 0.95);

      const high = Number((Math.max(open, close) + rng() * currentPrice * 0.018).toFixed(2));
      const low = Number((Math.min(open, close) - rng() * currentPrice * 0.018).toFixed(2));
      const volume = Math.floor(250000 + rng() * 800000);

      candles.push({ time: timeStr, open, high, low, close, volume });
      prevClose = close;
    }
  } else {
    // 5Y
    const count = 48; // monthly candles over 4-5 years
    const pct = ((inst.cagr5y ? (Math.pow(1 + inst.cagr5y / 100, 5) - 1) : (inst.perf1Y * 2.2 || 60))) / 100;
    const startPrice = Number((currentPrice / (1 + pct)).toFixed(2));
    const totalDelta = currentPrice - startPrice;
    let prevClose = startPrice;

    for (let i = 0; i < count; i++) {
      const progress = i / Math.max(1, count - 1);
      const d = new Date(now);
      d.setMonth(d.getMonth() - Math.floor((count - 1 - i) * 1.25));
      const timeStr = d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });

      const expected = startPrice + totalDelta * progress;
      const wave = Math.sin(progress * Math.PI * 2.5) * (currentPrice * 0.18);
      const noise = (rng() - 0.5) * (currentPrice * 0.04);
      const open = Number(prevClose.toFixed(2));
      let close = i === count - 1 ? currentPrice : Number((expected + wave + noise).toFixed(2));
      if (close <= 0) close = Math.max(0.01, open * 0.92);

      const high = Number((Math.max(open, close) + rng() * currentPrice * 0.025).toFixed(2));
      const low = Number((Math.min(open, close) - rng() * currentPrice * 0.025).toFixed(2));
      const volume = Math.floor(350000 + rng() * 1200000);

      candles.push({ time: timeStr, open, high, low, close, volume });
      prevClose = close;
    }
  }

  return candles;
}
