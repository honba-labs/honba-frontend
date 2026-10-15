import React, { useEffect, useRef } from 'react';
import 'openalgo-charts/indicators';
import {
  createWidget,
  registerWidgetDialogs,
  injectWidgetStyles,
  WIDGET_DIALOGS,
  type Widget,
} from 'openalgo-charts/widget';
import { defaultHonbaFeed } from '../../../core/workbench/openalgo-feed';

interface OpenAlgoChartProps {
  symbol: string;
  timeframe?: string;
  chartMode?: 'candles' | 'area';
  onSymbolChange?: (symbol: string) => void;
  showRail?: boolean;
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

export const OpenAlgoChart: React.FC<OpenAlgoChartProps> = ({
  symbol,
  timeframe = '1d',
  chartMode = 'candles',
  onSymbolChange,
  showRail = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<Widget | null>(null);

  useEffect(() => {
    ensureWidgetReady();
    if (!containerRef.current) return;

    const normInterval = timeframe.toLowerCase();
    const chartType = chartMode === 'area' ? 'area' : 'candlestick';

    try {
      const widget = createWidget(containerRef.current, {
        feed: defaultHonbaFeed,
        symbol: symbol.toUpperCase(),
        exchange: 'NSE',
        interval: normInterval === '1d' ? '1d' : normInterval,
        theme: 'dark',
        chartType,
        rail: showRail,
        topbar: true,
        statusline: true,
        panels: false,
      });

      widgetRef.current = widget;

      widget.on('symbol', (evt) => {
        if (evt?.symbol && onSymbolChange) {
          onSymbolChange(evt.symbol);
        }
      });
    } catch (err) {
      console.warn('Failed to initialize OpenAlgo widget:', err);
    }

    return () => {
      if (widgetRef.current) {
        try {
          widgetRef.current.destroy();
        } catch {
          // ignore cleanup errors
        }
        widgetRef.current = null;
      }
    };
  }, []);

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
        minHeight: 240,
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--bg-app)',
      }}
    />
  );
};
