import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Play } from 'lucide-react';

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
import { ResultsPanel } from './simulator/components/results-panel';
import { useSimulatorStore } from './simulator/store/simulator-store';

/**
 * Honba Simulator entry point (Phase 6).
 *
 * Replaces `mountPlaceholder('simulator')`. On load it hydrates the workspace
 * from the Designer hand-off (§5.6), the Library, or the last selection, then
 * runs a backtest against `POST /backtests` and folds the result into the store
 * without reloading the page.
 */
const Simulator: React.FC = () => {
  const store = useSimulatorStore();
  const client = useMemo(() => new HonbaClient({}), []);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    themeEngine.applyToDOM();
    store.hydrate();
    // Hydrate once on mount; the zustand store instance is stable.
  }, []);

  const appMeta = getAppMetadata('simulator');
  const busy = store.run.status === 'running';

  return (
    <AppShell currentAppId="simulator">
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '8px 16px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
            <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{appMeta.name}</h1>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {appMeta.tagline}
            </span>
          </div>
          <button
            type="button"
            className="shortlist-btn shortlist-btn-primary"
            disabled={busy}
            style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: busy ? 0.6 : 1 }}
            onClick={() => void store.execute(client)}
          >
            <Play size={13} />
            {busy ? 'Running…' : 'Run Simulation'}
          </button>
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
            <button type="button" className="shortlist-btn" onClick={() => setNotice(null)} style={{ fontSize: 11, padding: '2px 8px' }}>
              Dismiss
            </button>
          </div>
        ) : null}

        <section style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <aside style={{ width: 320, minWidth: 260, borderRight: '1px solid var(--border-subtle)', minHeight: 0, overflowY: 'auto' }}>
            <SimulationControls
              onRun={() => void store.execute(client)}
              onSweeps={() => {
                // The optimisation loop closes in the Designer: hand the active
                // graph over and open its sweeps drawer (Phase 8).
                const stashed = stashDesignerHandoff(store.strategy, 'sweeps');
                if (!stashed) {
                  setNotice('The session store is unavailable, so the strategy could not be handed to the Designer.');
                  return;
                }
                window.location.href = designerHandoffUrl('sweeps');
              }}
            />
          </aside>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, minHeight: 0, borderBottom: '1px solid var(--border-subtle)' }}>
              <SimulatorChart client={client} />
            </div>
            <div style={{ flex: '0 0 46%', minHeight: 0 }}>
              <ResultsPanel client={client} />
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
