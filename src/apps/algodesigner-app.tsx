import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

import '../styles/theme.css';
import '../styles/base.css';
import '../styles/components.css';

import { themeEngine } from '../core/theme-engine';
import { AppShell } from '../layouts/app-shell';
import { HonbaClient } from '../core/api/generated/client';
import { defaultGraph, useDesignerStore, type DesignerTab } from '../core/designer/store';
import { useOpsStore } from '../core/designer/ops-state';
import { DesignerCanvas } from './algodesigner/canvas';
import { AssistantPanel, CodePane, OpsPanel, ResultsPanel, RunPanel, VerifyPanel } from './algodesigner/panels';
import { SweepsPanel } from './algodesigner/sweeps-panel';

const TABS: Array<{ id: DesignerTab; label: string }> = [
  { id: 'canvas', label: 'Canvas' },
  { id: 'code', label: 'Code' },
  { id: 'verify', label: 'Verify' },
  { id: 'run', label: 'Run' },
  { id: 'sweeps', label: 'Sweeps' },
  { id: 'assistant', label: 'Assistant' },
  { id: 'ops', label: 'Ops' },
  { id: 'results', label: 'Results' },
];

const AlgoDesigner: React.FC = () => {
  const store = useDesignerStore();
  const ops = useOpsStore();
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
        <nav style={{ display: 'flex', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={store.tab === tab.id ? 'shortlist-btn shortlist-btn-primary' : 'shortlist-btn'}
              onClick={() => store.setTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        {notice ? (
          <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>{notice}</div>
        ) : null}
        <section style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {store.tab === 'canvas' ? (
            <DesignerCanvas
              graph={store.graph}
              client={client}
              onNodeParams={(id, params) => {
                void store.updateNodeParams(id, params);
              }}
              onError={setNotice}
            />
          ) : null}
          {store.tab === 'code' ? <CodePane code={store.code} onChange={store.setCode} /> : null}
          {store.tab === 'verify' ? (
            <VerifyPanel
              verify={store.verify}
              onVerify={() => {
                void store.verifyNow(client);
              }}
              onSelectNode={(nodeId) => {
                store.selectNode(nodeId);
                store.setTab('canvas');
              }}
            />
          ) : null}
          {store.tab === 'run' ? (
            <RunPanel
              status={store.run.status}
              runId={store.run.runId}
              response={store.run.response}
              error={store.run.error}
              onRun={(seed) => {
                void store.runNow(client, { seed: seed ?? 42 });
              }}
              onViewResults={() => store.setTab('results')}
            />
          ) : null}
          {store.tab === 'sweeps' ? <SweepsPanel /> : null}
          {store.tab === 'assistant' ? (
            <AssistantPanel
              messages={store.assistant}
              onPropose={(text) => void store.proposeAI(text, client)}
              onApplyProposal={(idx) => void store.applyProposal(idx)}
              onClear={store.resetAssistant}
            />
          ) : null}
          {store.tab === 'ops' ? (
            <OpsPanel
              client={client}
              mode={ops.mode}
              badge={ops.badge().label}
              orders={ops.orders.length}
              onRefresh={() => {
                void ops.refresh(client);
              }}
              onClose={() => {
                void ops.closePositions(client);
              }}
            />
          ) : null}
          {store.tab === 'results' ? <ResultsPanel response={store.run.response} /> : null}
        </section>
      </main>
    </AppShell>
  );
};

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<AlgoDesigner />);
}
