import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Play, Pause, Zap } from 'lucide-react';

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

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="shortlist-btn shortlist-btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={engine.engineState.status === 'playing' ? engine.pause : engine.play}
              disabled={loadedBars.length === 0}
            >
              {engine.engineState.status === 'playing' ? <Pause size={13} /> : <Play size={13} />}
              {engine.engineState.status === 'playing' ? 'Pause Replay' : 'Animate Replay'}
            </button>

            <button
              type="button"
              className="shortlist-btn"
              style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-gold, #f7a600)' }}
              onClick={engine.instant}
              disabled={loadedBars.length === 0}
              title="Instantly simulate the entire period"
            >
              <Zap size={13} />
              Instant Run
            </button>
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
              onRun={() => engine.instant()}
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

            {/* Institutional Tabs (Overview, Sandboxed Portfolio, Trades, Signals) */}
            <div style={{ flex: '0 0 45%', minHeight: 220, display: 'flex', flexDirection: 'column' }}>
              <WorkbenchTabs
                engineState={engine.engineState}
                onClearPortfolio={engine.clearPortfolio}
              />
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
};

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<Simulator />);
}
