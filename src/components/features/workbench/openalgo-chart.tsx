import React, { useEffect, useRef, useState } from 'react';
import 'openalgo-charts/indicators';
import type { SeriesApi } from 'openalgo-charts';
import {
  createWidget,
  registerWidgetDialogs,
  injectWidgetStyles,
  WIDGET_DIALOGS,
  type Widget,
} from 'openalgo-charts/widget';
import { defaultHonbaFeed } from '../../../core/workbench/openalgo-feed';
import { INSTRUMENTS_DATABASE } from '../../../core/market-data';

interface OpenAlgoChartProps {
  symbol: string;
  timeframe?: string;
  chartMode?: 'candles' | 'area';
  onSymbolChange?: (symbol: string) => void;
  onIntervalChange?: (interval: string) => void;
  showRail?: boolean;
  volume?: boolean;
}

let stylesInjected = false;
let dialogsRegistered = false;

function ensureWidgetReady() {
  if (typeof document !== 'undefined') {
    if (!stylesInjected) {
      injectWidgetStyles(document);
      stylesInjected = true;
    }
    if (!dialogsRegistered) {
      registerWidgetDialogs(WIDGET_DIALOGS);
      dialogsRegistered = true;
    }
  }
}

function anchorViewport(widget: Widget): boolean {
  try {
    const chart = widget.chart;
    const count = chart.dataLayer.length;
    if (count <= 0) return false;

    const last = count - 1;
    const range = chart.getVisibleLogicalRange();
    if (range) {
      const visible = Math.min(last, range.to) - Math.max(0, range.from) + 1;
      if (visible >= Math.min(10, count)) return false;
    }

    const visible = Math.min(200, count);
    chart.setVisibleLogicalRange({
      from: Math.max(0, last - visible + 1),
      to: last + Math.max(1, Math.round(visible * 0.05)),
    });
    return true;
  } catch {
    return false;
  }
}

function syncVolume(widget: Widget, series: SeriesApi | null): void {
  if (!series) return;
  try {
    series.setData(
      widget.series.getData().map((bar) => ({
        time: bar.time,
        open: 0,
        high: bar.volume ?? 0,
        low: 0,
        close: bar.volume ?? 0,
      }))
    );
  } catch {
    // ignore
  }
}

export const OpenAlgoChart: React.FC<OpenAlgoChartProps> = ({
  symbol,
  timeframe = '1d',
  chartMode = 'candles',
  onSymbolChange,
  onIntervalChange,
  showRail = true,
  volume = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<Widget | null>(null);
  const volumeSeriesRef = useRef<SeriesApi | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    ensureWidgetReady();
    if (!containerRef.current) return;

    let destroyed = false;
    const normInterval = timeframe.toLowerCase() === '1d' ? '1d' : timeframe.toLowerCase();
    const chartType = chartMode === 'area' ? 'area' : 'candlestick';

    try {
      const widget = createWidget(containerRef.current, {
        feed: defaultHonbaFeed,
        symbol: symbol.toUpperCase(),
        exchange: 'NSE',
        interval: normInterval,
        theme: 'dark',
        chartType,
        rail: showRail,
        topbar: true,
        statusline: true,
        panels: false,
        symbolSearch: async (query) => {
          const q = (query || '').trim().toLowerCase();
          return INSTRUMENTS_DATABASE.filter(
            (i) => i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)
          ).slice(0, 15).map((m) => ({
            symbol: m.symbol,
            description: m.name,
            exchange: 'NSE',
            type: m.assetType || 'stock',
          }));
        },
      });

      if (destroyed) {
        widget.destroy();
        return;
      }

      widgetRef.current = widget;

      widget.on('symbol', (evt) => {
        if (evt?.symbol && onSymbolChange) {
          onSymbolChange(evt.symbol);
        }
      });

      widget.on('interval', (evt) => {
        if (evt?.interval && onIntervalChange) {
          onIntervalChange(evt.interval);
        }
      });

      widget.on('data', (evt) => {
        if (evt.bars > 0 && !widget.isDestroyed) {
          anchorViewport(widget);
          if (volumeSeriesRef.current) {
            syncVolume(widget, volumeSeriesRef.current);
          }
        }
      });

      setIsReady(true);
    } catch (err) {
      console.warn('Failed to initialize OpenAlgo widget:', err);
    }

    return () => {
      destroyed = true;
      if (volumeSeriesRef.current) {
        try {
          volumeSeriesRef.current.remove();
        } catch {
          // ignore
        }
        volumeSeriesRef.current = null;
      }
      if (widgetRef.current) {
        try {
          widgetRef.current.destroy();
        } catch {
          // ignore
        }
        widgetRef.current = null;
      }
    };
  }, []);

  // Mount Volume histogram overlay
  useEffect(() => {
    const widget = widgetRef.current;
    if (!isReady || !widget) return;

    if (!volume) {
      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.remove();
        volumeSeriesRef.current = null;
      }
      return;
    }

    if (volumeSeriesRef.current) return;

    try {
      const volSeries = widget.chart.addSeries('histogram', {
        paneIndex: 0,
        priceScaleId: '',
        style: { color: 'rgba(41, 98, 255, 0.28)' },
        priceFormat: { type: 'volume' },
      });
      volSeries.priceScale().setOptions({ marginTop: 0.82, marginBottom: 0 });
      volumeSeriesRef.current = volSeries;
      syncVolume(widget, volSeries);
    } catch {
      // ignore
    }
  }, [isReady, volume]);

  // Synchronize external symbol changes
  useEffect(() => {
    const w = widgetRef.current;
    if (w && symbol && w.symbol().toUpperCase() !== symbol.toUpperCase()) {
      try {
        w.setSymbol(symbol.toUpperCase(), 'NSE');
      } catch {
        // ignore
      }
    }
  }, [symbol]);

  // Synchronize timeframe changes
  useEffect(() => {
    const w = widgetRef.current;
    if (w && timeframe) {
      const norm = timeframe.toLowerCase();
      try {
        if (w.interval() !== norm) {
          w.setInterval(norm);
        }
      } catch {
        // ignore
      }
    }
  }, [timeframe]);

  // Synchronize chart mode changes
  useEffect(() => {
    const w = widgetRef.current;
    if (w && chartMode) {
      const targetType = chartMode === 'area' ? 'area' : 'candlestick';
      try {
        if (w.chartType() !== targetType) {
          w.setChartType(targetType);
        }
      } catch {
        // ignore
      }
    }
  }, [chartMode]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 250,
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--bg-app)',
      }}
    />
  );
};
