import type { Bar, BarsRequest, DataFeed, SymbolMatch, SymbolSearchRequest } from 'openalgo-charts';
import { INSTRUMENTS_DATABASE } from '../market-data';

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

export function generateOpenAlgoBars(
  symbol: string,
  interval: string = '1d',
  barCount: number = 300
): Bar[] {
  const normSym = symbol.toUpperCase();
  const inst = INSTRUMENTS_DATABASE.find((i) => i.symbol.toUpperCase() === normSym) ?? INSTRUMENTS_DATABASE[0];
  const rng = createRng(hashString(`${normSym}_${interval}`));
  const currentPrice = inst.price;
  const bars: Bar[] = [];

  const nowSec = Math.floor(Date.now() / 1000);
  const isIntraday = interval.endsWith('m') || interval.endsWith('h');
  let stepSeconds = 86400;

  if (interval === '1m') stepSeconds = 60;
  else if (interval === '5m') stepSeconds = 300;
  else if (interval === '15m') stepSeconds = 900;
  else if (interval === '30m') stepSeconds = 1800;
  else if (interval === '1h') stepSeconds = 3600;
  else if (interval.toUpperCase() === 'W' || interval === '1w') stepSeconds = 604800;

  const startSec = nowSec - barCount * stepSeconds;
  let prevClose = Number((currentPrice * (0.85 + rng() * 0.15)).toFixed(2));

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
  async getBars(req: BarsRequest): Promise<Bar[]> {
    return generateOpenAlgoBars(req.symbol, req.interval, 350);
  }

  subscribeBars(req: BarsRequest, onBar: (bar: Bar) => void): () => void {
    const timer = setInterval(() => {
      const bars = generateOpenAlgoBars(req.symbol, req.interval, 1);
      if (bars.length > 0) {
        onBar(bars[0]);
      }
    }, 2500);

    return () => clearInterval(timer);
  }

  async searchSymbols(req: SymbolSearchRequest): Promise<SymbolMatch[]> {
    const q = req.query.trim().toLowerCase();
    const matches = INSTRUMENTS_DATABASE.filter(
      (inst) => inst.symbol.toLowerCase().includes(q) || inst.name.toLowerCase().includes(q)
    ).slice(0, 20);

    return matches.map((m) => ({
      symbol: m.symbol,
      description: m.name,
      exchange: 'NSE',
      type: m.assetType || 'stock',
    }));
  }
}

export const defaultHonbaFeed = new HonbaOpenAlgoDataFeed();
