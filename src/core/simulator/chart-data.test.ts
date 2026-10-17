import { describe, expect, it } from 'vitest';

import type { Bar as DomainBar } from '../types/generated/domain';

import {
  IST_OFFSET_SECONDS,
  SESSION_CLOSE_SECONDS,
  SESSION_CLOSE_UTC,
  SESSION_OPEN_SECONDS,
  SESSION_OPEN_UTC,
  barSpecSeconds,
  markerToleranceSec,
  parseBarSpec,
  previewBars,
  resampleBars,
  snapToBars,
  toChartBars,
  unixNanosToSeconds,
  type ChartBar,
} from './chart-data';

/** 2024-01-01 is a Monday. */
const JAN1_2024 = Math.floor(Date.UTC(2024, 0, 1) / 1000);

/** Midnight UTC of the calendar day `i` days after 2024-01-01. */
function day(i: number): number {
  return JAN1_2024 + i * 86_400;
}

/** 09:15 IST of the calendar day `i` after 2024-01-01. */
function open(i: number): number {
  return day(i) + SESSION_OPEN_UTC;
}

function nanos(seconds: number, subSeconds = ''): { iso: string; unix_nanos: string } {
  return { iso: new Date(seconds * 1000).toISOString(), unix_nanos: `${seconds}${subSeconds.padStart(9, '0')}` };
}

function domainBar(seconds: number, close: number, extra: Partial<DomainBar> = {}): DomainBar {
  return {
    bar_type: {
      instrument_id: { symbol: 'TCS', exchange: 'NSE' },
      spec: { aggregation: 'day', price_type: 'last', step: 1 },
    },
    open: close - 1,
    high: close + 1,
    low: close - 2,
    close,
    ts_event: nanos(seconds),
    ts_init: nanos(seconds),
    volume: 1_000,
    ...extra,
  };
}

describe('unixNanosToSeconds', () => {
  it('reads whole seconds off the nanosecond string without a lossy Number conversion', () => {
    // 1.7e18 nanoseconds is past Number.MAX_SAFE_INTEGER, so it must not go
    // through `Number` before the seconds are taken.
    expect(unixNanosToSeconds(nanos(1_700_000_000, '250000000'))).toBe(1_700_000_000);
  });

  it('falls back to iso when the nanosecond field is unusable', () => {
    expect(unixNanosToSeconds({ iso: '2024-01-01T03:45:00Z', unix_nanos: 'garbage' })).toBe(JAN1_2024 + 3 * 3600 + 45 * 60);
    expect(unixNanosToSeconds(null)).toBeNull();
    expect(unixNanosToSeconds({ iso: '', unix_nanos: '' })).toBeNull();
  });
});

describe('parseBarSpec / barSpecSeconds', () => {
  it('parses the run contract spelling, longest unit first', () => {
    expect(parseBarSpec('5m')).toEqual({ step: 5, unit: 'm' });
    expect(parseBarSpec('1mo')).toEqual({ step: 1, unit: 'mo' });
    expect(parseBarSpec('1d')).toEqual({ step: 1, unit: 'd' });
    expect(parseBarSpec('6')).toBeNull();
    expect(parseBarSpec('')).toBeNull();
    expect(parseBarSpec(null)).toBeNull();
  });

  it('has a fixed width except for months', () => {
    expect(barSpecSeconds('5m')).toBe(300);
    expect(barSpecSeconds('1d')).toBe(86_400);
    expect(barSpecSeconds('1mo')).toBeNull();
  });

  it('uses the whole step as the marker snap tolerance', () => {
    expect(markerToleranceSec('5m')).toBe(300);
    expect(markerToleranceSec('1mo')).toBe(0);
  });
});

describe('toChartBars', () => {
  it('converts, sorts and de-duplicates, keeping the later bar for a timestamp', () => {
    const bars = toChartBars([domainBar(200, 2), domainBar(100, 1), domainBar(200, 3)]);
    expect(bars.map((bar) => [bar.time, bar.close])).toEqual([
      [100, 1],
      [200, 3],
    ]);
  });

  it('drops rows with no usable timestamp or price', () => {
    expect(toChartBars([domainBar(100, 1, { close: Number.NaN })])).toEqual([]);
    expect(toChartBars([domainBar(100, 1, { ts_event: { iso: '', unix_nanos: '' } })])).toEqual([]);
    expect(toChartBars(null)).toEqual([]);
  });
});

