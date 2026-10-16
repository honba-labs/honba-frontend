import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BuySellButtons, type SeriesApi } from 'openalgo-charts';
import {
  createWidget,
  registerWidgetDialog,
  registerWidgetDialogs,
  injectWidgetStyles,
  WIDGET_DIALOGS,
  WIDGET_COMPONENT_CSS,
  type Widget,
} from 'openalgo-charts/widget';
import { buildHonbaChartTheme, subscribeHonbaTheme } from '../../../core/workbench/chart-theme';
import { useWorkbenchStore } from '../../../core/workbench/store';
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
import { loadAll502Indicators } from '../../../core/indicators/loader';
import { mountCustomIndicatorPicker } from './indicator-picker-dialog';
import { SymbolSearchModal } from './symbol-search-modal';
import { resolveSymbolMetadata } from '../../../core/symbol-search';

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

interface BubbleBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function getBuySellBubbleBounds(tradeBtns: any, chart: any, paneIndex: number): BubbleBounds | null {
  const sell = tradeBtns?._sellRect;
  const buy = tradeBtns?._buyRect;
  if (sell && buy) {
    return {
      left: sell.x,
      top: sell.y,
      right: buy.x + buy.w,
      bottom: sell.y + sell.h,
    };
  }
  const rect = chart?.plotRect?.(paneIndex);
  if (rect && typeof tradeBtns?._origin === 'function' && typeof tradeBtns?._h === 'number') {
    const o = tradeBtns._origin(rect.width, rect.height);
    return {
      left: o.x,
      top: o.y,
      right: o.x + o.w,
      bottom: o.y + tradeBtns._h,
    };
  }
  return null;
}

function intersectSegmentWithBox(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  box: BubbleBounds
): { x: number; y: number } {
  const dx = x1 - x0;
  const dy = y1 - y0;
  let tMin = 0;
  let tMax = 1;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > tMax) return false;
      if (t > tMin) tMin = t;
    } else {
      if (t < tMin) return false;
      if (t < tMax) tMax = t;
    }
    return true;
  };
  if (
    clip(-dx, x0 - box.left) &&
    clip(dx, box.right - x0) &&
    clip(-dy, y0 - box.top) &&
    clip(dy, box.bottom - y0)
  ) {
    return {
      x: x0 + dx * tMin,
      y: y0 + dy * tMin,
    };
  }
  return { x: x0, y: y0 };
}

/**
 * Freezes chart crosshair & OHLC statusline readout when the pointer moves inside
 * the Buy/Sell bubble's boundary, and resumes tracking as soon as the pointer
 * moves outside of the bubble's boundary.
 */
