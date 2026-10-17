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
import { SimulationControls } from './simulator/components/simulation-controls';
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
          <aside style={{ width: 320, minWidth: 260, borderRight: '1px solid var(--border-subtle)', minHeight: 0 }}>
            <SimulationControls
              onRun={() => void store.execute(client)}
              onSweeps={() => setNotice('Parameter sweeps open in the Designer optimisation engine (Phase 8).')}
            />
          </aside>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResultsPanel />
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
