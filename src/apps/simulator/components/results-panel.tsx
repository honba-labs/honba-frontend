import React, { useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, Loader2 } from 'lucide-react';

import { pairTrades } from '../../../core/simulator/trade-pairing';
import {
  benchmarkInstrumentId,
  deriveRibbonMetrics,
  equitySeries,
  monthlyHeatmap,
  type AnalyticsInput,
} from '../../../core/simulator/analytics';
import type { HonbaClient } from '../../../core/api/generated/client';
import { useSimulatorStore } from '../store/simulator-store';
import { MetricsRibbon } from './metrics-ribbon';
import { SimulatorEquityCard } from './equity-curve-card';
import { TradeJournalTable } from './trade-journal-table';
import { MonthlyHeatmap } from './monthly-heatmap';
import { ValidationBadges } from './validation-badges';
import { RunLogDrawer } from './run-log-drawer';

/**
 * Run results surface (Phase 6 → Phase 8).
 *
 * The metrics ribbon, realised-equity card, trade journal, monthly heatmap,
 * validation block and run log all read from the same derived round trips, so
 * the panel's numbers and the chart's markers share one source of truth.
 * Sortino and slippage are the two things the contract cannot supply; both are
 * shown as an explicit absence, never a fabricated figure (risk R5).
 */

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
  padding: 12,
  background: 'var(--bg-surface-elevated)',
};

const TABS = ['Overview', 'Journal', 'Heatmap', 'Validation', 'Log'] as const;
type Tab = (typeof TABS)[number];

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    idle: { color: 'var(--text-muted)', label: 'Idle' },
    running: { color: 'var(--primary, #2962ff)', label: 'Running' },
    completed: { color: 'var(--bullish, #089981)', label: 'Completed' },
    failed: { color: 'var(--bearish, #f23645)', label: 'Failed' },
    cancelled: { color: 'var(--text-muted)', label: 'Cancelled' },
  };
  const tone = map[status] ?? map.idle;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: tone.color }}>
      {status === 'running' ? <Loader2 size={12} /> : status === 'completed' ? <CheckCircle2 size={12} /> : <BarChart3 size={12} />}
      {tone.label}
    </span>
  );
}

export interface ResultsPanelProps {
  client?: HonbaClient | null;
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({ client }) => {
  const { run, journal, lastPlan, controls, strategyName } = useSimulatorStore();
  const [tab, setTab] = useState<Tab>('Overview');
  const metrics = run.response?.metrics ?? null;

  const pairing = useMemo(() => pairTrades(journal.trades), [journal.trades]);
  const window = lastPlan?.range ?? null;
  const analytics: AnalyticsInput = useMemo(
    () => ({ metrics, trips: pairing.trips, window, initialCapital: controls.capital }),
    [metrics, pairing.trips, window, controls.capital],
  );
  const ribbon = useMemo(() => deriveRibbonMetrics(analytics), [analytics]);
  const equity = useMemo(() => equitySeries(analytics), [analytics]);
  const heatmap = useMemo(() => monthlyHeatmap(analytics), [analytics]);
  const hasJournal = journal.status === 'ready' && journal.trades.length > 0;
  const benchmarkId = benchmarkInstrumentId(controls.benchmark);

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Results</span>
        <StatusPill status={run.status} />
      </div>

      {run.error ? (
        <div
          role="alert"
          style={{ ...cardStyle, borderColor: 'var(--bearish, #f23645)', color: 'var(--bearish, #f23645)', fontSize: 11, display: 'flex', gap: 6 }}
        >
          <AlertTriangle size={13} />
          <span>{run.error}</span>
        </div>
      ) : null}

      {metrics ? (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TABS.map((name) => (
              <button
                key={name}
                type="button"
                className={tab === name ? 'shortlist-btn shortlist-btn-primary' : 'shortlist-btn'}
                onClick={() => setTab(name)}
                style={{ padding: '3px 10px', fontSize: 11 }}
              >
                {name}
              </button>
            ))}
          </div>

          {tab === 'Overview' ? (
            <>
              <MetricsRibbon metrics={ribbon} />
              <div style={cardStyle}>
                <SimulatorEquityCard
                  client={client}
                  equity={equity}
                  input={analytics}
                  benchmarkName={controls.benchmark}
                  barSpec={controls.timeframe}
                  metrics={metrics}
                  runId={run.runId}
                />
              </div>
            </>
          ) : null}

          {tab === 'Journal' ? (
            <div style={cardStyle}>
              <TradeJournalTable trips={pairing.trips} exportName={`${strategyName}-${run.runId ?? 'run'}`} />
              {!hasJournal ? (
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                  The run journal has not loaded (route absent, empty, or still loading), so the table reflects the fills available.
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === 'Heatmap' ? (
            <div style={cardStyle}>
              <MonthlyHeatmap heatmap={heatmap} wireTotalReturn={metrics.total_return} />
            </div>
          ) : null}

          {tab === 'Validation' ? (
            <div style={cardStyle}>
              <ValidationBadges validation={run.response?.validation ?? null} assumptions={run.response?.assumptions} />
            </div>
          ) : null}

          {tab === 'Log' ? <RunLogDrawer client={client} runId={run.runId} status={run.status} pollLines={run.logs} /> : null}
        </>
      ) : run.status === 'idle' ? (
        <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '40px 12px' }}>
          <BarChart3 size={22} style={{ opacity: 0.5, marginBottom: 8 }} />
          <div>No results yet.</div>
          <div style={{ marginTop: 4 }}>Configure the controls and run a backtest.</div>
        </div>
      ) : (
        <div style={cardStyle}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Waiting for the run to complete…</div>
        </div>
      )}

      {tab === 'Log' && run.logs.length > 0 && !metrics ? (
        <RunLogDrawer client={client} runId={run.runId} status={run.status} pollLines={run.logs} defaultOpen />
      ) : null}

      {lastPlan ? (
        <div style={cardStyle}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-muted)', marginBottom: 6 }}>
            Request payload
          </div>
          <pre
            style={{
              margin: 0,
              fontSize: 11,
              fontFamily: 'var(--font-family-mono, monospace)',
              color: 'var(--text-secondary)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {JSON.stringify(lastPlan.request, null, 2)}
          </pre>
          {benchmarkId ? (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
              Benchmark overlay ({controls.benchmark} → {benchmarkId}) is attempted from the bar store; it appears only when real bars exist.
            </div>
          ) : null}
          {lastPlan.notModelled.length > 0 ? (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
              Not sent — the run contract has no field for {lastPlan.notModelled.join(' and ')} yet (pending a versioned HB field; see risk R5).
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