function attachBuySellBubbleCursorFreeze(chart: any, tradeBtns: BuySellButtons): void {
  const tb = tradeBtns as any;
  if (typeof tb.hitTest === 'function') {
    const origHitTest = tb.hitTest.bind(tb);
    tb.hitTest = (plotX: number, localY: number, rc: any) => {
      const hit = origHitTest(plotX, localY, rc);
      if (hit) return hit;
      const primaryPane = typeof chart.primaryPaneIndex === 'function' ? chart.primaryPaneIndex() : 0;
      const bounds = getBuySellBubbleBounds(tb, chart, primaryPane);
      if (
        bounds &&
        plotX >= bounds.left &&
        plotX <= bounds.right &&
        localY >= bounds.top &&
        localY <= bounds.bottom
      ) {
        return {
          externalId: `${tb._id ?? 'trade'}:qty`,
          zOrder: 'top' as const,
          distance: 0,
          cursor: 'pointer',
        };
      }
      return null;
    };
  }

  const input = chart?._input;
  if (!input || typeof input._updateCursor !== 'function') return;

  let wasInsideBubble = false;
  let lastOutsidePoint: { pane: number; plotX: number; localY: number } | null = null;

  const isPointInBubble = (pane: number, x: number, localY: number): { inside: boolean; bounds: BubbleBounds | null; plotX: number; leftAxisWidth: number } => {
    const leftAxisWidth = chart._leftAxisWidth ?? 0;
    const plotX = x - leftAxisWidth;
    const primaryPane = typeof chart.primaryPaneIndex === 'function' ? chart.primaryPaneIndex() : 0;
    if (pane !== primaryPane) {
      return { inside: false, bounds: null, plotX, leftAxisWidth };
    }
    const bounds = getBuySellBubbleBounds(tb, chart, pane);
    const inside =
      bounds !== null &&
      plotX >= bounds.left &&
      plotX <= bounds.right &&
      localY >= bounds.top &&
      localY <= bounds.bottom;
    return { inside, bounds, plotX, leftAxisWidth };
  };

  const origUpdateCursor = input._updateCursor.bind(input);
  input._updateCursor = function (pane: number, x: number, localY: number, y: number, event: PointerEvent) {
    const { inside, bounds, plotX, leftAxisWidth } = isPointInBubble(pane, x, localY);

    if (inside && bounds) {
      if (!wasInsideBubble && lastOutsidePoint !== null && lastOutsidePoint.pane === pane) {
        const entry = intersectSegmentWithBox(
          lastOutsidePoint.plotX,
          lastOutsidePoint.localY,
          plotX,
          localY,
          bounds
        );
        const paneTop = y - localY;
        origUpdateCursor(
          pane,
          leftAxisWidth + entry.x,
          entry.y,
          paneTop + entry.y,
          event
        );
      }
      wasInsideBubble = true;
      const hit = this._hitAt?.(pane, x, localY) ?? null;
      this._setHover?.(hit);
      this._host?._feedTimeNav?.(null);
      return;
    }

    wasInsideBubble = false;
    lastOutsidePoint = { pane, plotX, localY };
    origUpdateCursor(pane, x, localY, y, event);
  };

  if (typeof input._onPointerDown === 'function') {
    const origOnPointerDown = input._onPointerDown.bind(input);
    input._onPointerDown = function (event: PointerEvent) {
      origOnPointerDown(event);
      const pt = this._localPoint?.(event);
      if (pt) {
        const { inside } = isPointInBubble(pt.pane, pt.x, pt.localY);
        if (inside) {
          this._dragging = false;
        }
      }
    };
  }

  if (typeof input._onPointerLeave === 'function') {
    const origOnPointerLeave = input._onPointerLeave.bind(input);
    input._onPointerLeave = function () {
      wasInsideBubble = false;
      lastOutsidePoint = null;
      origOnPointerLeave();
    };
  }
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const SHORT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const IST_OFFSET_SEC = 19800; // UTC+5:30

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function getDateParts(utcSec: number, tz?: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
} {
  if (!tz || tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta') {
    const d = new Date((utcSec + IST_OFFSET_SEC) * 1000);
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      hour: d.getUTCHours(),
      minute: d.getUTCMinutes(),
      second: d.getUTCSeconds(),
      weekday: d.getUTCDay(),
    };
  }
  const d = new Date(utcSec * 1000);
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
    second: d.getSeconds(),
    weekday: d.getDay(),
  };
}

/**
 * Ensures the Buy/Sell bubble renders on top of all dotted lines (crosshair & last-price line)
 * by repainting it at the end of the pane's top overlay pass.
 */
function ensureBuySellBubbleOnTop(chart: any, tradeBtns: BuySellButtons): void {
  const panes: any[] = chart?._panes;
  if (!Array.isArray(panes)) return;

  for (const pane of panes) {
    if (!pane || pane.__honbaBubbleTopPatched || typeof pane.paintTop !== 'function') continue;
    pane.__honbaBubbleTopPatched = true;
    const origPaintTop = pane.paintTop.bind(pane);
    pane.paintTop = function (cursor: any, rc: any, targetCtx?: CanvasRenderingContext2D) {
      origPaintTop(cursor, rc, targetCtx);
      try {
        const live = typeof this._live === 'function' ? this._live(rc) : this._primitives;
        if (!Array.isArray(live) || !live.includes(tradeBtns)) return;
        const ctx: CanvasRenderingContext2D | undefined = targetCtx ?? this.top?.ctx;
        if (!ctx) return;
        const layout = typeof this._layout === 'function' ? this._layout(rc) : { plotLeft: 0 };
        const dpr = rc?.dpr ?? 1;
        ctx.save();
        if (layout.plotLeft > 0) {
          ctx.translate(Math.round(layout.plotLeft * dpr), 0);
        }
        const primCtx = typeof this._primitiveContext === 'function' ? this._primitiveContext(rc) : rc;
        const boundCtx =
          typeof this._boundPrimitiveContext === 'function'
            ? this._boundPrimitiveContext(tradeBtns, primCtx, rc)
            : primCtx;
        tradeBtns.draw(ctx, boundCtx);
        ctx.restore();
      } catch {
        // ignore
      }
    };
  }
}

