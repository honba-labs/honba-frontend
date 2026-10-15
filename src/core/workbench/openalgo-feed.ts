import type { Bar, BarsRequest, DataFeed } from 'openalgo-charts';
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
  barCount: number = 180
): Bar[] {
  const normSym = symbol.toUpperCase();
  const inst = INSTRUMENTS_DATABASE.find((i) => i.symbol.toUpperCase() === normSym) ?? INSTRUMENTS_DATABASE[0];
  const rng = createRng(hashString(`${normSym}_${interval}`));
  const currentPrice = inst.price;
  const bars: Bar[] = [];

  const nowSec = Math.floor(Date.now() / 1000);
  const isIntraday = interval.endsWith('m') || interval.endsWith('h');
  const stepSeconds = interval === '1m' ? 60 : interval === '5m' ? 300 : interval === '15m' ? 900 : interval === '1h' ? 3600 : 86400;

  const startSec = nowSec - barCount * stepSeconds;
  let prevClose = Number((currentPrice * (0.85 + rng() * 0.15)).toFixed(2));

  for (let i = 0; i < barCount; i++) {
    const time = (startSec + i * stepSeconds);
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
    return generateOpenAlgoBars(req.symbol, req.interval, 200);
  }

  subscribeBars(req: BarsRequest, onBar: (bar: Bar) => void): () => void {
    const timer = setInterval(() => {
      const bars = generateOpenAlgoBars(req.symbol, req.interval, 1);
      if (bars.length > 0) {
        onBar(bars[0]);
      }
    }, 3000);

    return () => clearInterval(timer);
  }
}

export const defaultHonbaFeed = new HonbaOpenAlgoDataFeed();
