import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
  Trash2,
  Camera,
  Maximize2,
  Minimize2,
  Settings2,
  Shapes,
  PenTool,
  ChevronDown,
  Check,
  Copy,
  Download,
  MoreHorizontal,
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

const COMMON_TIMEFRAMES = ['1m', '5m', '15m', '1h', '1d', '1w'] as const;

const INTERVAL_GROUPS = [
  { label: 'Minutes', items: ['1m', '3m', '5m', '15m', '30m', '45m'] },
  { label: 'Hours', items: ['1h', '2h', '3h', '4h'] },
  { label: 'Days & Weeks', items: ['1d', '1w', '1M'] },
];

interface ChartTypeOption {
  id: string;
  label: string;
  group: 'Candles & Bars' | 'Lines & Areas' | 'Movement & Exotics';
}

const CHART_TYPES: ChartTypeOption[] = [
  { id: 'candlestick', label: 'Candles', group: 'Candles & Bars' },
  { id: 'bar', label: 'Bars (OHLC)', group: 'Candles & Bars' },
  { id: 'hollow-candle', label: 'Hollow Candles', group: 'Candles & Bars' },
  { id: 'heikin-ashi', label: 'Heikin Ashi', group: 'Candles & Bars' },
  { id: 'area', label: 'Area', group: 'Lines & Areas' },
  { id: 'line', label: 'Line', group: 'Lines & Areas' },
  { id: 'step', label: 'Step', group: 'Lines & Areas' },
  { id: 'baseline', label: 'Baseline', group: 'Lines & Areas' },
  { id: 'renko', label: 'Renko', group: 'Movement & Exotics' },
  { id: 'point-figure', label: 'Point & Figure', group: 'Movement & Exotics' },
  { id: 'kagi', label: 'Kagi', group: 'Movement & Exotics' },
];

/**
 * Reusable portaled popover dropdown that renders directly onto document.body
 * with fixed positioning, ensuring it is NEVER clipped by parent overflow or grid bounds.
 */
interface FloatingDropdownProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  width?: number | string;
  minWidth?: number | string;
  align?: 'left' | 'right';
  style?: React.CSSProperties;
}

