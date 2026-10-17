import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart,
  type Bar as OaBar,
  type Chart,
  type ChartTheme,
  type CrosshairMoveEvent,
  type SeriesApi,
  type SeriesMarker,
  type SeriesMarkers,
} from 'openalgo-charts';

import { buildHonbaChartTheme, subscribeHonbaTheme } from '../../../core/workbench/chart-theme';
import {
  initialBarsState,
  loadRunBars,
  type BarsClient,
  type BarsSource,
  type BarsState,
} from '../../../core/simulator/bars';
import { markerToleranceSec, snapToBars, type ChartBar } from '../../../core/simulator/chart-data';
import {
  chartSpecsFor,
  drawableSpecs,
  ensureIndicatorRuntime,
  type ChartIndicatorSpec,
} from '../../../core/simulator/chart-series';
import { resolveRange, universeFor } from '../../../core/simulator/controls';
import { markersFromPairing, pairTrades, type RoundTrip, type TradeMarker } from '../../../core/simulator/trade-pairing';
import { useSimulatorStore } from '../store/simulator-store';

/**
 * Interactive multi-pane chart with trade markers (Phase 7).
 *
 * The chart is the low-level `createChart` tier of `openalgo-charts` (not the
 * `createWidget` tier): candles on the price pane, a volume pane below it, the
 * **active strategy's own** overlays/studies added through the indicator
 * registry, and journal fills drawn as entry/exit triangles. The plan's fixed
 * indicator menu (SMA/EMA/Bollinger/SuperTrend/PSAR + RSI/MACD/ATR/Stochastic)
 * is superseded by a graph-driven set: the chart shows the indicators the
 * strategy actually uses, with the strategy's parameters, so the two agree
 * (risk R7). Volume and VWAP are chart chrome and are always present.
 *
 * All panes share the chart's one time scale, so zoom/pan stays synchronised by
 * construction. No candle is ever synthesised for a market holiday: the bar
 * source (`loadRunBars` → `GET /bars/{id}`, or the deterministic NSE-session
 * preview) only ever emits bars a source produced.
 *
 * The pure logic — bar conversion/resampling, indicator-spec resolution, fill
 * pairing and snapping — lives in `core/simulator/*` and is unit tested in the
 * node environment; this component is the thin canvas binding vitest cannot
 * exercise.
 */

const TIMEZONE = 'Asia/Kolkata';
const VOLUME_COLOR = 'rgba(41, 98, 255, 0.28)';
const VWAP_KEY = '__vwap__';

/** VWAP is chart chrome, not a strategy study, so it is added outside the graph. */
const VWAP_SPEC: ChartIndicatorSpec = {
  key: VWAP_KEY,
  nodeId: VWAP_KEY,
  kind: 'vwap',
  indicator: 'vwap',
  label: 'VWAP',
  settings: {},
  supported: true,
};

interface Palette {
  bull: string;
  bear: string;
}

function paletteOf(theme: ChartTheme): Palette {
  return { bull: theme.upColor ?? '#089981', bear: theme.downColor ?? '#f23645' };
}

/** Fill → marker glyph. Buy sits below the bar, sell above; open is a dot at price. */
function toSeriesMarker(marker: TradeMarker, palette: Palette): SeriesMarker {
  const bull = marker.side === 'buy';
  if (marker.kind === 'open') {
    return {
      time: marker.ts,
      position: 'atPrice',
      price: marker.price,
      shape: 'circle',
      size: 'small',
      color: bull ? palette.bull : palette.bear,
      text: 'open',
      id: marker.key,
    };
  }
  return {
    time: marker.ts,
    position: bull ? 'belowBar' : 'aboveBar',
    shape: bull ? 'arrowUp' : 'arrowDown',
    size: 'small',
    color: bull ? palette.bull : palette.bear,
    id: marker.key,
  };
}

const KIND_LABEL: Record<TradeMarker['kind'], string> = {
  entry: 'Entry',
  exit: 'Exit',
  open: 'Open (derived)',
};

const REASON_LABEL: Record<RoundTrip['exitReason'], string> = {
  position_closed: 'Position closed',
  flipped: 'Flipped',
  open_at_end: 'Open at run end (derived)',
};

