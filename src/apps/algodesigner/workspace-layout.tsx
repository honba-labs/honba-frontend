import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Braces,
  CheckCircle2,
  GitCompare,
  Layers,
  Maximize2,
  PanelBottom,
  Play,
  Save,
  ShieldCheck,
  Workflow,
} from 'lucide-react';

import type { HonbaClient } from '../../core/api/generated/client';
import {
  DEFAULT_NODE_POSITIONS,
  useDesignerStore,
  defaultGraph,
  type DesignerPane,
  type DrawerTab,
} from '../../core/designer/store';
import { mapNodeLines, nodeAtLine, spansToMarkers, verifyIssuesToMarkers } from '../../core/designer/diagnostics';
import type { EditorReveal } from './monaco-python-editor';
import { graphHashSync, type GraphNode } from '../../core/graph/model';
import { cataloguelookup } from '../../core/graph/catalogue';
import { stashHandoff, simulatorHandoffUrl } from '../../core/designer/handoff';
import { useOpsStore } from '../../core/designer/ops-state';
import { OpsPanel, ResultsPanel, RunPanel, VerifyPanel } from './panels';
import { SweepsPanel } from './sweeps-panel';
import { DesignerCanvas } from './canvas';
import { CodeEditorPane } from './code-editor-pane';
import { ParamsPanel } from './params-panel';
import { LibraryDrawer } from './library-drawer';
import { AiChatColumn } from './ai-chat-column';
import { Pane, Splitter } from './split-pane';

/**
 * Four-pane Algo Designer workspace (Phase 1, HBD-2026-DES-004).
 *
 * Left/right columns (library, co-pilot) are optional and resizable; the centre
 * is a code|canvas split. Verify/Run/Sweeps/Ops/Results move into a bottom
 * drawer. Every pane can take focus mode, which is the old tab behaviour
 * preserved without losing any capability.
 */

const DRAWER_LABELS: Record<DrawerTab, string> = {
  verify: 'Verify',
  run: 'Run',
  sweeps: 'Sweeps',
  ops: 'Ops',
  results: 'Results',
};

/** Canvas badge text/colour for the code -> flow sync status (Phase 3). */
const SYNC_BADGE: Record<'idle' | 'pending' | 'synced' | 'invalid', { text: string; color: string }> = {
  idle: { text: 'Flow: idle', color: 'var(--text-muted)' },
  pending: { text: 'Pending valid syntax…', color: 'var(--accent-gold, #f7a600)' },
  synced: { text: 'Graph synced (clean)', color: 'var(--bullish, #089981)' },
  invalid: { text: 'Last valid graph held', color: 'var(--bearish, #f23645)' },
};

export interface WorkspaceLayoutProps {
  client: HonbaClient;
  onNotice?: (message: string) => void;
}

