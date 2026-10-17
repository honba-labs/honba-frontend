import { defaultLayoutStorage, type LayoutStorage } from '../designer/layout';

import { DEFAULT_CONTROLS, type SimulatorControls } from './controls';
import type { SelectionOrigin } from './select';

/**
 * Simulator selection persistence (Phase 6).
 *
 * A reload of `/simulator.html` carries no query string, so the last selection
 * is stashed locally and restored on boot (acceptance: "reload preserves the
 * last run selection"). Storage is best-effort, mirroring the Designer layout
 * and library slices.
 */

export const SIMULATOR_STORAGE_KEY = 'honba.simulator.selection';

export interface SimulatorPersisted {
  strategyName: string;
  source: SelectionOrigin;
  controls: SimulatorControls;
}

export function loadPersisted(storage: LayoutStorage | null = defaultLayoutStorage()): SimulatorPersisted | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SIMULATOR_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SimulatorPersisted> | null;
    if (!parsed || typeof parsed.strategyName !== 'string' || parsed.strategyName.length === 0) return null;
    return {
      strategyName: parsed.strategyName,
      source: parsed.source ?? 'template',
      controls: { ...DEFAULT_CONTROLS, ...(parsed.controls ?? {}) },
    };
  } catch {
    return null;
  }
}

export function persistSelection(
  selection: SimulatorPersisted,
  storage: LayoutStorage | null = defaultLayoutStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(SIMULATOR_STORAGE_KEY, JSON.stringify(selection));
  } catch {
    /* persistence is best-effort */
  }
}