function money(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function priceText(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

interface ChartTooltip {
  x: number;
  y: number;
  marker: TradeMarker;
  trip: RoundTrip | null;
}

export interface InteractiveChartProps {
  bars: readonly ChartBar[];
  /** Resolved, drawable graph studies (already validated against the registry). */
  indicators: readonly ChartIndicatorSpec[];
  /** Fill markers, snapped to bar timestamps by the container. */
  markers: readonly TradeMarker[];
  /** Round trips the markers belong to, for the tooltip. */
  trips: readonly RoundTrip[];
  /** Identity of the loaded series; a change re-anchors the viewport. */
  seriesKey?: string;
  showVolume?: boolean;
  showVwap?: boolean;
  isReplaying?: boolean;
}

export const InteractiveChart: React.FC<InteractiveChartProps> = ({
  bars,
  indicators,
  markers,
  trips,
  seriesKey,
  showVolume = true,
  showVwap = true,
  isReplaying = false,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<Chart | null>(null);
  const candleRef = useRef<SeriesApi | null>(null);
  const volumeRef = useRef<SeriesApi | null>(null);
  const markersRef = useRef<SeriesMarkers | null>(null);
  const appliedIndicatorIds = useRef<string[]>([]);
  const markerIndex = useRef<Map<string, { marker: TradeMarker; trip: RoundTrip | null }>>(new Map());
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const anchored = useRef<string | null>(null);

  const [ready, setReady] = useState(false);
  const [palette, setPalette] = useState<Palette>(() => paletteOf(buildHonbaChartTheme()));
  const [tip, setTip] = useState<ChartTooltip | null>(null);

  // Create the chart once. Everything after this point talks to `chartRef`.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const theme = buildHonbaChartTheme();
    const chart = createChart(host, { theme, timezone: TIMEZONE });
    chartRef.current = chart;

    const candles = chart.addSeries('candlestick', {
      style: {
        upColor: theme.upColor,
        downColor: theme.downColor,
        wickUpColor: theme.wickUpColor,
        wickDownColor: theme.wickDownColor,
        borderVisible: false,
      },
    });
    candleRef.current = candles;
    markersRef.current = candles.createMarkers(() => candles.getData());

    // The volume pane (pane 1) exists from the start so study panes always land
    // below it, whatever order the async indicator specs arrive in.
    if (showVolume) {
      try {
        const volume = chart.addSeries('histogram', {
          paneIndex: 1,
          priceScaleId: '',
          priceFormat: { type: 'volume' },
          style: { color: VOLUME_COLOR },
        });
        volume.priceScale().setOptions({ marginTop: 0.85, marginBottom: 0 });
        volumeRef.current = volume;
      } catch {
        // A chart without a volume pane is still usable.
      }
    }
    chart.setPaneWeight(0, 3);
    if (volumeRef.current) chart.setPaneWeight(1, 1);

    const unsubscribeClick = chart.subscribeClick((externalId) => {
      const hit = markerIndex.current.get(externalId);
      if (!hit) {
        setTip(null);
        return;
      }
      const point = lastPoint.current ?? { x: host.clientWidth / 2, y: 48 };
      setTip({ x: point.x, y: point.y, marker: hit.marker, trip: hit.trip });
    });
    const unsubscribeMove = chart.subscribeCrosshairMove((event: CrosshairMoveEvent) => {
      lastPoint.current = event.point ? { x: event.point.x, y: event.point.y } : null;
    });
    const unsubscribeTheme = subscribeHonbaTheme((next) => {
      if (chartRef.current !== chart || chart.isDestroyed) return;
      setPalette(paletteOf(next));
      chart.setTheme(next);
      try {
        candleRef.current?.applyOptions({
          upColor: next.upColor,
          downColor: next.downColor,
          wickUpColor: next.wickUpColor,
          wickDownColor: next.wickDownColor,
        });
      } catch {
        // ignore a theme patch on a torn-down series
      }
    });

    setReady(true);

    return () => {
      unsubscribeClick();
      unsubscribeMove();
      unsubscribeTheme();
      appliedIndicatorIds.current = [];
      candleRef.current = null;
      volumeRef.current = null;
      markersRef.current = null;
      chartRef.current = null;
      try {
        chart.destroy();
      } catch {
        // ignore
      }
    };
    // Created once; `showVolume` is fixed for the life of a chart.
  }, []);

  // Reconcile the graph's studies (plus chrome) against the chart. The indicator
  // tier is imported first: built-in descriptors live in that lazy chunk and the
  // registry is empty until it loads.
  useEffect(() => {
    let cancelled = false;
    void ensureIndicatorRuntime().then(() => {
      const chart = chartRef.current;
      if (cancelled || !chart || chart.isDestroyed) return;

      for (const id of appliedIndicatorIds.current) {
        try {
          chart.removeIndicator(id);
        } catch {
          // ignore a study that is already gone
        }
      }
      appliedIndicatorIds.current = [];

      const wanted: ChartIndicatorSpec[] = [...(showVwap ? [VWAP_SPEC] : []), ...indicators];
      for (const spec of wanted) {
        if (!spec.indicator) continue;
        try {
          const api = chart.addIndicator(spec.indicator, spec.settings, { instanceId: spec.key });
          appliedIndicatorIds.current.push(api.id);
        } catch {
          // An unsupported study is reported by the container; the pane simply
          // does not gain a row for it.
        }
      }

      chart.setPaneWeight(0, 3);
      const panes = chart.panes();
      for (let index = 1; index < panes.length; index += 1) chart.setPaneWeight(index, 1);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, indicators, showVwap]);

  // Data: candles + volume, then the viewport anchor. Anchoring is keyed to the
  // series so a user's zoom survives marker/data refreshes but a new symbol or
  // timeframe re-fits.
  useEffect(() => {
    const chart = chartRef.current;
    const candles = candleRef.current;
    if (!ready || !chart || !candles) return;

    candles.setData(
      bars.map<OaBar>((bar) => ({
        time: bar.time,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
      })),
    );
    volumeRef.current?.setData(
      bars.map((bar) => ({ time: bar.time, open: 0, high: bar.volume, low: 0, close: bar.volume })),
    );

    const key = seriesKey ?? `${bars.length}:${bars[0]?.time ?? 0}`;
    const lastIndex = bars.length - 1;
    if (lastIndex >= 0) {
      if (isReplaying) {
        // In simulation / replay mode: continuously follow leading edge with proper runway
        const windowBars = Math.min(Math.max(bars.length, 40), 100);
        chart.setVisibleLogicalRange({
          from: Math.max(0, lastIndex - windowBars + 1),
          to: Math.max(lastIndex + 4, windowBars - 1),
        });
      } else if (anchored.current !== key) {
        anchored.current = key;
        const visible = Math.min(bars.length, 180);
        chart.setVisibleLogicalRange({
          from: Math.max(0, bars.length - visible),
          to: bars.length - 1 + Math.max(1, Math.round(visible * 0.04)),
        });
      }
    }
  }, [ready, bars, seriesKey, isReplaying]);

  useEffect(() => {
    if (!isReplaying) {
      anchored.current = null;
    }
  }, [isReplaying]);

  // Markers are positioned by time, so they are re-set whenever the data or the
  // pairing changes.
  useEffect(() => {
    const layer = markersRef.current;
    if (!ready || !layer) return;
    const byTrip = new Map(trips.map((trip) => [trip.id, trip]));
    const index = new Map<string, { marker: TradeMarker; trip: RoundTrip | null }>();
    const drawn = markers.map((marker) => {
      const trip = byTrip.get(marker.tripId) ?? null;
      index.set(marker.key, { marker, trip });
      return toSeriesMarker(marker, palette);
    });
    markerIndex.current = index;
    layer.setMarkers(drawn);
  }, [ready, markers, trips, palette]);

  const empty = bars.length === 0;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0 }}>
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />

      {empty ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            color: 'var(--text-muted)',
            pointerEvents: 'none',
          }}
        >
          No bars to draw yet.
        </div>
      ) : null}

      {tip ? (
        <TradeTooltip tip={tip} onClose={() => setTip(null)} />
      ) : null}
    </div>
  );
};