const FloatingDropdown: React.FC<FloatingDropdownProps> = ({
  open,
  onClose,
  anchorRef,
  children,
  width,
  minWidth,
  align = 'left',
  style,
}) => {
  if (!open || typeof document === 'undefined') return null;

  const rect = anchorRef.current?.getBoundingClientRect();
  const top = rect ? rect.bottom + 4 : 40;
  let left: number | undefined;
  let right: number | undefined;

  const numericWidth = typeof width === 'number' ? width : 200;

  if (align === 'right' && rect) {
    right = Math.max(8, window.innerWidth - rect.right);
  } else if (rect) {
    left = Math.max(8, Math.min(rect.left, window.innerWidth - numericWidth - 8));
  }

  return createPortal(
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99998,
          background: 'transparent',
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />
      <div
        style={{
          position: 'fixed',
          top,
          ...(left !== undefined ? { left } : {}),
          ...(right !== undefined ? { right } : {}),
          ...(width !== undefined ? { width } : {}),
          ...(minWidth !== undefined ? { minWidth } : {}),
          maxHeight: 'calc(100vh - ' + (top + 16) + 'px)',
          background: 'var(--bg-surface-elevated, #1e222d)',
          border: '1px solid var(--border-medium, #2a2e39)',
          borderRadius: 6,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.65)',
          zIndex: 99999,
          overflowY: 'auto',
          color: 'var(--text-primary, #d1d4dc)',
          fontSize: 12,
          padding: 4,
          ...style,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>,
    document.body
  );
};

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

  // Measure container width for responsive compact multi-grid rendering
  const [containerWidth, setContainerWidth] = useState<number>(800);
  useEffect(() => {
    if (!rootRef.current) return;
    const el = rootRef.current;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(el);
    setContainerWidth(el.getBoundingClientRect().width || 800);
    return () => observer.disconnect();
  }, []);

  const isUltraCompact = containerWidth < 460;
  const isCompact = containerWidth < 700;

  const [isReady, setIsReady] = useState(false);
  const [railVisible, setRailVisible] = useState(showRail);
  const [currentChartType, setCurrentChartType] = useState<string>(chartMode === 'area' ? 'area' : 'candlestick');
  const [activeIndicatorCount, setActiveIndicatorCount] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Popover anchors and states
  const [symbolSearchOpen, setSymbolSearchOpen] = useState(false);
  const symbolBtnRef = useRef<HTMLButtonElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [timeframeMenuOpen, setTimeframeMenuOpen] = useState(false);
  const timeframeBtnRef = useRef<HTMLButtonElement>(null);

  const [chartTypeOpen, setChartTypeOpen] = useState(false);
  const chartTypeBtnRef = useRef<HTMLButtonElement>(null);

  const [snapshotMenuOpen, setSnapshotMenuOpen] = useState(false);
  const snapshotBtnRef = useRef<HTMLButtonElement>(null);

  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreBtnRef = useRef<HTMLButtonElement>(null);

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

  // Poll undo/redo and active indicators count
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

  // Manage Drawing Rail visibility
  useEffect(() => {
    const widget = widgetRef.current;
    if (!widget || !isReady) return;
    try {
      const railEl = widget.root.querySelector<HTMLElement>('.oac-rail');
      if (railEl) {
        railEl.style.display = railVisible ? '' : 'none';
      }
    } catch {
      // ignore
    }
  }, [railVisible, isReady]);

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
          topbar: false, // Replicated clean OpenAlgo toolbar
          statusline: true,
          panels: false,
          bottombar: false,
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
    setTimeframeMenuOpen(false);
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

  const handleOpenSettings = () => {
    const w = widgetRef.current;
    if (w) {
      try {
        w.openSettings();
      } catch {
        // ignore
      }
    }
  };

  const handleOpenObjects = () => {
    const w = widgetRef.current;
    if (w) {
      try {
        w.openObjects();
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

  const handleDownloadScreenshot = () => {
    setSnapshotMenuOpen(false);
    const w = widgetRef.current;
    if (w) {
      try {
        w.chart.downloadScreenshot();
      } catch {
        // ignore
      }
    }
  };

  const handleCopyScreenshot = async () => {
    setSnapshotMenuOpen(false);
    const w = widgetRef.current;
    if (!w) return;
    try {
      const canvas = w.chart.takeScreenshot();
      if (!canvas) return;
      canvas.toBlob(async (blob) => {
        if (blob && navigator.clipboard?.write) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2000);
        }
      }, 'image/png');
    } catch {
      // ignore
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

  const currentChartTypeObj = CHART_TYPES.find((c) => c.id === currentChartType) ?? CHART_TYPES[0];

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
      {/* OpenAlgo Production Chart Topbar with Responsive Multi-grid Adaptations */}
      <div
        style={{
          height: 32,
          minHeight: 32,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 6px',
          background: 'var(--bg-app)',
          borderBottom: '1px solid var(--border-subtle)',
          fontSize: 12,
          gap: 4,
          userSelect: 'none',
          zIndex: 20,
        }}
      >
        {/* Left Section: Symbol, Timeframes, Chart Type, Indicators */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            minWidth: 0,
            flexShrink: 1,
          }}
        >
          {/* Symbol Search Trigger Button */}
          <button
            ref={symbolBtnRef}
            onClick={() => setSymbolSearchOpen(!symbolSearchOpen)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              height: 23,
              padding: isUltraCompact ? '0 5px' : '0 6px',
              borderRadius: 4,
              border: '1px solid var(--border-subtle)',
              background: symbolSearchOpen ? 'var(--accent-subtle)' : 'var(--bg-surface-elevated)',
              color: symbolSearchOpen ? 'var(--accent-primary)' : 'var(--text-primary)',
              fontWeight: 700,
              fontSize: 11,
              cursor: 'pointer',
              flexShrink: 0,
            }}
            title="Search symbol"
          >
            <Search size={11} style={{ opacity: 0.7 }} />
            <span
              style={{
                maxWidth: isUltraCompact ? 60 : isCompact ? 85 : 120,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {symbol.toUpperCase()}
            </span>
            {!isUltraCompact && (
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
            )}
          </button>

          {/* Timeframe Selector: Dropdown in Compact mode, Quick Pills in Wide mode */}
          {isCompact ? (
            <button
              ref={timeframeBtnRef}
              onClick={() => setTimeframeMenuOpen(!timeframeMenuOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                height: 23,
                padding: '0 5px',
                borderRadius: 4,
                border: '1px solid var(--border-subtle)',
                background: timeframeMenuOpen ? 'var(--accent-subtle)' : 'transparent',
                color: timeframeMenuOpen ? 'var(--accent-primary)' : 'var(--text-primary)',
                fontWeight: 700,
                fontSize: 11,
                cursor: 'pointer',
                textTransform: 'uppercase',
                flexShrink: 0,
              }}
              title="Change timeframe"
            >
              <span>{timeframe}</span>
              <ChevronDown size={10} style={{ opacity: 0.6 }} />
            </button>
          ) : (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
              {COMMON_TIMEFRAMES.map((tf) => {
                const isActive = timeframe.toLowerCase() === tf;
                return (
                  <button
                    key={tf}
                    onClick={() => handleSelectTimeframe(tf)}
                    style={{
                      height: 22,
                      padding: '0 4px',
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
              <button
                ref={timeframeBtnRef}
                onClick={() => setTimeframeMenuOpen(!timeframeMenuOpen)}
                style={{
                  height: 22,
                  padding: '0 2px',
                  borderRadius: 3,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
                title="More timeframes"
              >
                <ChevronDown size={10} />
              </button>
            </div>
          )}

          <div style={{ width: 1, height: 14, background: 'var(--border-subtle)', margin: '0 1px', flexShrink: 0 }} />

          {/* Chart Type Selector Dropdown */}
          <button
            ref={chartTypeBtnRef}
            onClick={() => setChartTypeOpen(!chartTypeOpen)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              height: 23,
              padding: isCompact ? '0 4px' : '0 6px',
              borderRadius: 4,
              border: '1px solid transparent',
              background: chartTypeOpen ? 'var(--bg-surface-hover)' : 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              flexShrink: 0,
            }}
            title={`Chart type: ${currentChartTypeObj.label}`}
          >
            <BarChart3 size={12} />
            {!isCompact && (
              <span style={{ textTransform: 'capitalize' }}>
                {currentChartTypeObj.label}
              </span>
            )}
            <ChevronDown size={10} style={{ opacity: 0.6 }} />
          </button>

          <div style={{ width: 1, height: 14, background: 'var(--border-subtle)', margin: '0 1px', flexShrink: 0 }} />

          {/* Indicators Button */}
          <button
            onClick={handleOpenIndicators}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              height: 23,
              padding: isUltraCompact ? '0 4px' : '0 6px',
              borderRadius: 4,
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-surface-elevated)',
              color: 'var(--text-primary)',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              flexShrink: 0,
            }}
            title="Open Indicators & Strategies (502 indicators across 16 categories)"
          >
            <Layers size={12} style={{ color: 'var(--accent-primary)' }} />
            {!isCompact && <span>Indicators</span>}
            {activeIndicatorCount > 0 && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '0 4px',
                  borderRadius: 6,
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

        {/* Right Section: All OpenAlgo native tools (LED, Undo/Redo, Rail, Objects, Settings, Snapshot, Fullscreen) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexShrink: 0,
          }}
        >
          {/* Live Feed Status LED */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '0 4px',
              height: 20,
              fontSize: 10,
              color: 'var(--text-muted)',
            }}
            title="Real-time market feed active"
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 6px rgba(16, 185, 129, 0.8)',
                display: 'inline-block',
              }}
            />
            {!isCompact && <span style={{ fontWeight: 600, fontSize: 10 }}>Live</span>}
          </div>

          <div style={{ width: 1, height: 14, background: 'var(--border-subtle)', margin: '0 1px' }} />

          {/* Wide / Normal mode controls */}
          {!isUltraCompact && (
            <>
              {/* Drawing Undo */}
              <button
                onClick={handleUndo}
                disabled={!canUndo}
                style={{
                  width: 22,
                  height: 22,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  borderRadius: 3,
                  background: 'transparent',
                  color: canUndo ? 'var(--text-primary)' : 'var(--text-muted)',
                  cursor: canUndo ? 'pointer' : 'default',
                  opacity: canUndo ? 1 : 0.35,
                }}
                title="Undo drawing (Ctrl+Z)"
              >
                <Undo2 size={12} />
              </button>

              {/* Drawing Redo */}
              <button
                onClick={handleRedo}
                disabled={!canRedo}
                style={{
                  width: 22,
                  height: 22,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  borderRadius: 3,
                  background: 'transparent',
                  color: canRedo ? 'var(--text-primary)' : 'var(--text-muted)',
                  cursor: canRedo ? 'pointer' : 'default',
                  opacity: canRedo ? 1 : 0.35,
                }}
                title="Redo drawing (Ctrl+Y)"
              >
                <Redo2 size={12} />
              </button>

              {/* Drawing Rail Toggle */}
              <button
                onClick={() => setRailVisible(!railVisible)}
                style={{
                  width: 22,
                  height: 22,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  borderRadius: 3,
                  background: railVisible ? 'var(--accent-subtle)' : 'transparent',
                  color: railVisible ? 'var(--accent-primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
                title={railVisible ? 'Hide drawing toolbar' : 'Show drawing toolbar'}
              >
                <PenTool size={11} />
              </button>

              <div style={{ width: 1, height: 14, background: 'var(--border-subtle)', margin: '0 1px' }} />
            </>
          )}

          {/* Objects Tree (drawings and indicators manager) */}
          <button
            onClick={handleOpenObjects}
            style={{
              width: 22,
              height: 22,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              borderRadius: 3,
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
            title="Manage chart objects & drawings"
          >
            <Shapes size={12} />
          </button>

          {/* Chart Settings */}
          <button
            onClick={handleOpenSettings}
            style={{
              width: 22,
              height: 22,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              borderRadius: 3,
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
            title="Chart settings (scales, background, statusline)"
          >
            <Settings2 size={12} />
          </button>

          {/* Snapshot / Camera Dropdown */}
          <button
            ref={snapshotBtnRef}
            onClick={() => setSnapshotMenuOpen(!snapshotMenuOpen)}
            style={{
              width: 22,
              height: 22,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              borderRadius: 3,
              background: snapshotMenuOpen ? 'var(--bg-surface-hover)' : 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
            title="Take chart screenshot"
          >
            <Camera size={12} />
          </button>

          {/* Ultra-compact More menu for overflow items */}
          {isUltraCompact && (
            <button
              ref={moreBtnRef}
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              style={{
                width: 22,
                height: 22,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                borderRadius: 3,
                background: moreMenuOpen ? 'var(--bg-surface-hover)' : 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
              title="More actions"
            >
              <MoreHorizontal size={12} />
            </button>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={handleToggleFullscreen}
            style={{
              width: 22,
              height: 22,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              borderRadius: 3,
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen chart'}
          >
            {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>

      {/* PORTALED FLOATING DROPDOWNS: NEVER CLIPPED BY OVERFLOW */}

      {/* 1. Symbol Search Dropdown */}
      <FloatingDropdown
        open={symbolSearchOpen}
        onClose={() => setSymbolSearchOpen(false)}
        anchorRef={symbolBtnRef}
        width={260}
      >
        <div style={{ padding: 4, borderBottom: '1px solid var(--border-subtle)' }}>
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
              fontSize: 11.5,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ maxHeight: 240, overflowY: 'auto', padding: '4px 2px' }}>
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
      </FloatingDropdown>

      {/* 2. Timeframe Selector Dropdown */}
      <FloatingDropdown
        open={timeframeMenuOpen}
        onClose={() => setTimeframeMenuOpen(false)}
        anchorRef={timeframeBtnRef}
        width={180}
      >
        {INTERVAL_GROUPS.map((grp, gi) => (
          <div key={grp.label} style={{ padding: '2px 0' }}>
            {gi > 0 && <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />}
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                padding: '2px 8px',
                letterSpacing: '0.05em',
              }}
            >
              {grp.label}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, padding: '2px 4px' }}>
              {grp.items.map((tf) => {
                const isActive = timeframe.toLowerCase() === tf.toLowerCase();
                return (
                  <div
                    key={tf}
                    onClick={() => handleSelectTimeframe(tf)}
                    style={{
                      padding: '4px 0',
                      textAlign: 'center',
                      borderRadius: 3,
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: isActive ? 700 : 500,
                      background: isActive ? 'var(--accent-subtle)' : 'transparent',
                      color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)',
                      textTransform: 'uppercase',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'var(--bg-surface-hover)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {tf}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </FloatingDropdown>

      {/* 3. Candles / Chart Type Selector Dropdown */}
      <FloatingDropdown
        open={chartTypeOpen}
        onClose={() => setChartTypeOpen(false)}
        anchorRef={chartTypeBtnRef}
        width={190}
      >
        {['Candles & Bars', 'Lines & Areas', 'Movement & Exotics'].map((grp, gi) => {
          const items = CHART_TYPES.filter((c) => c.group === grp);
          return (
            <div key={grp} style={{ padding: '2px 0' }}>
              {gi > 0 && <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />}
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  letterSpacing: '0.05em',
                }}
              >
                {grp}
              </div>
              {items.map((ct) => {
                const isSelected = currentChartType === ct.id;
                return (
                  <div
                    key={ct.id}
                    onClick={() => handleSelectChartType(ct.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 11.5,
                      fontWeight: isSelected ? 700 : 500,
                      background: isSelected ? 'var(--accent-subtle)' : 'transparent',
                      color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'var(--bg-surface-hover)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span>{ct.label}</span>
                    {isSelected && <Check size={12} style={{ color: 'var(--accent-primary)' }} />}
                  </div>
                );
              })}
            </div>
          );
        })}
      </FloatingDropdown>

      {/* 4. Snapshot / Camera Dropdown */}
      <FloatingDropdown
        open={snapshotMenuOpen}
        onClose={() => setSnapshotMenuOpen(false)}
        anchorRef={snapshotBtnRef}
        align="right"
        width={170}
      >
        <div
          onClick={handleDownloadScreenshot}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 8px',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 11.5,
            color: 'var(--text-primary)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Download size={13} style={{ opacity: 0.7 }} />
          <span>Download Image</span>
        </div>
        <div
          onClick={handleCopyScreenshot}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 8px',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 11.5,
            color: 'var(--text-primary)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Copy size={13} style={{ opacity: 0.7 }} />
          <span>{copySuccess ? 'Copied to Clipboard!' : 'Copy to Clipboard'}</span>
        </div>
      </FloatingDropdown>

      {/* 5. Ultra-compact Overflow More Menu */}
      <FloatingDropdown
        open={moreMenuOpen}
        onClose={() => setMoreMenuOpen(false)}
        anchorRef={moreBtnRef}
        align="right"
        width={160}
      >
        <div
          onClick={() => {
            setMoreMenuOpen(false);
            handleUndo();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 8px',
            borderRadius: 4,
            cursor: canUndo ? 'pointer' : 'default',
            fontSize: 11.5,
            opacity: canUndo ? 1 : 0.4,
            color: 'var(--text-primary)',
          }}
          onMouseEnter={(e) => {
            if (canUndo) e.currentTarget.style.background = 'var(--bg-surface-hover)';
          }}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Undo2 size={13} />
          <span>Undo Drawing</span>
        </div>
        <div
          onClick={() => {
            setMoreMenuOpen(false);
            handleRedo();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 8px',
            borderRadius: 4,
            cursor: canRedo ? 'pointer' : 'default',
            fontSize: 11.5,
            opacity: canRedo ? 1 : 0.4,
            color: 'var(--text-primary)',
          }}
          onMouseEnter={(e) => {
            if (canRedo) e.currentTarget.style.background = 'var(--bg-surface-hover)';
          }}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Redo2 size={13} />
          <span>Redo Drawing</span>
        </div>
        <div
          onClick={() => {
            setMoreMenuOpen(false);
            setRailVisible(!railVisible);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 8px',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 11.5,
            color: 'var(--text-primary)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <PenTool size={13} />
          <span>{railVisible ? 'Hide Drawing Rail' : 'Show Drawing Rail'}</span>
        </div>
        <div
          onClick={() => {
            setMoreMenuOpen(false);
            handleClearDrawings();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 8px',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 11.5,
            color: 'var(--color-loss, #f43f5e)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Trash2 size={13} />
          <span>Clear All Drawings</span>
        </div>
      </FloatingDropdown>

      {/* Chart Canvas Area */}
      <div
        ref={chartHostRef}
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          overflow: 'hidden',
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
};
