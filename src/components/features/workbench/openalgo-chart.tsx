import React, { useEffect, useRef, useState, useMemo } from 'react';
import type { SeriesApi } from 'openalgo-charts';
import {
  createWidget,
  registerWidgetDialog,
  registerWidgetDialogs,
  injectWidgetStyles,
  WIDGET_DIALOGS,
  WIDGET_COMPONENT_CSS,
  type Widget,
} from 'openalgo-charts/widget';
import {
  Search,
  BarChart3,
  Layers,
  Undo2,
  Redo2,
  Camera,
  Maximize2,
  Minimize2,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import { defaultHonbaFeed } from '../../../core/workbench/openalgo-feed';
import { INSTRUMENTS_DATABASE } from '../../../core/market-data';
import { loadAll502Indicators } from '../../../core/indicators/loader';
import { mountCustomIndicatorPicker } from './indicator-picker-dialog';

interface OpenAlgoChartProps {
  symbol: string;
  timeframe?: string;
  chartMode?: 'candles' | 'area';
  onSymbolChange?: (symbol: string) => void;
  onIntervalChange?: (interval: string) => void;
  showRail?: boolean;
  volume?: boolean;
  bottombar?: boolean;
}

let stylesInjected = false;
let dialogsRegistered = false;

function ensureWidgetReady() {
  if (typeof document !== 'undefined') {
    if (!stylesInjected) {
      injectWidgetStyles(document, WIDGET_COMPONENT_CSS);
      stylesInjected = true;
    }
    if (!dialogsRegistered) {
      registerWidgetDialogs(WIDGET_DIALOGS);
      registerWidgetDialog('indicatorPicker', mountCustomIndicatorPicker as any);
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

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '1d', '1w'] as const;

const CHART_TYPES = [
  { id: 'candlestick', label: 'Candles' },
  { id: 'area', label: 'Area' },
  { id: 'line', label: 'Line' },
  { id: 'hollow-candle', label: 'Hollow Candles' },
  { id: 'heikin-ashi', label: 'Heikin Ashi' },
  { id: 'bar', label: 'Bars' },
] as const;

export const OpenAlgoChart: React.FC<OpenAlgoChartProps> = ({
  symbol,
  timeframe = '1d',
  chartMode = 'candles',
  onSymbolChange,
  onIntervalChange,
  showRail = true,
  volume = true,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const chartHostRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<Widget | null>(null);
  const volumeSeriesRef = useRef<SeriesApi | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [symbolSearchOpen, setSymbolSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [chartTypeOpen, setChartTypeOpen] = useState(false);
  const [currentChartType, setCurrentChartType] = useState<string>(chartMode === 'area' ? 'area' : 'candlestick');
  const [activeIndicatorCount, setActiveIndicatorCount] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Filter instruments for symbol search dropdown
  const filteredSymbols = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return INSTRUMENTS_DATABASE.slice(0, 15);
    return INSTRUMENTS_DATABASE.filter(
      (i) => i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [searchQuery]);

  // Track fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === rootRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Poll undo/redo state
  useEffect(() => {
    const widget = widgetRef.current;
    if (!widget || !isReady) return;

    const timer = setInterval(() => {
      if (widget.isDestroyed) return;
      try {
        setCanUndo(widget.draw.canUndo());
        setCanRedo(widget.draw.canRedo());
        setActiveIndicatorCount(widget.chart.indicators().length);
      } catch {
        // ignore
      }
    }, 400);

    return () => clearInterval(timer);
  }, [isReady]);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setSymbolSearchOpen(false);
        setChartTypeOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize the OpenAlgo Widget once
  useEffect(() => {
    ensureWidgetReady();
    if (!chartHostRef.current) return;

    let destroyed = false;
    const normInterval = timeframe.toLowerCase() === '1d' ? '1d' : timeframe.toLowerCase();
    const initialChartType = chartMode === 'area' ? 'area' : 'candlestick';

    const buildWidget = async () => {
      await loadAll502Indicators();
      if (destroyed || !chartHostRef.current) return;

      try {
        const widget = createWidget(chartHostRef.current, {
          feed: defaultHonbaFeed,
          symbol: symbol.toUpperCase(),
          exchange: 'NSE',
          interval: normInterval,
          theme: 'dark',
          chartType: initialChartType,
          rail: showRail,
          topbar: false, // Turn off built-in engine topbar to use our sleek OpenAlgo toolbar
          statusline: true,
          panels: false,
          bottombar: false, // Turn off intrusive bottombar
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
    };

    void buildWidget();

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
          setCurrentChartType(targetType);
        }
      } catch {
        // ignore
      }
    }
  }, [chartMode]);

  // Actions
  const handlePickSymbol = (picked: string) => {
    setSymbolSearchOpen(false);
    setSearchQuery('');
    const w = widgetRef.current;
    if (w) {
      try {
        w.setSymbol(picked.toUpperCase(), 'NSE');
        onSymbolChange?.(picked.toUpperCase());
      } catch {
        // ignore
      }
    }
  };

  const handleSelectTimeframe = (tf: string) => {
    const w = widgetRef.current;
    if (w) {
      try {
        w.setInterval(tf.toLowerCase());
        onIntervalChange?.(tf.toLowerCase());
      } catch {
        // ignore
      }
    }
  };

  const handleSelectChartType = (typeId: string) => {
    setChartTypeOpen(false);
    setCurrentChartType(typeId);
    const w = widgetRef.current;
    if (w) {
      try {
        w.setChartType(typeId);
      } catch {
        // ignore
      }
    }
  };

  const handleOpenIndicators = () => {
    const w = widgetRef.current;
    if (w) {
      try {
        w.openIndicatorPicker();
      } catch {
        // ignore
      }
    }
  };

  const handleUndo = () => {
    const w = widgetRef.current;
    if (w && w.draw.canUndo()) {
      w.draw.undo();
    }
  };

  const handleRedo = () => {
    const w = widgetRef.current;
    if (w && w.draw.canRedo()) {
      w.draw.redo();
    }
  };

  const handleClearDrawings = () => {
    const w = widgetRef.current;
    if (w) {
      w.draw.clear();
    }
  };

  const handleScreenshot = () => {
    const w = widgetRef.current;
    if (w) {
      try {
        w.chart.downloadScreenshot();
      } catch {
        // ignore
      }
    }
  };

  const handleToggleFullscreen = () => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen().catch(() => {});
    }
  };

  return (
    <div
      ref={rootRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--bg-app)',
      }}
    >
      {/* OpenAlgo Production Chart Topbar */}
      <div
        style={{
          height: 34,
          minHeight: 34,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 8px',
          background: 'var(--bg-app)',
          borderBottom: '1px solid var(--border-subtle)',
          fontSize: 12,
          gap: 6,
          userSelect: 'none',
          zIndex: 20,
        }}
      >
        {/* Left Section: Symbol, Timeframes, Chart Type, Indicators */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            minWidth: 0,
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          {/* Symbol Search Trigger Button */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setSymbolSearchOpen(!symbolSearchOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                height: 24,
                padding: '0 7px',
                borderRadius: 4,
                border: '1px solid var(--border-subtle)',
                background: symbolSearchOpen ? 'var(--accent-subtle)' : 'var(--bg-surface-elevated)',
                color: symbolSearchOpen ? 'var(--accent-primary)' : 'var(--text-primary)',
                fontWeight: 700,
                fontSize: 11.5,
                cursor: 'pointer',
              }}
              title="Search symbol"
            >
              <Search size={12} style={{ opacity: 0.7 }} />
              <span>{symbol.toUpperCase()}</span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '1px 3px',
                  borderRadius: 2,
                  background: 'var(--border-subtle)',
                  color: 'var(--text-muted)',
                }}
              >
                NSE
              </span>
            </button>

            {/* Symbol Search Dropdown Popover */}
            {symbolSearchOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: 4,
                  width: 250,
                  maxHeight: 280,
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 6,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <div style={{ padding: 6, borderBottom: '1px solid var(--border-subtle)' }}>
                  <input
                    autoFocus
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search NSE symbol..."
                    style={{
                      width: '100%',
                      height: 26,
                      background: 'var(--bg-app)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 4,
                      padding: '0 8px',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                      outline: 'none',
                    }}
                  />
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 4 }}>
                  {filteredSymbols.map((item) => (
                    <div
                      key={item.symbol}
                      onClick={() => handlePickSymbol(item.symbol)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '5px 8px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 11.5,
                        background: item.symbol === symbol.toUpperCase() ? 'var(--accent-subtle)' : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--bg-surface-hover)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = item.symbol === symbol.toUpperCase() ? 'var(--accent-subtle)' : 'transparent';
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.symbol}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.name}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-family-mono)', color: 'var(--text-secondary)' }}>
                        ₹{item.price}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ width: 1, height: 16, background: 'var(--border-subtle)', margin: '0 2px' }} />

          {/* Timeframe Quick Buttons */}
          {TIMEFRAMES.map((tf) => {
            const isActive = timeframe.toLowerCase() === tf;
            return (
              <button
                key={tf}
                onClick={() => handleSelectTimeframe(tf)}
                style={{
                  height: 24,
                  padding: '0 5px',
                  borderRadius: 3,
                  border: 'none',
                  background: isActive ? 'var(--accent-subtle)' : 'transparent',
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 11,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                {tf}
              </button>
            );
          })}

          <div style={{ width: 1, height: 16, background: 'var(--border-subtle)', margin: '0 2px' }} />

          {/* Chart Type Selector Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setChartTypeOpen(!chartTypeOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                height: 24,
                padding: '0 6px',
                borderRadius: 4,
                border: '1px solid transparent',
                background: chartTypeOpen ? 'var(--bg-surface-hover)' : 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Chart type"
            >
              <BarChart3 size={12} />
              <span style={{ textTransform: 'capitalize' }}>
                {CHART_TYPES.find((c) => c.id === currentChartType)?.label ?? 'Candles'}
              </span>
              <ChevronDown size={10} style={{ opacity: 0.6 }} />
            </button>

            {chartTypeOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: 4,
                  width: 140,
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 6,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  zIndex: 100,
                  padding: 4,
                }}
              >
                {CHART_TYPES.map((ct) => (
                  <div
                    key={ct.id}
                    onClick={() => handleSelectChartType(ct.id)}
                    style={{
                      padding: '5px 8px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 11.5,
                      fontWeight: currentChartType === ct.id ? 700 : 500,
                      background: currentChartType === ct.id ? 'var(--accent-subtle)' : 'transparent',
                      color: currentChartType === ct.id ? 'var(--accent-primary)' : 'var(--text-primary)',
                    }}
                  >
                    {ct.label}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ width: 1, height: 16, background: 'var(--border-subtle)', margin: '0 2px' }} />

          {/* Indicators Button */}
          <button
            onClick={handleOpenIndicators}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              height: 24,
              padding: '0 7px',
              borderRadius: 4,
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-surface-elevated)',
              color: 'var(--text-primary)',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title="Open Indicators & Strategies (502)"
          >
            <Layers size={13} style={{ color: 'var(--accent-primary)' }} />
            <span>Indicators</span>
            {activeIndicatorCount > 0 && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '0 4px',
                  borderRadius: 8,
                  background: 'var(--accent-subtle)',
                  color: 'var(--accent-primary)',
                  fontFamily: 'var(--font-family-mono)',
                }}
              >
                {activeIndicatorCount}
              </span>
            )}
          </button>
        </div>

        {/* Right Section: Undo, Redo, Clear, Screenshot, Fullscreen */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            style={{
              width: 24,
              height: 24,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              borderRadius: 4,
              background: 'transparent',
              color: canUndo ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: canUndo ? 'pointer' : 'default',
              opacity: canUndo ? 1 : 0.4,
            }}
            title="Undo drawing (Ctrl+Z)"
          >
            <Undo2 size={13} />
          </button>

          <button
            onClick={handleRedo}
            disabled={!canRedo}
            style={{
              width: 24,
              height: 24,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              borderRadius: 4,
              background: 'transparent',
              color: canRedo ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: canRedo ? 'pointer' : 'default',
              opacity: canRedo ? 1 : 0.4,
            }}
            title="Redo drawing (Ctrl+Y)"
          >
            <Redo2 size={13} />
          </button>

          <button
            onClick={handleClearDrawings}
            style={{
              width: 24,
              height: 24,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              borderRadius: 4,
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
            title="Clear all drawings"
          >
            <Trash2 size={13} />
          </button>

          <div style={{ width: 1, height: 16, background: 'var(--border-subtle)', margin: '0 2px' }} />

          <button
            onClick={handleScreenshot}
            style={{
              width: 24,
              height: 24,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              borderRadius: 4,
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
            title="Download chart screenshot"
          >
            <Camera size={13} />
          </button>

          <button
            onClick={handleToggleFullscreen}
            style={{
              width: 24,
              height: 24,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              borderRadius: 4,
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
            title={isFullscreen ? 'Exit full screen' : 'Full screen'}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* Chart Canvas Container */}
      <div
        ref={chartHostRef}
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          overflow: 'hidden',
        }}
      />
    </div>
  );
};
