import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ExternalLink } from 'lucide-react';

import '../styles/theme.css';
import '../styles/base.css';
import '../styles/components.css';

import { themeEngine } from '../core/theme-engine';
import { AppShell } from '../layouts/app-shell';
import { HonbaClient } from '../core/api/generated/client';
import { getAppMetadata } from '../core/apps';
import { designerHandoffUrl, stashDesignerHandoff } from '../core/designer/handoff';
import { SimulationControls } from './simulator/components/simulation-controls';
import { SimulatorChart } from './simulator/components/interactive-chart';
import { ReplayToolbar } from './simulator/components/replay-toolbar';
import { ResultsPanel } from './simulator/components/results-panel';
import { WorkbenchTabs } from './simulator/components/workbench-tabs';
import { useSimulatorStore } from './simulator/store/simulator-store';
import { useSimulationEngine } from '../core/simulator/engine/use-simulation-engine';
import type { ChartBar } from '../core/simulator/chart-data';

/**
 * Honba Simulator Entry Point.
 *
 * Implements full client-side animated backtesting & simulation (Goal 2 & Goal 3):
 * - Micro-tick simulation & real-time indicator evaluation
 * - Multi-signal confluence scoring and indications
 * - Synchronized Multi-Chart & Multi-Timeframe rendering
 * - Direct hook into sandboxed portfolio (persistent P&L until cleared)
 * - QuantDinger Backtest Center workbench tabs (Overview, Portfolio, Trades, Signals)
 */
