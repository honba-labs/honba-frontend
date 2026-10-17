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