const TradeTooltip: React.FC<{ tip: ChartTooltip; onClose: () => void }> = ({ tip, onClose }) => {
  const { marker, trip } = tip;
  const bull = marker.side === 'buy';
  return (
    <div
      role="tooltip"
      style={{
        position: 'absolute',
        left: Math.max(0, tip.x),
        top: Math.max(0, tip.y),
        transform: 'translate(14px, -50%)',
        minWidth: 190,
        maxWidth: 280,
        padding: '8px 10px',
        borderRadius: 6,
        border: '1px solid var(--border-medium, #2a2e39)',
        background: 'var(--bg-surface-elevated, #1e222d)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        fontSize: 11,
        color: 'var(--text-primary)',
        zIndex: 5,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <strong style={{ color: bull ? 'var(--bullish, #089981)' : 'var(--bearish, #f23645)' }}>
          {bull ? 'Buy' : 'Sell'} · {KIND_LABEL[marker.kind]}
        </strong>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}
        >
          ×
        </button>
      </div>
      <Row label="Price" value={priceText(marker.price)} />
      <Row label="Size" value={String(marker.quantity)} />
      <Row label="Instrument" value={marker.instrument} />
      {trip ? (
        <>
          <Row label="Trip" value={`${trip.id} · ${trip.direction}`} />
          <Row label="Realised PnL" value={trip.realizedPnl === null ? '—' : money(trip.realizedPnl)} />
          <Row
            label="Return"
            value={trip.returnPct === null ? '—' : `${(trip.returnPct * 100).toFixed(2)}%`}
          />
          <Row label="Exit reason" value={REASON_LABEL[trip.exitReason]} />
        </>
      ) : null}
      <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: 10 }}>
        PnL and exit reason are derived from the fill journal. Slippage versus the signal price is not
        carried by the journal (risk R5).
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
  </div>
);

