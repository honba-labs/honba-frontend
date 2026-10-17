import type { StrategyGraphShape } from '../graph/model';
import type { LayoutStorage } from './layout';

/**
 * Designer -> Simulator hand-off (Phase 1 top bar action; consumed by Phase 6).
 *
 * A graph is far too large for a query string, so the URL carries only the
 * strategy slug and provenance; the graph itself travels in `sessionStorage`.
 * The URL shape matches the existing `/simulator.html?symbol=...` convention.
 */

export const SIMULATOR_HANDOFF_KEY = 'honba.designer.simulator-handoff';

export interface SimulatorHandoff {
  name: string;
  graph: StrategyGraphShape;
  source: 'designer';
  timestamp: number;
}

export function simulatorHandoffUrl(name: string): string {
  return `/simulator.html?strategy=${encodeURIComponent(name)}&source=designer`;
}

/** Best-effort sessionStorage write; returns whether the graph was stashed. */
export function stashHandoff(graph: StrategyGraphShape, storage: LayoutStorage | null = defaultSessionStorage()): boolean {
  if (!storage) return false;
  try {
    const payload: SimulatorHandoff = { name: graph.name, graph, source: 'designer', timestamp: Date.now() };
    storage.setItem(SIMULATOR_HANDOFF_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function takeHandoff(storage: LayoutStorage | null = defaultSessionStorage()): SimulatorHandoff | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SIMULATOR_HANDOFF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SimulatorHandoff;
    if (!parsed || typeof parsed !== 'object' || !parsed.graph || !Array.isArray(parsed.graph.nodes)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function defaultSessionStorage(): LayoutStorage | null {
  try {
    if (typeof window === 'undefined') return null;
    const candidate = (globalThis as { sessionStorage?: LayoutStorage }).sessionStorage;
    if (candidate && typeof candidate.getItem === 'function' && typeof candidate.setItem === 'function') {
      return candidate;
    }
  } catch {
    /* sessionStorage can be unavailable in restricted contexts */
  }
  return null;
}

/**
 * Simulator -> Designer hand-off (Phase 8, the optimisation loop).
 *
 * `[Parameter Sweeps]` opens the Designer's sweeps drawer. The URL carries only
 * the target drawer; the active graph (so the sweep ranges match the run) travels
 * in `sessionStorage`, mirroring the forward hand-off above.
 */

export const DESIGNER_HANDOFF_KEY = 'honba.simulator.designer-handoff';

export type DesignerDrawer = 'verify' | 'run' | 'sweeps' | 'ops' | 'results';

export interface DesignerHandoff {
  name: string;
  graph: StrategyGraphShape;
  source: 'simulator';
  drawer?: DesignerDrawer;
  timestamp: number;
}

export function designerHandoffUrl(drawer: DesignerDrawer = 'sweeps'): string {
  return `/algodesigner.html?drawer=${encodeURIComponent(drawer)}&source=simulator`;
}

/** Best-effort sessionStorage write; returns whether the graph was stashed. */
export function stashDesignerHandoff(
  graph: StrategyGraphShape,
  drawer: DesignerDrawer = 'sweeps',
  storage: LayoutStorage | null = defaultSessionStorage(),
): boolean {
  if (!storage) return false;
  try {
    const payload: DesignerHandoff = { name: graph.name, graph, source: 'simulator', drawer, timestamp: Date.now() };
    storage.setItem(DESIGNER_HANDOFF_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function takeDesignerHandoff(storage: LayoutStorage | null = defaultSessionStorage()): DesignerHandoff | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(DESIGNER_HANDOFF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DesignerHandoff;
    if (!parsed || typeof parsed !== 'object' || !parsed.graph || !Array.isArray(parsed.graph.nodes)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearDesignerHandoff(storage: LayoutStorage | null = defaultSessionStorage()): void {
  if (!storage) return;
  try {
    // The store has no `removeItem`; an empty value parses to `null` in `take`.
    storage.setItem(DESIGNER_HANDOFF_KEY, '');
  } catch {
    /* best-effort */
  }
}
