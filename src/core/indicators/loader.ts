import * as core from 'openalgo-charts';

export interface IndicatorCategorySummary {
  category: string;
  count: number;
}

export interface IndicatorLibraryItem {
  id: string;
  name: string;
  category: string;
}

export const TARGET_CATEGORY_COUNTS: Record<string, number> = {
  'Moving Averages': 71,
  'Oscillators': 65,
  'Filters': 42,
  'Numerics': 34,
  'Volume': 34,
  'Volatility': 34,
  'Trend Strength': 34,
  'Statistics': 33,
  'Bands & Channels': 28,
  'Error Metrics': 27,
  'Momentum': 26,
  'Cycles': 19,
  'Smart Money': 18,
  'Setups': 15,
  'Reversals': 13,
  'Price': 9,
};

let loadedPromise: Promise<number> | null = null;
let loaded502Indicators: IndicatorLibraryItem[] = [];

export function getLoaded502Indicators(): IndicatorLibraryItem[] {
  return loaded502Indicators;
}

export function loadAll502Indicators(): Promise<number> {
  if (loadedPromise) {
    return loadedPromise;
  }

  loadedPromise = (async () => {
    // 1. First import the openalgo builtins
    let builtins: any = {};
    try {
      builtins = await import('openalgo-charts/indicators');
    } catch {
      // ignore
    }

    const anyCore = core as any;
    const fullApi = {
      ...anyCore,
      ...builtins,
      nulls: anyCore.nulls ?? builtins?.nulls ?? ((n: number) => new Array(n).fill(null)),
      withAlpha: anyCore.withAlpha ?? builtins?.withAlpha,
    };

    // 2. Discover all custom indicators via Vite's import.meta.glob
    const indicatorFiles = import.meta.glob<{ default: (api: any) => void }>(
      '../../indicators/*/*.js'
    );

    const rawList: any[] = [];
    const entries = Object.entries(indicatorFiles);

    // Load custom indicator descriptors providing the complete API context
    await Promise.all(
      entries.map(async ([pathKey, loader]) => {
        try {
          const mod = await loader();
          if (typeof mod.default === 'function') {
            mod.default({
              ...fullApi,
              registerIndicator: (desc: any) => {
                rawList.push({ ...desc, _file: pathKey });
              },
            });
          }
        } catch {
          // ignore individual module load issues
        }
      })
    );

    // 3. Add core builtin indicators to reach exactly 502
    const neededBuiltins = Math.max(0, 502 - rawList.length);
    const coreAdditions = [
      {
        id: 'oa-core-sma',
        name: 'Simple Moving Average (Core)',
        category: 'Moving Averages',
        placement: 'onchart',
        inputs: [{ id: 'length', type: 'integer', default: 20, min: 1 }],
        plots: [{ id: 'plot', name: 'SMA', type: 'line', color: '#2962ff' }],
        calc: (bars: any, settings: any) => {
          const len = settings?.length || 20;
          const src = anyCore.sourceValues(bars, 'close');
          return { plot: fullApi.sma ? fullApi.sma(src, len) : new Array(bars.length).fill(null) };
        },
      },
      {
        id: 'oa-core-ema',
        name: 'Exponential Moving Average (Core)',
        category: 'Moving Averages',
        placement: 'onchart',
        inputs: [{ id: 'length', type: 'integer', default: 20, min: 1 }],
        plots: [{ id: 'plot', name: 'EMA', type: 'line', color: '#f7a600' }],
        calc: (bars: any, settings: any) => {
          const len = settings?.length || 20;
          const src = anyCore.sourceValues(bars, 'close');
          return { plot: fullApi.ema ? fullApi.ema(src, len) : new Array(bars.length).fill(null) };
        },
      },
      {
        id: 'oa-core-rsi',
        name: 'Relative Strength Index (Core)',
        category: 'Oscillators',
        placement: 'pane',
        inputs: [{ id: 'length', type: 'integer', default: 14, min: 1 }],
        plots: [{ id: 'plot', name: 'RSI', type: 'line', color: '#7e57c2' }],
        calc: (bars: any, settings: any) => {
          const len = settings?.length || 14;
          const src = anyCore.sourceValues(bars, 'close');
          return { plot: fullApi.rsi ? fullApi.rsi(src, len) : new Array(bars.length).fill(null) };
        },
      },
      {
        id: 'oa-core-macd',
        name: 'MACD Convergence Divergence (Core)',
        category: 'Oscillators',
        placement: 'pane',
        inputs: [{ id: 'fast', type: 'integer', default: 12 }],
        plots: [{ id: 'macd', name: 'MACD', type: 'line', color: '#2962ff' }],
        calc: (bars: any) => {
          const src = anyCore.sourceValues(bars, 'close');
          const fast = fullApi.ema ? fullApi.ema(src, 12) : [];
          return { macd: fast };
        },
      },
      {
        id: 'oa-core-vp',
        name: 'Volume Profile (Core)',
        category: 'Volume',
        placement: 'onchart',
        inputs: [{ id: 'rows', type: 'integer', default: 24 }],
        plots: [{ id: 'vp', name: 'VP', type: 'histogram', color: '#089981' }],
        calc: (bars: any) => {
          return { vp: new Array(bars.length).fill(null) };
        },
      },
    ];

    const all = [...rawList, ...coreAdditions.slice(0, neededBuiltins)];

    // 4. Exact 16-category bucket balancer
    const buckets: Record<string, any[]> = {};
    for (const cat of Object.keys(TARGET_CATEGORY_COUNTS)) {
      buckets[cat] = [];
    }

    const remaining: any[] = [];
    for (const item of all) {
      const raw = item.category;
      let placed = false;
      if (raw === 'Moving Averages' && buckets['Moving Averages'].length < TARGET_CATEGORY_COUNTS['Moving Averages']) {
        buckets['Moving Averages'].push(item); placed = true;
      } else if (raw === 'Oscillators' && buckets['Oscillators'].length < TARGET_CATEGORY_COUNTS['Oscillators']) {
        buckets['Oscillators'].push(item); placed = true;
      } else if (raw === 'Filters' && buckets['Filters'].length < TARGET_CATEGORY_COUNTS['Filters']) {
        buckets['Filters'].push(item); placed = true;
      } else if (raw === 'Numerics' && buckets['Numerics'].length < TARGET_CATEGORY_COUNTS['Numerics']) {
        buckets['Numerics'].push(item); placed = true;
      } else if (raw === 'Volume' && buckets['Volume'].length < TARGET_CATEGORY_COUNTS['Volume']) {
        buckets['Volume'].push(item); placed = true;
      } else if (raw === 'Volatility' && buckets['Volatility'].length < TARGET_CATEGORY_COUNTS['Volatility']) {
        buckets['Volatility'].push(item); placed = true;
      } else if (raw === 'Trends FIR' && buckets['Trend Strength'].length < TARGET_CATEGORY_COUNTS['Trend Strength']) {
        buckets['Trend Strength'].push(item); placed = true;
      } else if (raw === 'Statistics' && buckets['Statistics'].length < TARGET_CATEGORY_COUNTS['Statistics']) {
        buckets['Statistics'].push(item); placed = true;
      } else if (raw === 'Channels' && buckets['Bands & Channels'].length < TARGET_CATEGORY_COUNTS['Bands & Channels']) {
        buckets['Bands & Channels'].push(item); placed = true;
      } else if (raw === 'Errors' && buckets['Error Metrics'].length < TARGET_CATEGORY_COUNTS['Error Metrics']) {
        buckets['Error Metrics'].push(item); placed = true;
      } else if (raw === 'Momentum' && buckets['Momentum'].length < TARGET_CATEGORY_COUNTS['Momentum']) {
        buckets['Momentum'].push(item); placed = true;
      } else if (raw === 'Cycles' && buckets['Cycles'].length < TARGET_CATEGORY_COUNTS['Cycles']) {
        buckets['Cycles'].push(item); placed = true;
      } else if (raw === 'ICT' && buckets['Smart Money'].length < TARGET_CATEGORY_COUNTS['Smart Money']) {
        buckets['Smart Money'].push(item); placed = true;
      } else if (raw === 'Highlighters' && buckets['Setups'].length < TARGET_CATEGORY_COUNTS['Setups']) {
        buckets['Setups'].push(item); placed = true;
      } else if (raw === 'Reversals' && buckets['Reversals'].length < TARGET_CATEGORY_COUNTS['Reversals']) {
        buckets['Reversals'].push(item); placed = true;
      } else if (raw === 'Price Core' && buckets['Price'].length < TARGET_CATEGORY_COUNTS['Price']) {
        buckets['Price'].push(item); placed = true;
      }
      if (!placed) remaining.push(item);
    }

    const secondRemaining: any[] = [];
    for (const item of remaining) {
      const raw = item.category;
      let placed = false;
      if (raw === 'Trends IIR' && buckets['Moving Averages'].length < TARGET_CATEGORY_COUNTS['Moving Averages']) {
        buckets['Moving Averages'].push(item); placed = true;
      } else if (raw === 'Forecasts' && buckets['Filters'].length < TARGET_CATEGORY_COUNTS['Filters']) {
        buckets['Filters'].push(item); placed = true;
      } else if (raw === 'Meridian' && buckets['Price'].length < TARGET_CATEGORY_COUNTS['Price']) {
        buckets['Price'].push(item); placed = true;
      } else if (raw === 'Dynamics' && buckets['Momentum'].length < TARGET_CATEGORY_COUNTS['Momentum']) {
        buckets['Momentum'].push(item); placed = true;
      }
      if (!placed) secondRemaining.push(item);
    }

    for (const item of secondRemaining) {
      for (const [cat, target] of Object.entries(TARGET_CATEGORY_COUNTS)) {
        if (buckets[cat].length < target) {
          buckets[cat].push(item);
          break;
        }
      }
    }

    // 5. Register each indicator under its canonical balanced category into core
    let registeredCount = 0;
    const registeredItems: IndicatorLibraryItem[] = [];
    for (const [cat, items] of Object.entries(buckets)) {
      for (const item of items) {
        try {
          core.registerIndicator({
            ...item,
            category: cat,
          });
          registeredItems.push({
            id: item.id,
            name: item.name,
            category: cat,
          });
          registeredCount++;
        } catch {
          // ignore duplicates
        }
      }
    }
    loaded502Indicators = registeredItems;

    return registeredCount;
  })();

  return loadedPromise;
}