const SOURCE_BADGE: Record<BarsSource, { label: string; color: string } | null> = {
  none: null,
  server: { label: 'Served bars', color: 'var(--bullish, #089981)' },
  preview: { label: 'Preview bars', color: 'var(--accent-primary, #2962ff)' },
};

/**
 * Store-wired container: loads the bars behind the current selection, resolves
 * the strategy's indicator specs and derives trade markers from the run's
 * journal, then hands all of it to {@link InteractiveChart}.
 */
import { MultiChartView } from './multi-chart-view';

export interface SimulatorChartProps {
  client?: Partial<BarsClient> | null;
  onBarsLoaded?: (bars: readonly ChartBar[]) => void;
  engineVisibleBars?: readonly ChartBar[];
  engineTrips?: readonly RoundTrip[];
  multiTimeframe?: boolean;
  secondaryTimeframe?: string;
  isReplaying?: boolean;
}

/**
 * Store-wired container: loads the bars behind the current selection, resolves
 * the strategy's indicator specs and derives trade markers from the run's
 * journal or live replay engine, then hands all of it to {@link MultiChartView}.
 */
export const SimulatorChart: React.FC<SimulatorChartProps> = ({
  client = null,
  onBarsLoaded,
  engineVisibleBars,
  engineTrips,
  multiTimeframe = false,
  secondaryTimeframe = '1h',
  isReplaying = false,
}) => {
  const strategy = useSimulatorStore((state) => state.strategy);
  const controls = useSimulatorStore((state) => state.controls);
  const run = useSimulatorStore((state) => state.run);
  const journal = useSimulatorStore((state) => state.journal);

  const [barsState, setBarsState] = useState<BarsState>(() => initialBarsState());
  const [specs, setSpecs] = useState<ChartIndicatorSpec[]>([]);

  const instrumentId = universeFor(controls);
  const { start, end } = useMemo(() => resolveRange(controls), [controls]);
  const timeframe = controls.timeframe;

  const onBarsLoadedRef = useRef(onBarsLoaded);
  onBarsLoadedRef.current = onBarsLoaded;

  // Bar loading is keyed to the selection, not the run: the chart is useful
  // before anything has been simulated. A cancelled load (selection changed)
  // must not overwrite the newer result.
  useEffect(() => {
    if (!instrumentId) {
      setBarsState(initialBarsState());
      return;
    }
    const controller = new AbortController();
    let active = true;
    setBarsState((prev) => ({ ...prev, status: 'loading' }));
    void loadRunBars(client, { instrumentId, from: start, to: end, barSpec: timeframe }, { signal: controller.signal }).then(
      (state) => {
        if (active) {
          setBarsState(state);
          onBarsLoadedRef.current?.(state.bars);
        }
      },
    );
    return () => {
      active = false;
      controller.abort();
    };
  }, [client, instrumentId, start, end, timeframe]);

  // Indicator specs are resolved against the loaded registry (the tier import is
  // async), so the chart and the strategy agree on parameters.
  useEffect(() => {
    let active = true;
    void chartSpecsFor(strategy).then((resolved) => {
      if (active) setSpecs(resolved);
    });
    return () => {
      active = false;
    };
  }, [strategy]);

  const drawable = useMemo(() => drawableSpecs(specs), [specs]);
  const skipped = useMemo(() => specs.filter((spec) => !spec.supported), [specs]);

  const pairing = useMemo(() => {
    if (engineTrips && engineTrips.length > 0) {
      return { fills: [], trips: [...engineTrips], openPositions: [], dropped: 0 };
    }
    return pairTrades(journal.trades);
  }, [engineTrips, journal.trades]);

  const activeBars = engineVisibleBars && engineVisibleBars.length > 0 ? engineVisibleBars : barsState.bars;

  const markers = useMemo(
    () => snapToBars(markersFromPairing(pairing), activeBars, markerToleranceSec(timeframe)),
    [pairing, activeBars, timeframe],
  );

  const badge = SOURCE_BADGE[barsState.source];
  const seriesKey = `${instrumentId}|${timeframe}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          fontSize: 11,
          color: 'var(--text-secondary)',
          flexWrap: 'wrap',
        }}
      >
        <strong style={{ color: 'var(--text-primary)', fontSize: 12 }}>{instrumentId || 'No instrument'}</strong>
        <span>{timeframe}</span>
        <span>{start && end ? `${start} → ${end}` : ''}</span>
        {badge ? (
          <span
            style={{
              padding: '1px 6px',
              borderRadius: 999,
              border: `1px solid ${badge.color}`,
              color: badge.color,
              fontWeight: 600,
            }}
          >
            {badge.label}
          </span>
        ) : null}
        {pairing.trips.length > 0 ? (
          <span>
            {pairing.trips.length} round trip{pairing.trips.length === 1 ? '' : 's'}
          </span>
        ) : null}
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>
          {engineTrips && engineTrips.length > 0 ? 'Client Animated Simulation' : run.status === 'completed' ? `Run ${run.runId ?? ''}` : 'Ready for simulation'}
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <MultiChartView
          bars={activeBars}
          indicators={drawable}
          markers={markers}
          trips={pairing.trips}
          seriesKey={seriesKey}
          multiTimeframe={multiTimeframe}
          secondaryTimeframe={secondaryTimeframe}
          instrumentId={instrumentId}
          primaryTimeframe={timeframe}
          isReplaying={isReplaying}
        />
      </div>

      <div
        style={{
          padding: '4px 12px',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: 10,
          color: 'var(--text-muted)',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {barsState.note ? <span>{barsState.note}</span> : null}
        {skipped.length > 0 ? (
          <span>Not drawn — no chart indicator registered for {skipped.map((spec) => spec.kind).join(', ')}.</span>
        ) : null}
        {journal.status === 'error' ? <span>Journal unavailable: {journal.error}</span> : null}
        <span>{PENDING_NOTE}</span>
      </div>
    </div>
  );
};

/**
 * No run event stream exists, so unfilled orders cannot be derived; the note is
 * shown so a viewer never reads the absence as "there were no pending orders".
 * Open positions at the run's end *are* derivable and are drawn as dots.
 */
const PENDING_NOTE =
  'Pending (unfilled) orders are not exposed by the run contract — no event stream — so no pending markers are drawn; open positions at the run end are shown as derived dots.';
