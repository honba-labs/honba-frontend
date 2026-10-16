import type { Bar, BarsRequest, DataFeed, SymbolMatch, SymbolSearchRequest } from 'openalgo-charts';
import { resolveSymbolPrice, searchInstruments } from '../symbol-search';

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

export function getStepSeconds(interval: string = '1d'): number {
  const norm = (interval || '1d').toLowerCase();
  if (norm === '1m') return 60;
  if (norm === '3m') return 180;
  if (norm === '5m') return 300;
  if (norm === '15m') return 900;
  if (norm === '30m') return 1800;
  if (norm === '45m') return 2700;
  if (norm === '1h') return 3600;
  if (norm === '2h') return 7200;
  if (norm === '3h') return 10800;
  if (norm === '4h') return 14400;
  if (norm === '1d' || norm === 'd') return 86400;
  if (norm === '1w' || norm === 'w') return 604800;
  if (norm === '1m' || norm === 'm' || norm === 'month') return 2592000;
  return 86400;
}

export function generateOpenAlgoBars(
  symbol: string,
  interval: string = '1d',
  barCount: number = 300
): Bar[] {
  const normSym = symbol.trim().toUpperCase();
  const currentPrice = resolveSymbolPrice(normSym);
  const rng = createRng(hashString(`${normSym}_${interval}`));
  const bars: Bar[] = [];

  const stepSeconds = getStepSeconds(interval);
  const nowSec = Math.floor(Date.now() / 1000);
  const currentBucket = Math.floor(nowSec / stepSeconds) * stepSeconds;
  const startSec = currentBucket - (barCount - 1) * stepSeconds;
  const isIntraday = interval.endsWith('m') || interval.endsWith('h');

  let prevClose = Number((currentPrice * (0.92 + rng() * 0.08)).toFixed(2));

  for (let i = 0; i < barCount; i++) {
    const time = startSec + i * stepSeconds;
    const progress = i / Math.max(1, barCount - 1);
    const targetPrice = currentPrice;
    const base = prevClose + (targetPrice - prevClose) * (progress * 0.15);
    const noise = (rng() - 0.49) * (currentPrice * (isIntraday ? 0.006 : 0.015));

    const open = Number(prevClose.toFixed(2));
    let close = i === barCount - 1 ? currentPrice : Number((base + noise).toFixed(2));
    if (close <= 0) close = Math.max(0.1, open * 0.98);

    const high = Number((Math.max(open, close) + rng() * currentPrice * (isIntraday ? 0.004 : 0.01)).toFixed(2));
    const low = Number((Math.min(open, close) - rng() * currentPrice * (isIntraday ? 0.004 : 0.01)).toFixed(2));
    const volume = Math.floor(25000 + rng() * 150000);

    bars.push({
      time,
      open,
      high,
      low,
      close,
      volume,
    });
    prevClose = close;
  }

  return bars;
}

export class HonbaOpenAlgoDataFeed implements DataFeed {
  private _lastBars: Map<string, Bar> = new Map();

  async getBars(req: BarsRequest): Promise<Bar[]> {
    const bars = generateOpenAlgoBars(req.symbol, req.interval, 350);
    if (bars.length > 0) {
      const key = `${req.symbol.toUpperCase()}_${req.interval}`;
      this._lastBars.set(key, { ...bars[bars.length - 1] });
    }
    return bars;
  }

  subscribeBars(req: BarsRequest, onBar: (bar: Bar) => void): () => void {
    const normSym = req.symbol.toUpperCase();
    const key = `${normSym}_${req.interval}`;
    const stepSeconds = getStepSeconds(req.interval);

    let activeBar = this._lastBars.get(key);
    if (!activeBar) {
      const initBars = generateOpenAlgoBars(req.symbol, req.interval, 10);
      activeBar = { ...initBars[initBars.length - 1] };
      this._lastBars.set(key, activeBar);
    }

    const timer = setInterval(() => {
      const nowSec = Math.floor(Date.now() / 1000);
      const bucket = Math.floor(nowSec / stepSeconds) * stepSeconds;

      if (!activeBar) return;

      if (bucket > activeBar.time) {
        // Interval rolled over: start a new bar with continuous price
        const open = activeBar.close;
        const delta = (Math.random() - 0.495) * (open * 0.0008);
        const close = Number(Math.max(0.1, open + delta).toFixed(2));
        const high = Number(Math.max(open, close, open + Math.random() * open * 0.0004).toFixed(2));
        const low = Number(Math.min(open, close, open - Math.random() * open * 0.0004).toFixed(2));
        const volume = Math.floor(100 + Math.random() * 500);

        activeBar = {
          time: bucket,
          open,
          high,
          low,
          close,
          volume,
        };
      } else {
        // Update the current in-flight candle in-place with realistic micro-ticks
        const delta = (Math.random() - 0.495) * (activeBar.close * 0.0006);
        const newClose = Number(Math.max(0.1, activeBar.close + delta).toFixed(2));
        activeBar.close = newClose;
        activeBar.high = Number(Math.max(activeBar.high, newClose).toFixed(2));
        activeBar.low = Number(Math.min(activeBar.low, newClose).toFixed(2));
        activeBar.volume = (activeBar.volume ?? 0) + Math.floor(10 + Math.random() * 50);
      }

      this._lastBars.set(key, { ...activeBar });
      onBar({ ...activeBar });
    }, 2000);

    return () => clearInterval(timer);
  }

  async searchSymbols(req: SymbolSearchRequest): Promise<SymbolMatch[]> {
    const matches = searchInstruments(req.query, 'ALL', 500);
    return matches.map((m) => ({
      symbol: m.symbol,
      name: m.name,
      exchange: m.exchange,
      assetClass: m.category,
    }));
  }
}

export const defaultHonbaFeed = new HonbaOpenAlgoDataFeed();