export const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({ client, onNotice }) => {
  const store = useDesignerStore();
  const ops = useOpsStore();
  const layout = store.layout;
  const rowRef = useRef<HTMLDivElement>(null);
  const [paramsOpen, setParamsOpen] = useState(false);

  const hash = useMemo(() => graphHashSync(store.graph), [store.graph]);
  const markers = useMemo(
    () => [...verifyIssuesToMarkers(store.verify, store.code), ...spansToMarkers(store.sync.spans)],
    [store.verify, store.code, store.sync.spans],
  );
  // Node <-> line map for navigation, derived from the live code so it stays
  // correct after canvas edits (the recogniser's copy may be older).
  const sourceLines = useMemo(
    () => mapNodeLines(store.code, store.graph.nodes.map((node) => node.id)),
    [store.code, store.graph],
  );
  const [reveal, setReveal] = useState<EditorReveal | null>(null);
  useEffect(() => {
    const id = store.selectedNodeId;
    if (!id) return;
    const line = sourceLines[id];
    if (!line) return;
    setReveal((prev) => ({ line, nonce: (prev?.nonce ?? 0) + 1 }));
  }, [store.selectedNodeId, sourceLines]);

  const handleLineClick = useCallback(
    (line: number) => {
      const nodeId = nodeAtLine(sourceLines, line);
      if (nodeId) store.selectNode(nodeId);
    },
    [sourceLines, store],
  );

  const setNotice = useCallback((message: string) => onNotice?.(message), [onNotice]);

  const handleNewStrategy = useCallback(() => {
    void store.setGraph(defaultGraph());
    store.setPositions({ ...DEFAULT_NODE_POSITIONS });
    setNotice('Started a new strategy from the default SMA cross.');
  }, [store, setNotice]);

  const handleAddIndicator = useCallback(
    (kind: string) => {
      const entry = cataloguelookup(kind);
      const params: Record<string, unknown> = {};
      entry?.params.forEach((p) => {
        params[p.name] = p.defaultValue;
      });
      const node: GraphNode = {
        id: kind,
        type: 'indicator',
        indicator: kind,
        label: kind.toUpperCase(),
        params,
      };
      void store.addNode(node);
      setNotice(`Added ${kind.toUpperCase()} node to the canvas.`);
    },
    [store, setNotice],
  );

  const handleSimulate = useCallback(() => {
    stashHandoff(store.graph);
    window.location.href = simulatorHandoffUrl(store.graph.name);
  }, [store.graph]);

  const handleSave = useCallback(() => {
    void store.snapshotVersion();
    store.markSaved();
    setNotice(`Saved revision ${hash.slice(0, 8)}.`);
  }, [store, hash, setNotice]);

  const focus = layout.focus;
  const isFocused = (pane: DesignerPane) => focus === pane;

  const libraryVisible = focus ? focus === 'library' : layout.libraryOpen;
  const assistantVisible = focus ? focus === 'assistant' : layout.assistantOpen;
  const codeVisible = focus ? focus === 'code' : true;
  const canvasVisible = focus ? focus === 'canvas' : true;

  const adjustWidth = useCallback(
    (pane: 'library' | 'assistant', delta: number, invert = false) => {
      const current = pane === 'library' ? layout.libraryWidth : layout.assistantWidth;
      store.setPaneWidth(pane, current + (invert ? -delta : delta));
    },
    [layout.libraryWidth, layout.assistantWidth, store],
  );

  const adjustRatio = useCallback(
    (delta: number) => {
      const width = rowRef.current?.clientWidth ?? 1;
      store.setCodeRatio(layout.codeRatio + delta / width);
    },
    [layout.codeRatio, store],
  );

  const codeWeight = layout.codeRatio;
  const canvasWeight = 1 - layout.codeRatio;
  const showSplitters = !focus;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '6px 12px',
          background: 'var(--bg-surface, #1e222d)',
          borderBottom: '1px solid var(--border-subtle, #2a2e39)',
          fontSize: 12,
          flex: '0 0 auto',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--text-primary)' }}>
            <Workflow size={14} />
            Algo Designer
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            {store.graph.name}
            {store.isModified ? (
              <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent-gold, #f7a600)' }}>● Unsaved</span>
            ) : (
              <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-muted)' }}>
                <CheckCircle2 size={10} style={{ color: 'var(--bullish, #089981)' }} /> Saved
              </span>
            )}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="shortlist-btn"
            onClick={() => store.togglePane('library')}
            aria-pressed={layout.libraryOpen}
            title="Toggle the strategy & indicator library"
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
          >
            <Layers size={12} />
            <span>Library</span>
          </button>
          <button
            type="button"
            className="shortlist-btn"
            onClick={handleSave}
            title="Snapshot the current revision (Ctrl+S)"
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
          >
            <Save size={12} />
            <span>Save</span>
          </button>
          <button
            type="button"
            className="shortlist-btn"
            onClick={() => void store.verifyNow(client)}
            title="Verify the strategy graph structure and ports"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              color: store.verify.ok ? 'var(--bullish, #089981)' : store.verify.issues.length > 0 ? 'var(--bearish, #f23645)' : undefined,
            }}
          >
            <ShieldCheck size={12} />
            <span>{store.verify.ok ? 'Verified' : store.verify.issues.length > 0 ? `${store.verify.issues.length} Defect(s)` : 'Verify'}</span>
          </button>
          <button
            type="button"
            className="shortlist-btn"
            onClick={() => store.togglePane('assistant')}
            aria-pressed={layout.assistantOpen}
            title="Toggle the AI Co-Pilot column"
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
          >
            <Bot size={12} />
            <span>Co-Pilot</span>
          </button>
          <button
            type="button"
            className="shortlist-btn"
            onClick={() => store.setDrawer(!layout.drawerOpen, layout.drawerTab)}
            aria-pressed={layout.drawerOpen}
            title="Toggle the diagnostics drawer"
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
          >
            <PanelBottom size={12} />
            <span>Panels</span>
          </button>
          <button
            type="button"
            className="shortlist-btn shortlist-btn-primary"
            onClick={handleSimulate}
            title="Open the Simulator with this strategy"
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
          >
            <Play size={12} />
            <span>Simulate →</span>
          </button>
          {focus ? (
            <button
              type="button"
              className="shortlist-btn"
              onClick={() => store.toggleFocus(focus)}
              title="Exit focus mode"
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
            >
              <Maximize2 size={12} />
              <span>Exit focus</span>
            </button>
          ) : null}
        </div>
      </header>

      <div ref={rowRef} style={{ flex: 1, display: 'flex', flexDirection: 'row', minHeight: 0, minWidth: 0 }}>
        {/* Left: strategy & indicator library */}
        {libraryVisible ? (
          <div style={{ flex: '0 0 auto', width: focus ? '100%' : layout.libraryWidth, minWidth: 0, height: '100%', borderRight: '1px solid var(--border-subtle, #2a2e39)' }}>
            <Pane
              id="library"
              title="Library"
              icon={<Layers size={12} />}
              focused={isFocused('library')}
              onToggleFocus={store.toggleFocus}
              onClose={focus ? undefined : store.togglePane}
            >
              <LibraryDrawer onNewStrategy={handleNewStrategy} onAddIndicator={handleAddIndicator} />
            </Pane>
          </div>
        ) : null}

        {/* Centre-left: Python code */}
        {codeVisible ? (
          <>
            {showSplitters && libraryVisible ? (
              <Splitter ariaLabel="Resize library pane" onDelta={(delta) => adjustWidth('library', delta)} />
            ) : null}
            <div style={{ flexGrow: focus ? 1 : codeWeight, flexBasis: 0, minWidth: 0, height: '100%' }}>
              <Pane
                id="code"
                title="Python Code"
                icon={<Braces size={12} />}
                focused={isFocused('code')}
                onToggleFocus={store.toggleFocus}
                actions={
                  <button
                    type="button"
                    className="shortlist-btn"
                    onClick={() => setParamsOpen((open) => !open)}
                    aria-pressed={paramsOpen}
                    title="Show or hide the parameter tuner"
                    style={{ padding: '2px 6px', fontSize: 10 }}
                  >
                    Parameters
                  </button>
                }
              >
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <CodeEditorPane
                      value={store.code}
                      onChange={store.setCode}
                      markers={markers}
                      hash={hash}
                      syncStatus={store.sync.status}
                      reveal={reveal}
                      onLineClick={handleLineClick}
                    />
                  </div>
                  {paramsOpen ? (
                    <div style={{ flex: '0 0 auto', maxHeight: '45%', overflow: 'auto', borderTop: '1px solid var(--border-subtle, #2a2e39)' }}>
                      <ParamsPanel graph={store.graph} onParamChange={(nodeId, params) => void store.updateNodeParams(nodeId, params)} />
                    </div>
                  ) : null}
                </div>
              </Pane>
            </div>
          </>
        ) : null}

        {/* Centre-right: strategy flow canvas */}
        {canvasVisible ? (
          <>
            {showSplitters && codeVisible ? <Splitter ariaLabel="Resize code and canvas panes" onDelta={adjustRatio} /> : null}
            <div style={{ flexGrow: focus ? 1 : canvasWeight, flexBasis: 0, minWidth: 0, height: '100%' }}>
              <Pane
                id="canvas"
                title="Strategy Flow"
                icon={<Workflow size={12} />}
                focused={isFocused('canvas')}
                onToggleFocus={store.toggleFocus}
                actions={
                  <span
                    data-testid="canvas-sync-badge"
                    title="Code → flow recognition status"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: SYNC_BADGE[store.sync.status].color }}
                  >
                    <GitCompare size={11} />
                    <span>{store.sync.codeOnly && store.sync.status !== 'synced' ? 'code_only spans present' : SYNC_BADGE[store.sync.status].text}</span>
                  </span>
                }
              >
                <DesignerCanvas
                  graph={store.graph}
                  client={client}
                  onNodeParams={(id, params) => {
                    void store.updateNodeParams(id, params);
                  }}
                  onError={setNotice}
                />
              </Pane>
            </div>
          </>
        ) : null}

        {/* Right: AI Co-Pilot */}
        {assistantVisible ? (
          <>
            {showSplitters && canvasVisible ? (
              <Splitter ariaLabel="Resize co-pilot pane" onDelta={(delta) => adjustWidth('assistant', delta, true)} />
            ) : null}
            <div style={{ flex: '0 0 auto', width: focus ? '100%' : layout.assistantWidth, minWidth: 0, height: '100%', borderLeft: '1px solid var(--border-subtle, #2a2e39)' }}>
              <Pane
                id="assistant"
                title="AI Co-Pilot"
                icon={<Bot size={12} />}
                focused={isFocused('assistant')}
                onToggleFocus={store.toggleFocus}
                onClose={focus ? undefined : store.togglePane}
              >
                <AiChatColumn
                  messages={store.assistant}
                  currentCode={store.code}
                  status={store.assistantStatus}
                  onPropose={(text) => void store.proposeAI(text, client)}
                  onApply={(idx) => void store.applyProposal(idx)}
                  onDiscard={store.discardProposal}
                  onClear={store.resetAssistant}
                />
              </Pane>
            </div>
          </>
        ) : null}
      </div>

      {/* Bottom drawer: verify / run / sweeps / ops / results */}
      {layout.drawerOpen ? (
        <section
          aria-label="Diagnostics drawer"
          style={{ flex: '0 0 auto', height: 300, display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--border-subtle, #2a2e39)', background: 'var(--bg-app, #131722)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderBottom: '1px solid var(--border-subtle, #2a2e39)', background: 'var(--bg-surface, #1e222d)' }}>
            {(Object.keys(DRAWER_LABELS) as DrawerTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                className={layout.drawerTab === tab ? 'shortlist-btn shortlist-btn-primary' : 'shortlist-btn'}
                onClick={() => store.setDrawer(true, tab)}
                style={{ padding: '3px 10px', fontSize: 11 }}
              >
                {DRAWER_LABELS[tab]}
              </button>
            ))}
            <button
              type="button"
              className="shortlist-btn"
              onClick={() => store.setDrawer(false)}
              style={{ marginLeft: 'auto', padding: '3px 10px', fontSize: 11 }}
            >
              Close
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            {layout.drawerTab === 'verify' ? (
              <VerifyPanel
                verify={store.verify}
                onVerify={() => void store.verifyNow(client)}
                onSelectNode={(nodeId) => {
                  store.selectNode(nodeId);
                  store.setLayout({ focus: 'canvas' });
                }}
              />
            ) : null}
            {layout.drawerTab === 'run' ? (
              <RunPanel
                status={store.run.status}
                runId={store.run.runId}
                response={store.run.response}
                error={store.run.error}
                onRun={(seed) => void store.runNow(client, { seed: seed ?? 42 })}
                onViewResults={() => store.setDrawer(true, 'results')}
              />
            ) : null}
            {layout.drawerTab === 'sweeps' ? <SweepsPanel /> : null}
            {layout.drawerTab === 'ops' ? (
              <OpsPanel
                client={client}
                mode={ops.mode}
                badge={ops.badge().label}
                orders={ops.orders.length}
                onRefresh={() => void ops.refresh(client)}
                onClose={() => void ops.closePositions(client)}
              />
            ) : null}
            {layout.drawerTab === 'results' ? <ResultsPanel response={store.run.response} /> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
};
