import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

import '../styles/theme.css';
import '../styles/base.css';
import '../styles/components.css';

import { themeEngine } from '../core/theme-engine';
import { AppShell } from '../layouts/app-shell';
import { HonbaClient } from '../core/api/generated/client';
import { defaultGraph, useDesignerStore } from '../core/designer/store';
import { WorkspaceLayout } from './algodesigner/workspace-layout';

/**
 * Honba Algo Designer entry point.
 *
 * Phase 1 (HBD-2026-DES-004): the tab-switched shell is replaced by the
 * four-pane `WorkspaceLayout` (library | code | canvas | co-pilot) with a
 * diagnostics drawer. Panes, sizes and focus mode persist via the store.
 */
const AlgoDesigner: React.FC = () => {
  const store = useDesignerStore();
  const [notice, setNotice] = useState<string | null>(null);
  const client = useMemo(() => new HonbaClient({}), []);

  useEffect(() => {
    themeEngine.applyToDOM();
  }, []);

  useEffect(() => {
    if (!store.code && !store.codeEdited) {
      void store.setGraph(store.graph ?? defaultGraph());
    }
  }, []);

  return (
    <AppShell currentAppId="algodesigner">
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {notice ? (
          <div
            role="status"
            style={{
              padding: '6px 16px',
              fontSize: 12,
              color: 'var(--text-secondary)',
              borderBottom: '1px solid var(--border-subtle, #2a2e39)',
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
        <section style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <WorkspaceLayout client={client} onNotice={setNotice} />
        </section>
      </main>
    </AppShell>
  );
};

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<AlgoDesigner />);
}