/**
 * TradingView-style compact timeline formatter:
 * Shows the month name only on the first and last visible ticks of each month
 * (e.g. '02Jul', then '05', '07', ... until the month ends with '31Jul'),
 * saving horizontal real estate and increasing visibility.
 */
function paintTradingViewTimeAxis(
  ctx: CanvasRenderingContext2D,
  pane: any,
  rc: any,
  tz: string
): void {
  const ts = rc?.timeScale;
  const dl = rc?.dataLayer;
  if (!ts || !dl || typeof ts.visibleRange !== "function") return;

  const layout = typeof pane._layout === "function" ? pane._layout(rc) : null;
  if (!layout || layout.plotWidth <= 0) return;

  const dpr = rc.dpr ?? 1;
  const vr = ts.visibleRange();
  const fromIdx = Math.max(0, Math.floor(vr.from));
  const toIdx = Math.min(dl.baseIndex ?? 0, Math.ceil(vr.to));
  if (toIdx < fromIdx) return;

  const barSpacing = Math.max(1, ts.barSpacing || 6);
  const step = Math.max(1, Math.round(72 / barSpacing));
  const axisTopY = Math.round(layout.plotHeight * dpr);
  const plotWidthPx = Math.round(layout.plotWidth * dpr);

  // Detect whether bars are intraday or daily+
  let minBarStepSec = Number.POSITIVE_INFINITY;
  let prevBarSec = dl.indexToTime(fromIdx);
  for (let i = fromIdx + 1; i <= toIdx; i++) {
    const sec = dl.indexToTime(i);
    if (sec !== undefined && prevBarSec !== undefined && sec > prevBarSec) {
      minBarStepSec = Math.min(minBarStepSec, sec - prevBarSec);
    }
    if (sec !== undefined) prevBarSec = sec;
  }
  const isIntraday = Number.isFinite(minBarStepSec) && minBarStepSec < 86400;
  const showSeconds = Number.isFinite(minBarStepSec * step) && minBarStepSec * step < 60;

  const fontSize = Math.max(
    10,
    Math.min(14, Math.round(rc.canvasOptions?.scales?.fontSize ?? rc.theme?.axisFontSize ?? 11))
  );
  const textColor = rc.canvasOptions?.scales?.textColor ?? rc.theme?.axisText ?? "#8b91a7";
  const lineColor = rc.canvasOptions?.scales?.lineColor ?? rc.theme?.axisLine ?? "#2a3046";
  const regularFont = `${fontSize * dpr}px system-ui, sans-serif`;
  const boldFont = `600 ${fontSize * dpr}px system-ui, sans-serif`;

  ctx.save();
  if (layout.plotLeft > 0) {
    ctx.translate(Math.round(layout.plotLeft * dpr), 0);
  }
  ctx.fillStyle = textColor;
  ctx.strokeStyle = lineColor;
  ctx.font = regularFont;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.lineWidth = 1;

  // Axis top border line
  ctx.beginPath();
  ctx.moveTo(0, axisTopY + 0.5);
  ctx.lineTo(plotWidthPx, axisTopY + 0.5);
  ctx.stroke();

  interface AxisTick {
    idx: number;
    x: number;
    text: string;
    half: number;
    priority: number; // 3 = year, 2 = month, 1 = day (on intraday), 0 = equal-interval sub-tick
  }

  const candidates: AxisTick[] = [];
  const addedIndices = new Set<number>();

  const pushTick = (idx: number, text: string, priority: number) => {
    if (addedIndices.has(idx)) return;
    const x = Math.round(ts.indexToX(idx) * dpr);
    if (x < 12 * dpr || x > plotWidthPx - 12 * dpr) return;
    ctx.font = priority >= 2 ? boldFont : regularFont;
    const half = ctx.measureText(text).width / 2;
    candidates.push({ idx, x, text, half, priority });
    addedIndices.add(idx);
  };

  if (!isIntraday) {
    // 1. Collect all visible bars with their date parts and group by month
    const monthGroups = new Map<string, { firstIdx: number; indices: number[]; parts: ReturnType<typeof getDateParts> }>();
    let prevParts: ReturnType<typeof getDateParts> | null = null;
    const prevStartSec = fromIdx > 0 ? dl.indexToTime(fromIdx - 1) : undefined;
    if (prevStartSec !== undefined) {
      prevParts = getDateParts(prevStartSec, tz);
    }

    for (let i = fromIdx; i <= toIdx; i++) {
      const sec = dl.indexToTime(i);
      if (sec === undefined) continue;
      const p = getDateParts(sec, tz);
      const mKey = `${p.year}-${p.month}`;
      let grp = monthGroups.get(mKey);
      if (!grp) {
        grp = { firstIdx: i, indices: [], parts: p };
        monthGroups.set(mKey, grp);
      }
      grp.indices.push(i);

      // Month / Year transition boundary -> TradingView shows just the month name ("Jul", "Aug") or year ("2026")
      if (prevParts && (p.year !== prevParts.year || p.month !== prevParts.month)) {
        if (p.year !== prevParts.year && p.month === 1) {
          pushTick(i, String(p.year), 3);
        } else {
          pushTick(i, SHORT_MONTHS[p.month - 1], 2);
        }
      } else if (i === fromIdx && !prevParts) {
        pushTick(i, SHORT_MONTHS[p.month - 1], 2);
      }
      prevParts = p;
    }

    // 2. Within each month, if zoomed in enough that the month spans more than ~90px,
    // equally divide the month space into N equal segments and place day numbers (e.g. 8, 15, 22)
    const targetSubTickPx = 76 * dpr;
    for (const grp of monthGroups.values()) {
      const idxs = grp.indices;
      if (idxs.length < 2) continue;
      const startX = ts.indexToX(idxs[0]) * dpr;
      const endX = ts.indexToX(idxs[idxs.length - 1]) * dpr;
      const spanPx = endX - startX;
      const segments = Math.floor(spanPx / targetSubTickPx);
      if (segments >= 2) {
        for (let s = 1; s < segments; s++) {
          const pos = Math.round((s * (idxs.length - 1)) / segments);
          const barIdx = idxs[pos];
          const sec = dl.indexToTime(barIdx);
          if (sec === undefined) continue;
          const p = getDateParts(sec, tz);
          pushTick(barIdx, String(p.day), 0);
        }
      }
    }
  } else {
    // Intraday: group by day, show month name on month transitions, day number on day transitions,
    // and equally divide each day into time ticks (HH:mm)
    const dayGroups = new Map<string, number[]>();
    let prevParts: ReturnType<typeof getDateParts> | null = null;
    const prevStartSec = fromIdx > 0 ? dl.indexToTime(fromIdx - 1) : undefined;
    if (prevStartSec !== undefined) {
      prevParts = getDateParts(prevStartSec, tz);
    }

    for (let i = fromIdx; i <= toIdx; i++) {
      const sec = dl.indexToTime(i);
      if (sec === undefined) continue;
      const p = getDateParts(sec, tz);
      const dKey = `${p.year}-${p.month}-${p.day}`;
      let grp = dayGroups.get(dKey);
      if (!grp) {
        grp = [];
        dayGroups.set(dKey, grp);
      }
      grp.push(i);

      if (prevParts) {
        if (p.year !== prevParts.year || p.month !== prevParts.month) {
          pushTick(i, SHORT_MONTHS[p.month - 1], 2);
        } else if (p.day !== prevParts.day) {
          pushTick(i, String(p.day), 1);
        }
      } else if (i === fromIdx) {
        pushTick(i, `${p.day} ${SHORT_MONTHS[p.month - 1]}`, 2);
      }
      prevParts = p;
    }

    const targetTimeTickPx = 80 * dpr;
    for (const idxs of dayGroups.values()) {
      if (idxs.length < 2) continue;
      const startX = ts.indexToX(idxs[0]) * dpr;
      const endX = ts.indexToX(idxs[idxs.length - 1]) * dpr;
      const spanPx = endX - startX;
      const segments = Math.floor(spanPx / targetTimeTickPx);
      if (segments >= 2) {
        for (let s = 1; s < segments; s++) {
          const pos = Math.round((s * (idxs.length - 1)) / segments);
          const barIdx = idxs[pos];
          const sec = dl.indexToTime(barIdx);
          if (sec === undefined) continue;
          const p = getDateParts(sec, tz);
          const timeLabel = showSeconds
            ? `${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}`
            : `${pad2(p.hour)}:${pad2(p.minute)}`;
          pushTick(barIdx, timeLabel, 0);
        }
      }
    }
  }

  // Sort by priority descending (Year > Month > Day > Sub-tick), then x ascending
  const byPriority = [...candidates].sort((a, b) => b.priority - a.priority || a.x - b.x);
  const minGap = 14 * dpr;
  const accepted: AxisTick[] = [];

  for (const cand of byPriority) {
    const fits = accepted.every(
      (other) =>
        cand.x + cand.half + minGap <= other.x - other.half ||
        cand.x - cand.half - minGap >= other.x + other.half
    );
    if (fits) accepted.push(cand);
  }

  accepted.sort((a, b) => a.x - b.x);

  for (const tk of accepted) {
    ctx.font = tk.priority >= 2 ? boldFont : regularFont;
    ctx.fillText(tk.text, tk.x, axisTopY + 4 * dpr);
  }

  ctx.restore();
}

