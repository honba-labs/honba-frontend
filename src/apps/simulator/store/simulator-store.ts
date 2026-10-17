import { create } from 'zustand';

import { takeHandoff, type SimulatorHandoff } from '../../../core/designer/handoff';
import { loadSaved, slugify, type SavedStrategyManifest } from '../../../core/designer/library-store';
import type { StrategyGraphShape } from '../../../core/graph/model';
import { compileStrategy } from '../../../core/designer/compile';
import { DEFAULT_CONTROLS, toBacktestRequest, type SimulatorControls, type SimulationRequestPlan } from '../../../core/simulator/controls';
import {
  applyJournalLoading,
  hasJournalClient,
  initialJournalState,
  loadJournal,
  type JournalClient,
  type JournalState,
} from '../../../core/simulator/journal';
import { loadPersisted, persistSelection } from '../../../core/simulator/persistence';
import { initialRunState, runBacktest, type RunClient, type RunOptions, type SimRunState } from '../../../core/simulator/run';
import {
  controlsForGraph,
  graphIsRunnable,
  resolveSelection,
  toParams,
  universeString,
  type SelectionOrigin,
} from '../../../core/simulator/select';

/**
 * Simulator workspace state (Phase 6).
 *
 * Owns the active strategy, the control panel, and the run lifecycle. The pure
 * logic (selection, payload mapping, polling) lives in `core/simulator/*`; this
 * slice is the thin zustand binding the app and its components share.
 */

export interface SimulatorHydrateInput {
  query?: string;
  handoff?: SimulatorHandoff | null;
  saved?: ReadonlyArray<SavedStrategyManifest>;
}

export interface SimulatorState {
  strategy: StrategyGraphShape;
  strategyName: string;
  origin: SelectionOrigin;
  controls: SimulatorControls;
  run: SimRunState;
  /** Journal fills of the last completed run (Phase 7); the chart pairs them into round trips. */
  journal: JournalState;
  /** The last built request plan, for the payload preview and the R5 note. */
  lastPlan: SimulationRequestPlan | null;
  hydrate: (input?: SimulatorHydrateInput) => void;
  setControls: (patch: Partial<SimulatorControls>) => void;
  select: (graph: StrategyGraphShape, name: string, origin?: SelectionOrigin) => void;
  plan: () => SimulationRequestPlan;
  execute: (client: RunClient & Partial<JournalClient>, options?: RunOptions) => Promise<void>;
  resetRun: () => void;
}

function defaultQuery(): string {
  try {
    return typeof location !== 'undefined' ? location.search : '';
  } catch {
    return '';
  }
}

function initialState(): Pick<
  SimulatorState,
  'strategy' | 'strategyName' | 'origin' | 'controls' | 'run' | 'journal' | 'lastPlan'
> {
  const selection = resolveSelection({});
  return {
    strategy: selection.graph,
    strategyName: selection.name,
    origin: selection.origin,
    controls: controlsForGraph(selection.graph),
    run: initialRunState(),
    journal: initialJournalState(),
    lastPlan: null,
  };
}

export function createSimulatorStore() {
  return create<SimulatorState>((set, get) => ({
    ...initialState(),

    hydrate: (input = {}) => {
      const query = input.query ?? defaultQuery();
      const handoff = input.handoff !== undefined ? input.handoff : takeHandoff();
      const saved = input.saved ?? loadSaved();
      const persisted = loadPersisted();
      const params = toParams(query);
      const explicit = Boolean(params.get('strategy')) || Boolean(handoff);

      // A plain reload (no query, no hand-off) restores the last selection when
      // that strategy is still in the Library.
      if (!explicit && persisted) {
        const match = saved.find(
          (manifest) => manifest.id === persisted.strategyName || slugify(manifest.name) === slugify(persisted.strategyName),
        );
        if (match && graphIsRunnable(match.graph)) {
          set({
            strategy: match.graph,
            strategyName: match.name,
            origin: 'library',
            controls: { ...persisted.controls },
          });
          return;
        }
      }

      const selection = resolveSelection({ query, handoff, saved });
      const base = !explicit && persisted ? persisted.controls : DEFAULT_CONTROLS;
      const controls = controlsForGraph(selection.graph, base);
      set({ strategy: selection.graph, strategyName: selection.name, origin: selection.origin, controls });
      persistSelection({ strategyName: selection.name, source: selection.origin, controls });
    },

    setControls: (patch) => set({ controls: { ...get().controls, ...patch } }),

    select: (graph, name, origin = 'library') => {
      const controls = controlsForGraph(graph, get().controls);
      set({ strategy: graph, strategyName: name, origin, controls });
      persistSelection({ strategyName: name, source: origin, controls });
    },

    plan: () => {
      const { controls, strategy, strategyName } = get();
      return toBacktestRequest(controls, { strategy: strategyName, universe: universeString(strategy, controls) });
    },

    execute: async (client, options) => {
      const { strategy } = get();
      const plan = get().plan();
      // A fresh attempt clears the previous run's journal so stale markers never
      // outlive the run they describe.
      set({ lastPlan: plan, journal: initialJournalState() });
      if (plan.issues.length > 0) {
        set({
          run: {
            ...initialRunState(),
            status: 'failed',
            error: plan.issues.join(' '),
            logs: plan.issues.map((issue) => `Blocked: ${issue}`),
          },
        });
        return;
      }
      set({ run: { ...initialRunState(), status: 'running', logs: ['Compiling the strategy…'] } });

      // Compile-before-run: a run resolves `strategy` against the compiled-session
      // catalogue or the registered Rust strategies, so the graph is registered
      // first and the run is submitted with the compiled id (§8.2 contract gap).
      const compiled = await compileStrategy(client, strategy, { signal: options?.signal });
      if (compiled.error) {
        set({
          run: {
            ...initialRunState(),
            status: 'failed',
            error: `Compile failed: ${compiled.error}`,
            logs: [`Compile failed: ${compiled.error}`],
          },
        });
        return;
      }

      const final = await runBacktest(client, { ...plan.request, strategy: compiled.strategyId }, {
        ...options,
        onUpdate: (state) => set({ run: state }),
      });
      set({ run: final });

      // Journal fills are the marker source (Phase 7). They are fetched only for
      // a completed run, and only when the client exposes the route; a missing
      // route degrades to an empty journal the chart renders without markers.
      if (final.status === 'completed' && final.runId && hasJournalClient(client)) {
        const runId = final.runId;
        set({ journal: applyJournalLoading(initialJournalState(), runId) });
        const journal = await loadJournal(client, runId, { signal: options?.signal });
        if (get().run.runId === runId) set({ journal });
      }

      persistSelection({ strategyName: get().strategyName, source: get().origin, controls: get().controls });
    },

    resetRun: () => set({ run: initialRunState(), journal: initialJournalState(), lastPlan: null }),
  }));
}

export const useSimulatorStore = createSimulatorStore();
