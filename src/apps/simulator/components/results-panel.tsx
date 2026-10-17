import React from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, Loader2 } from 'lucide-react';

import { useSimulatorStore } from '../store/simulator-store';

/**
 * Run results surface (Phase 6).
 *
 * Deliberately modest: the metrics grid from `BacktestMetrics`, the run status,
 * the request payload actually sent, and the progress log. The interactive
 * chart with trade markers lives beside this panel (Phase 7); equity curves,
 * the trade journal table and heatmaps are Phase 8.
 */

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
  padding: 12,
  background: 'var(--bg-surface-elevated)',
};

function metric(value: number | null | undefined, format: (v: number) => string): string {
  return value === null || value === undefined || !Number.isFinite(value) ? '—' : format(value);
}

const pct = (value: number) => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;

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

export const ResultsPanel: React.FC = () => {
  const { run, lastPlan } = useSimulatorStore();
  const metrics = run.response?.metrics ?? null;

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflowY: 'auto' }}>
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

      {run.status === 'idle' ? (
        <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '40px 12px' }}>
          <BarChart3 size={22} style={{ opacity: 0.5, marginBottom: 8 }} />
          <div>No results yet.</div>
          <div style={{ marginTop: 4 }}>Configure the controls and run a backtest.</div>
        </div>
      ) : null}

      {metrics ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          {[
            { label: 'Total Return', value: metric(metrics.total_return, pct) },
            { label: 'Net PnL', value: metric(metrics.net_pnl, (v) => v.toFixed(2)) },
            { label: 'Sharpe', value: metric(metrics.sharpe, (v) => v.toFixed(2)) },
            { label: 'Max Drawdown', value: metric(metrics.max_drawdown, (v) => `${(v * 100).toFixed(2)}%`) },
            { label: 'Trades', value: metric(metrics.trades, (v) => String(v)) },
            { label: 'Run', value: run.runId ?? '—' },
          ].map((item) => (
            <div key={item.label} style={cardStyle}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-muted)' }}>{item.label}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{item.value}</div>
            </div>
          ))}
        </div>
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
          {lastPlan.notModelled.length > 0 ? (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
              Not sent — the run contract has no field for {lastPlan.notModelled.join(' and ')} yet (pending a versioned HB field; see risk R5).
            </div>
          ) : null}
        </div>
      ) : null}

      {run.logs.length > 0 ? (
        <div style={cardStyle}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-muted)', marginBottom: 6 }}>
            Progress log
          </div>
          <div style={{ fontFamily: 'var(--font-family-mono, monospace)', fontSize: 11, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {run.logs.map((line, index) => (
              <span key={`${index}-${line}`}>{line}</span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};