function attachTradingViewTimeFormatter(chart: any): void {
  if (!chart) return;

  // 1. Set crosshair time tag formatter
  if (typeof chart.setTimeFormatter === "function") {
    chart.setTimeFormatter((utcSeconds: number) => {
      const tz = typeof chart.timezone === "function" ? chart.timezone() : "Asia/Kolkata";
      const parts = getDateParts(utcSeconds, tz);
      let label = `${SHORT_WEEKDAYS[parts.weekday]} ${pad2(parts.day)} ${SHORT_MONTHS[parts.month - 1]} '${String(parts.year).slice(-2)}`;
      if (parts.hour !== 0 || parts.minute !== 0 || parts.second !== 0) {
        label += ` ${pad2(parts.hour)}:${pad2(parts.minute)}`;
        if (parts.second !== 0) label += `:${pad2(parts.second)}`;
      }
      return label;
    });
  }

  // 2. Override pane.paintBase time-axis pass so first & last visible ticks of each month are
  // computed AFTER collision filtering
  const panes: any[] = chart._panes;
  if (!Array.isArray(panes)) return;

  for (const pane of panes) {
    if (!pane || pane.__honbaTimeAxisPatched || typeof pane.paintBase !== "function") continue;
    pane.__honbaTimeAxisPatched = true;
    const origPaintBase = pane.paintBase.bind(pane);
    pane.paintBase = function (rc: any, targetCtx?: CanvasRenderingContext2D) {
      const wantTimeAxis = Boolean(rc?.showTimeAxis);
      const patchedRc = wantTimeAxis ? { ...rc, showTimeAxis: false } : rc;
      origPaintBase(patchedRc, targetCtx);
      if (wantTimeAxis) {
        try {
          const ctx: CanvasRenderingContext2D | undefined =
            targetCtx ?? this._backend?.overlay2d?.() ?? this.base?.ctx;
          if (ctx) {
            const tz =
              rc?.timezone ??
              (typeof chart.timezone === "function" ? chart.timezone() : "Asia/Kolkata");
            paintTradingViewTimeAxis(ctx, this, rc, tz);
          }
        } catch {
          // ignore
        }
      }
    };
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
  const tradeBtnsRef = useRef<BuySellButtons | null>(null);

  const ticketQuantity = useWorkbenchStore((s) => s.orderTicket.quantity);
  const quickQtyRef = useRef(ticketQuantity || 25);
  const symbolRef = useRef(symbol);

  useEffect(() => {
    quickQtyRef.current = ticketQuantity || 25;
    if (tradeBtnsRef.current) {
      tradeBtnsRef.current.setQty(ticketQuantity || 25);
    }
  }, [ticketQuantity]);

  useEffect(() => {
    symbolRef.current = symbol;
  }, [symbol]);

  // Measure container width for responsive compact multi-grid rendering
  const [containerWidth, setContainerWidth] = useState<number>(800);
  useEffect(() => {
    if (!rootRef.current) return;
    const el = rootRef.current;
    let lastReportedWidth = Math.round(el.getBoundingClientRect().width || 800);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.round(entry.contentRect.width);
        if (w > 0 && Math.abs(w - lastReportedWidth) >= 12) {
          lastReportedWidth = w;
          setContainerWidth(w);
        }
      }
    });
    observer.observe(el);
    setContainerWidth(lastReportedWidth);
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
  const [symbolSearchInitialQuery, setSymbolSearchInitialQuery] = useState("");
  const symbolBtnRef = useRef<HTMLButtonElement>(null);

  const [timeframeMenuOpen, setTimeframeMenuOpen] = useState(false);
  const timeframeBtnRef = useRef<HTMLButtonElement>(null);

  const [chartTypeOpen, setChartTypeOpen] = useState(false);
  const chartTypeBtnRef = useRef<HTMLButtonElement>(null);

  const [snapshotMenuOpen, setSnapshotMenuOpen] = useState(false);
  const snapshotBtnRef = useRef<HTMLButtonElement>(null);

  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreBtnRef = useRef<HTMLButtonElement>(null);

  // Open full-pool SymbolSearchModal when typing a letter on the focused chart canvas
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (symbolSearchOpen || e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || e.repeat) {
        return;
      }
      if (!/^[a-zA-Z]$/.test(e.key)) return;
      const rootEl = rootRef.current;
      const activeEl = document.activeElement;
      const targetEl = e.target as HTMLElement | null;
      if (!rootEl || !activeEl || !targetEl) return;
      if (!rootEl.contains(activeEl) && !rootEl.contains(targetEl)) return;
      for (let el: HTMLElement | null = targetEl; el; el = el.parentElement) {
        if (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;
      }
      const w = widgetRef.current as any;
      if (w && (w.draw?.activeTool?.() !== null || w.context?.overlays?.size?.() > 0)) return;
      e.preventDefault();
      e.stopPropagation();
      setSymbolSearchInitialQuery(e.key.toUpperCase());
      setSymbolSearchOpen(true);
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [symbolSearchOpen]);

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
    let unsubscribeTheme: (() => void) | null = null;
    const normInterval = timeframe.toLowerCase() === '1d' ? '1d' : timeframe.toLowerCase();
    const initialChartType = chartMode === 'area' ? 'area' : 'candlestick';

    const buildWidget = async () => {
      await loadAll502Indicators();
      if (destroyed || !chartHostRef.current) return;

      try {
        const initialTheme = buildHonbaChartTheme();
        const initialMeta = resolveSymbolMetadata(symbol);
        const widget = createWidget(chartHostRef.current, {
          feed: defaultHonbaFeed,
          symbol: symbol.toUpperCase(),
          exchange: initialMeta.exchange || 'NSE',
          interval: normInterval,
          theme: initialTheme,
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

        // In-chart canvas BuySellButtons primitive (matching OpenAlgo terminal)
        try {
          const tradeBtns = new BuySellButtons({
            id: 'trade',
            position: 'top-left',
            margin: { x: 14, y: 44 },
            qty: quickQtyRef.current,
            scale: 0.72,
            buyColor: initialTheme.buy,
            sellColor: initialTheme.sell,
          });
          widget.chart.addPrimitive(tradeBtns, 0);
          attachBuySellBubbleCursorFreeze(widget.chart, tradeBtns);
          ensureBuySellBubbleOnTop(widget.chart, tradeBtns);
          attachTradingViewTimeFormatter(widget.chart);
          tradeBtnsRef.current = tradeBtns;
        } catch (e) {
          console.warn('Could not attach BuySellButtons primitive:', e);
        }

        // Handle in-chart clicks for Buy/Sell -> open full-featured OrderModal with options
        widget.chart.subscribeClick((id: string) => {
          if (id === 'trade:buy' || id.endsWith(':buy')) {
            useWorkbenchStore.getState().openOrderModal({
              symbol: symbolRef.current,
              side: 'buy',
              quantity: quickQtyRef.current,
            });
          } else if (id === 'trade:sell' || id.endsWith(':sell')) {
            useWorkbenchStore.getState().openOrderModal({
              symbol: symbolRef.current,
              side: 'sell',
              quantity: quickQtyRef.current,
            });
          } else if (id === 'trade:qty' || id.endsWith(':qty')) {
            useWorkbenchStore.getState().openOrderModal({
              symbol: symbolRef.current,
              side: 'buy',
              quantity: quickQtyRef.current,
            });
          }
        });

        // Theme subscription to dynamically follow theme changes across candles, wicks, grid, and buttons
        unsubscribeTheme = subscribeHonbaTheme((newTheme) => {
          if (widgetRef.current && !widgetRef.current.isDestroyed) {
            try {
              widgetRef.current.setTheme(newTheme);
              if (widgetRef.current.series) {
                widgetRef.current.series.applyOptions({
                  upColor: newTheme.upColor,
                  downColor: newTheme.downColor,
                  wickUpColor: newTheme.wickUpColor,
                  wickDownColor: newTheme.wickDownColor,
                  borderUpColor: newTheme.upColor,
                  borderDownColor: newTheme.downColor,
                });
              }
              if (tradeBtnsRef.current) {
                tradeBtnsRef.current.setColors(newTheme.buy, newTheme.sell);
              }
            } catch {
              // ignore
            }
          }
        });

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
      if (unsubscribeTheme) unsubscribeTheme();
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
        const meta = resolveSymbolMetadata(symbol);
        w.setSymbol(symbol.toUpperCase(), meta.exchange || 'NSE');
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
  const handlePickSymbol = (picked: string, exchange?: string) => {
    setSymbolSearchOpen(false);
    const ex = exchange || (picked.includes(':') ? picked.split(':')[0] : 'NSE');
    const cleanSym = picked.includes(':') ? picked.split(':')[1] : picked;
    const normSym = cleanSym.toUpperCase();
    const w = widgetRef.current;
    if (w) {
      try {
        w.setSymbol(normSym, ex);
        onSymbolChange?.(normSym);
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
  const currentSymbolMeta = resolveSymbolMetadata(symbol);

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
            onClick={() => {
              setSymbolSearchInitialQuery("");
              setSymbolSearchOpen(!symbolSearchOpen);
            }}
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
            title="Search symbol across 3,700+ available markets, indices, ETFs, F&O, and custom tickers"
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
                {currentSymbolMeta.exchange}
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

      {/* 1. Symbol Search Modal (Full Available Pool: 3,700+ symbols, category chips, spread expressions, and arbitrary symbols) */}
      <SymbolSearchModal
        open={symbolSearchOpen}
        onClose={() => {
          setSymbolSearchOpen(false);
          setSymbolSearchInitialQuery('');
        }}
        currentSymbol={symbol}
        onSelectSymbol={handlePickSymbol}
        initialQuery={symbolSearchInitialQuery}
      />

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