const Simulator: React.FC = () => {
  const store = useSimulatorStore();
  const client = useMemo(() => new HonbaClient({}), []);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadedBars, setLoadedBars] = useState<readonly ChartBar[]>([]);

  const [selectedAccountId, setSelectedAccountId] = useState('acc-sandbox-primary');
  const [multiTimeframe, setMultiTimeframe] = useState(false);
  const [secondaryTimeframe, setSecondaryTimeframe] = useState('1h');
  // The dock shows either the client-side replay bench or the server run report
  // (Phase 8); both read their own source and never disagree (the bench reads
  // the engine, the report reads the POST /backtests payload + journal).
  const [dockView, setDockView] = useState<'bench' | 'report'>('bench');

  useEffect(() => {
    themeEngine.applyToDOM();
    store.hydrate();
  }, []);

  const appMeta = getAppMetadata('simulator');
  const busy = store.run.status === 'running';

  const engine = useSimulationEngine(
    loadedBars,
    store.strategy,
    store.controls.symbol,
    store.controls.exchange,
    store.controls.capital,
    selectedAccountId,
  );

  return (
    <AppShell currentAppId="simulator">
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Top Header Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '8px 16px',
            borderBottom: '1px solid var(--border-subtle, #2a2e39)',
            background: 'var(--bg-surface-elevated, #1e222d)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
            <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{appMeta.name}</h1>
            <span
              style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {appMeta.tagline} · Strategy:{' '}
              <strong style={{ color: 'var(--accent-primary, #4f8cff)' }}>{store.strategyName}</strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                fontSize: 11,
                padding: '3px 8px',
                borderRadius: 4,
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-family-mono, monospace)',
              }}
            >
              {store.controls.symbol}.{store.controls.exchange} · {store.controls.timeframe}
            </span>
            <a
              href={`/algodesigner.html?strategy=${encodeURIComponent(store.strategyName)}`}
              className="shortlist-btn"
              style={{ fontSize: 11, padding: '4px 10px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}
              title="Edit this strategy in AlgoDesigner"
            >
              <ExternalLink size={12} />
              <span>Edit in Designer</span>
            </a>
          </div>
        </div>

        {notice ? (
          <div
            role="status"
            style={{
              padding: '6px 16px',
              fontSize: 12,
              color: 'var(--text-secondary)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <span>{notice}</span>
            <button
              type="button"
              className="shortlist-btn"
              onClick={() => setNotice(null)}
              style={{ fontSize: 11, padding: '2px 8px' }}
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {/* Workspace Body */}
        <section style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          {/* Left Controls Aside */}
          <aside
            style={{
              width: 310,
              minWidth: 260,
              borderRight: '1px solid var(--border-subtle, #2a2e39)',
              minHeight: 0,
              overflowY: 'auto',
              background: 'var(--bg-canvas, #131722)',
            }}
          >
            <SimulationControls
              selectedAccountId={selectedAccountId}
              onSelectAccount={(accId) => {
                setSelectedAccountId(accId);
                engine.selectAccount(accId);
              }}
              multiTimeframe={multiTimeframe}
              secondaryTimeframe={secondaryTimeframe}
              onToggleMultiTf={(enabled, tf) => {
                setMultiTimeframe(enabled);
                setSecondaryTimeframe(tf);
                if (enabled) {
                  engine.setSecondaryTimeframe(tf);
                } else if (engine.engineState.multiTimeframe) {
                  engine.toggleMultiTimeframe();
                }
              }}
              onRun={() => {
                // `[Run Backtest]` submits POST /backtests and fills the run
                // report; the replay bench keeps its own engine controls (the
                // toolbar and the header buttons), so the two paths stay apart.
                setDockView('report');
                void store.execute(client);
              }}
              onSweeps={() => {
                const stashed = stashDesignerHandoff(store.strategy, 'sweeps');
                if (!stashed) {
                  setNotice('The session store is unavailable, so the strategy could not be handed to the Designer.');
                  return;
                }
                window.location.href = designerHandoffUrl('sweeps');
              }}
            />
          </aside>

          {/* Right Main Arena: Charts & Institutional Workbench */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {/* Replay Toolbar */}
            <ReplayToolbar
              engineState={engine.engineState}
              onPlay={engine.play}
              onPause={engine.pause}
              onStep={engine.step}
              onReset={engine.reset}
              onInstant={engine.instant}
              onSpeedChange={engine.setSpeed}
              onScrub={engine.scrub}
              onToggleMultiTimeframe={() => {
                const next = !multiTimeframe;
                setMultiTimeframe(next);
                engine.toggleMultiTimeframe();
              }}
            />

            {/* Synchronized Multi-Chart */}
            <div style={{ flex: '1 1 55%', minHeight: 260, borderBottom: '1px solid var(--border-subtle, #2a2e39)' }}>
              <SimulatorChart
                client={client}
                onBarsLoaded={(bars) => setLoadedBars(bars)}
                engineVisibleBars={engine.visibleBars}
                engineTrips={engine.engineState.roundTrips}
                multiTimeframe={multiTimeframe}
                secondaryTimeframe={secondaryTimeframe}
              />
            </div>

            {/* Bottom dock: the client-side replay bench and the server run report. */}
            <div style={{ flex: '0 0 45%', minHeight: 220, display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  padding: '0 8px',
                  borderBottom: '1px solid var(--border-subtle, #2a2e39)',
                  background: 'var(--bg-surface-elevated, #1e222d)',
                }}
              >
                <DockTab active={dockView === 'bench'} onClick={() => setDockView('bench')} label="Replay Bench" />
                <DockTab
                  active={dockView === 'report'}
                  onClick={() => setDockView('report')}
                  label="Run Report"
                  badge={store.run.response ? 'ready' : undefined}
                />
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                {dockView === 'bench' ? (
                  <WorkbenchTabs engineState={engine.engineState} onClearPortfolio={engine.clearPortfolio} />
                ) : (
                  <ResultsPanel client={client} />
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
};

/** A dock-level tab that switches between the replay bench and the run report. */
const DockTab: React.FC<{ active: boolean; onClick: () => void; label: string; badge?: string }> = ({
  active,
  onClick,
  label,
  badge,
}) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '8px 12px',
      fontSize: 11,
      fontWeight: active ? 600 : 400,
      color: active ? 'var(--accent-primary, #4f8cff)' : 'var(--text-muted)',
      background: 'transparent',
      border: 'none',
      borderBottom: `2px solid ${active ? 'var(--accent-primary, #4f8cff)' : 'transparent'}`,
      cursor: 'pointer',
    }}
  >
    <span>{label}</span>
    {badge ? (
      <span
        style={{
          fontSize: 9,
          padding: '1px 5px',
          borderRadius: 3,
          background: 'rgba(79, 140, 255, 0.15)',
          color: 'var(--accent-primary, #4f8cff)',
        }}
      >
        {badge}
      </span>
    ) : null}
  </button>
);

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<Simulator />);
}