describe('resampleBars', () => {
  const minute = (dayIndex: number, offset: number, close: number, volume = 10): ChartBar => ({
    time: open(dayIndex) + offset * 60,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume,
  });

  it('folds finer bars into the run bar_spec, keeping OHLC semantics and the first timestamp', () => {
    const folded = resampleBars([minute(0, 0, 100), minute(0, 5, 104), minute(0, 10, 102)], '15m');
    expect(folded).toHaveLength(1);
    expect(folded[0]).toEqual({
      time: open(0),
      open: 100,
      high: 105,
      low: 99,
      close: 102,
      volume: 30,
    });
  });

  it('never invents a bar for a bucket with no data, so a holiday stays a gap', () => {
    // Mon 2024-01-01 and Mon 2024-01-08: the week in between is never emitted
    // by the source and is not fabricated here.
    const daily = resampleBars([minute(0, 0, 100), minute(7, 0, 110)], '1d');
    expect(daily.map((bar) => bar.time)).toEqual([open(0), open(7)]);
    expect(resampleBars([], '1d')).toEqual([]);
  });

  it('buckets days and months on IST boundaries, not UTC ones', () => {
    // 16:00 IST is 10:30 UTC — the same IST day, and still January.
    const bars: ChartBar[] = [
      { time: open(0), open: 1, high: 1, low: 1, close: 1, volume: 1 },
      { time: open(0) + 22_500, open: 2, high: 2, low: 2, close: 2, volume: 1 },
    ];
    expect(resampleBars(bars, '1d').map((bar) => bar.close)).toEqual([2]);
    expect(resampleBars(bars, '1mo')).toHaveLength(1);
  });

  it('returns the input unchanged when the spec is already the bar width', () => {
    const bars = [minute(0, 0, 1), minute(0, 5, 2)];
    expect(resampleBars(bars, '5m').map((bar) => bar.time)).toEqual(bars.map((bar) => bar.time));
  });
});

describe('previewBars', () => {
  const request = { instrumentId: 'TCS.NSE', from: open(0) - 3_600, to: open(5), barSpec: '1d' };

  it('emits one bar per weekday session and none at weekends', () => {
    const bars = previewBars(request);
    expect(bars).toHaveLength(5); // Mon..Fri; Sat 2024-01-06 is outside the window
    for (const bar of bars) {
      expect([1, 2, 3, 4, 5]).toContain(new Date(bar.time * 1000).getUTCDay());
      expect(bar.time % 86_400).toBe(SESSION_OPEN_UTC);
    }
  });

  it('is a pure function of time, so two overlapping windows agree bar for bar', () => {
    const wide = previewBars(request);
    const narrow = previewBars({ ...request, from: open(2) - 3_600, to: open(5) });
    expect(narrow.length).toBeGreaterThan(0);
    expect(wide.filter((bar) => bar.time >= narrow[0].time)).toEqual(narrow);
  });

  it('keeps intraday bars inside the 09:15-15:30 IST session on the bar_spec grid', () => {
    const bars = previewBars({ ...request, to: day(1), barSpec: '5m' });
    expect(bars.length).toBeGreaterThan(50);
    for (const bar of bars) {
      // The generator anchors each session at the IST-day open; mirror that here.
      const istDay = Math.floor((bar.time + IST_OFFSET_SECONDS) / 86_400);
      const sessionOpen = istDay * 86_400 - IST_OFFSET_SECONDS + SESSION_OPEN_SECONDS;
      const sessionClose = istDay * 86_400 - IST_OFFSET_SECONDS + SESSION_CLOSE_SECONDS;
      expect(bar.time).toBeGreaterThanOrEqual(sessionOpen);
      expect(bar.time).toBeLessThan(sessionClose);
      expect((bar.time - sessionOpen) % 300).toBe(0);
      expect(bar.high).toBeGreaterThanOrEqual(bar.close);
      expect(bar.close).toBeGreaterThanOrEqual(bar.low);
    }
  });

  it('returns nothing for an unusable spec or window', () => {
    expect(previewBars({ ...request, barSpec: 'soon' })).toEqual([]);
    expect(previewBars({ ...request, to: request.from })).toEqual([]);
  });
});

describe('snapToBars', () => {
  const bars: ChartBar[] = [0, 300, 600, 900].map((offset) => ({
    time: open(0) + offset,
    open: 1,
    high: 1,
    low: 1,
    close: 1,
    volume: 0,
  }));

  it('lands a fill on the bar it traded on', () => {
    expect(snapToBars([{ ts: open(0) + 600, id: 'a' }], bars, 300)).toEqual([{ ts: open(0) + 600, id: 'a' }]);
  });

  it('tolerates a fill a fraction of a step away from its bar', () => {
    expect(snapToBars([{ ts: open(0) + 610 }], bars, 300)[0].ts).toBe(open(0) + 600);
  });

  it('leaves a marker alone when no bar is within tolerance', () => {
    const lone = [{ ts: open(0) + 20_000 }];
    expect(snapToBars(lone, bars, 300)[0].ts).toBe(open(0) + 20_000);
    expect(snapToBars(lone, [], 300)[0].ts).toBe(open(0) + 20_000);
  });

  it('snaps the very first and very last markers too', () => {
    expect(snapToBars([{ ts: open(0) - 120 }], bars, 300)[0].ts).toBe(open(0));
    expect(snapToBars([{ ts: open(0) + 1_000 }], bars, 300)[0].ts).toBe(open(0) + 900);
  });
});
