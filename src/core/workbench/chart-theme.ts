import { type ChartTheme, darkTheme, lightTheme } from 'openalgo-charts';
import { themeEngine } from '../theme-engine';

function resolveColor(varName: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  try {
    let raw = varName.replace(/^var\(/, '').replace(/\)$/, '').trim();
    const style = getComputedStyle(document.documentElement);
    let depth = 0;
    while (raw && depth < 6) {
      const val = style.getPropertyValue(raw).trim();
      if (!val) break;
      if (val.startsWith('var(')) {
        raw = val.replace(/^var\(/, '').replace(/\)$/, '').trim();
        depth++;
      } else {
        return val;
      }
    }
    return fallback;
  } catch {
    return fallback;
  }
}

/**
 * Bridges Honba's design system tokens (--bullish, --bearish, --bg-app, etc.)
 * into openalgo-charts ChartTheme, ensuring candles, wicks, volume, and buy/sell
 * affordances strictly track the active theme palette.
 */
export function buildHonbaChartTheme(): ChartTheme {
  const root = typeof document !== 'undefined' ? document.documentElement : null;
  const currentPalette = root?.getAttribute('data-theme') || themeEngine.getConfig().palette || 'honba-dark';
  const isLight = currentPalette === 'honba-light' || currentPalette === 'light' || currentPalette === 'arbkit-ledger';

  const base = isLight ? lightTheme : darkTheme;

  const bg = resolveColor('--bg-app', isLight ? '#ffffff' : '#131722');
  const bullish = resolveColor('--bullish', '#089981');
  const bearish = resolveColor('--bearish', '#f23645');
  const textMuted = resolveColor('--text-muted', isLight ? '#5b6472' : '#8b91a7');
  const borderSubtle = resolveColor('--border-subtle', isLight ? '#eef1f6' : '#2a2e39');
  const accent = resolveColor('--accent-primary', '#2962ff');

  return {
    ...base,
    background: bg,
    grid: borderSubtle,
    axisText: textMuted,
    axisLine: borderSubtle,
    paneSeparator: borderSubtle,
    crosshair: textMuted,
    crosshairLabelBackground: accent,
    upColor: bullish,
    downColor: bearish,
    wickUpColor: bullish,
    wickDownColor: bearish,
    lineColor: accent,
    areaTopColor: isLight ? 'rgba(41,98,255,0.22)' : 'rgba(41,98,255,0.32)',
    areaBottomColor: 'rgba(41,98,255,0.00)',
    baselineTopLine: bullish,
    baselineTopFill: isLight ? 'rgba(8,153,129,0.12)' : 'rgba(8,153,129,0.22)',
    baselineBottomLine: bearish,
    baselineBottomFill: isLight ? 'rgba(242,54,69,0.12)' : 'rgba(242,54,69,0.22)',
    lastPriceUp: bullish,
    lastPriceDown: bearish,
    lastPriceText: '#ffffff',
    buy: bullish,
    sell: bearish,
    profit: bullish,
    loss: bearish,
  };
}

/**
 * Subscribes to HTML data-theme changes and themeEngine events,
 * firing callback with freshly computed ChartTheme on next animation frame.
 */
export function subscribeHonbaTheme(onTheme: (theme: ChartTheme) => void): () => void {
  if (typeof document === 'undefined') return () => {};

  const handleUpdate = () => {
    requestAnimationFrame(() => {
      onTheme(buildHonbaChartTheme());
    });
  };

  const unsubEngine = themeEngine.subscribe(handleUpdate);

  const observer = new MutationObserver(handleUpdate);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  return () => {
    unsubEngine();
    observer.disconnect();
  };
}


