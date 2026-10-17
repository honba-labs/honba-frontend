import React, { useEffect, useMemo, useState } from 'react';

import { EquityDrawdownChart } from '../../algodesigner/panels';
import type { BacktestMetrics, Bar } from '../../../core/types/generated/domain';
import {
  benchmarkEquity,
  benchmarkInstrumentId,
  type AnalyticsInput,
  type EquitySeries,
} from '../../../core/simulator/analytics';
import { toChartBars } from '../../../core/simulator/chart-data';

/**
 * Equity & drawdown card (Phase 8).
 *
 * The curve is the **realised** equity from the journal (ADR 0029 S7 reuses the
 * native SVG `EquityDrawdownChart`; no new chart library). The run contract has
 * no equity series and no benchmark, so the benchmark overlay is attempted from
 * the bar store with a best-effort instrument id and simply omitted — with a
 * label — when the store has nothing (risk R5).
 */

export interface EquityCurveCardProps {
  equity: EquitySeries;
  metrics?: BacktestMetrics | null;
  benchmark?: number[] | null;
  benchmarkLabel?: string;
  /** Why the overlay is absent, when it is. */
  benchmarkNote?: string | null;
}

export const EquityCurveCard: React.FC<EquityCurveCardProps> = ({
  equity,
  metrics,
  benchmark,
  benchmarkLabel,
  benchmarkNote,
}) => {
  const empty = equity.equity.length < 2;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {equity.sampling === 'daily' ? 'Realised equity, daily from the journal' : 'Realised equity per closed round trip'}
        </span>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-family-mono, monospace)', color: 'var(--text-secondary)' }}>
          ₹{equity.initial.toLocaleString()} → ₹{equity.final.toLocaleString()}
        </span>
      </div>

      {empty ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, border: '1px dashed var(--border-subtle)', borderRadius: 6 }}>
          No closed round trips to draw yet.
        </div>
      ) : (
        <EquityDrawdownChart equitySeries={equity.equity} metrics={metrics} benchmark={benchmark} benchmarkLabel={benchmarkLabel} />
      )}

      {benchmarkNote ? (
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{benchmarkNote}</div>
      ) : null}
    </div>
  );
};

export interface BenchmarkBarsClient {
  getBarsById(
    id: string,
    query?: { from?: string | null; tf?: string | null; to?: string | null },
    signal?: AbortSignal,
  ): Promise<{ data?: { bars: Bar[] } | null }>;
}

function hasBars(client: unknown): client is BenchmarkBarsClient {
  return typeof (client as BenchmarkBarsClient | undefined)?.getBarsById === 'function';
}

export interface SimulatorEquityCardProps {
  client?: BenchmarkBarsClient | null;
  equity: EquitySeries;
  input: AnalyticsInput;
  benchmarkName: string;
  /** Run `bar_spec`, so the benchmark is fetched on the same timeframe. */
  barSpec: string;
  metrics?: BacktestMetrics | null;
  /** Fresh identity for each run so a previous run's overlay is dropped. */
  runId?: string | null;
}

/**
 * Store-wired equity card: draws the realised curve and, when the bar store can
 * answer for the benchmark symbol over the run window, overlays it.
 */
export const SimulatorEquityCard: React.FC<SimulatorEquityCardProps> = ({
  client,
  equity,
  input,
  benchmarkName,
  barSpec,
  metrics,
  runId,
}) => {
  const [benchmark, setBenchmark] = useState<number[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const instrumentId = useMemo(() => benchmarkInstrumentId(benchmarkName), [benchmarkName]);
  const range = input.window;

  useEffect(() => {
    setBenchmark(null);
    if (!range || equity.sampling !== 'daily' || !hasBars(client) || !instrumentId) {
      setNote(
        !range
          ? 'Benchmark overlay needs a run window.'
          : !instrumentId
            ? 'Benchmark overlay needs a benchmark symbol.'
            : `Benchmark overlay needs a daily equity curve.`,
      );
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const response = await client.getBarsById(
          instrumentId,
          { from: range.start, to: range.end, tf: barSpec },
          controller.signal,
        );
        if (cancelled) return;
        const series = benchmarkEquity(toChartBars(response?.data?.bars ?? []), equity, input);
        if (series) {
          setBenchmark(series);
          setNote(`Benchmark overlay: ${benchmarkName} (${instrumentId}), buy-and-hold normalised to the starting capital.`);
        } else {
          setNote(`No ${barSpec} benchmark bars for ${instrumentId} in this window; the run curve is shown alone.`);
        }
      } catch (error) {
        if (cancelled || controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : String(error);
        setNote(`Benchmark bars unavailable (${message}); the run curve is shown alone.`);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [client, instrumentId, range?.start, range?.end, barSpec, equity, input, benchmarkName, runId]);

  return (
    <EquityCurveCard
      equity={equity}
      metrics={metrics}
      benchmark={benchmark}
      benchmarkLabel={benchmarkName}
      benchmarkNote={note}
    />
  );
};
