/**
 * Algo Designer workspace layout model (Phase 1, HBD-2026-DES-004).
 *
 * Pure, dependency-free layout state and helpers so the behaviour can be unit
 * tested in a node environment (the vitest config runs `src/**\/*.test.ts` with
 * `environment: 'node'`). The React shell in `apps/algodesigner/workspace-layout.tsx`
 * and the zustand slice in `core/designer/store.ts` both consume this module.
 */

export type DesignerPane = 'library' | 'code' | 'canvas' | 'assistant';

export const DESIGNER_PANES: readonly DesignerPane[] = ['library', 'code', 'canvas', 'assistant'] as const;

export type DrawerTab = 'verify' | 'run' | 'sweeps' | 'ops' | 'results';

export const DRAWER_TABS: readonly DrawerTab[] = ['verify', 'run', 'sweeps', 'ops', 'results'] as const;

export interface DesignerLayout {
  /** Library drawer visibility (collapsed by default so the canvas stays wide). */
  libraryOpen: boolean;
  /** AI Co-Pilot column visibility. */
  assistantOpen: boolean;
  /** When set, only this pane is shown full-width ("focus mode"). */
  focus: DesignerPane | null;
  /** Library drawer width in px. */
  libraryWidth: number;
  /** AI Co-Pilot column width in px. */
  assistantWidth: number;
  /** Share of the code|canvas split given to the code pane, in [0.25, 0.75]. */
  codeRatio: number;
  /** Bottom drawer (verify/run/sweeps/ops/results) visibility. */
  drawerOpen: boolean;
  /** Active bottom-drawer tab. */
  drawerTab: DrawerTab;
}

export const LIBRARY_WIDTH_MIN = 200;
export const LIBRARY_WIDTH_MAX = 480;
export const LIBRARY_WIDTH_DEFAULT = 280;
export const ASSISTANT_WIDTH_MIN = 280;
export const ASSISTANT_WIDTH_MAX = 560;
export const ASSISTANT_WIDTH_DEFAULT = 380;
export const CODE_RATIO_MIN = 0.25;
export const CODE_RATIO_MAX = 0.75;
export const CODE_RATIO_DEFAULT = 0.5;

export const STORAGE_KEY = 'honba.algodesigner.layout';

export const DEFAULT_LAYOUT: DesignerLayout = {
  libraryOpen: false,
  assistantOpen: true,
  focus: null,
  libraryWidth: LIBRARY_WIDTH_DEFAULT,
  assistantWidth: ASSISTANT_WIDTH_DEFAULT,
  codeRatio: CODE_RATIO_DEFAULT,
  drawerOpen: true,
  drawerTab: 'verify',
};

/** Minimal storage shape so tests can inject a fake and node runs stay safe. */
export interface LayoutStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function clampWidth(px: number, min: number, max: number): number {
  if (!Number.isFinite(px)) return min;
  return Math.round(Math.min(max, Math.max(min, px)));
}

export function clampRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return CODE_RATIO_DEFAULT;
  return Math.min(CODE_RATIO_MAX, Math.max(CODE_RATIO_MIN, ratio));
}

/** Normalise an arbitrary patch into a valid layout, clamping sizes/ratios. */
export function normalizeLayout(patch: Partial<DesignerLayout>, base: DesignerLayout = DEFAULT_LAYOUT): DesignerLayout {
  const merged: DesignerLayout = { ...base, ...patch };
  return {
    ...merged,
    libraryWidth: clampWidth(merged.libraryWidth, LIBRARY_WIDTH_MIN, LIBRARY_WIDTH_MAX),
    assistantWidth: clampWidth(merged.assistantWidth, ASSISTANT_WIDTH_MIN, ASSISTANT_WIDTH_MAX),
    codeRatio: clampRatio(merged.codeRatio),
    focus: merged.focus && DESIGNER_PANES.includes(merged.focus) ? merged.focus : null,
    drawerTab: DRAWER_TABS.includes(merged.drawerTab) ? merged.drawerTab : 'verify',
  };
}

/**
 * Toggle a pane from the workspace chrome.
 *
 * - `library` / `assistant` are optional columns: toggling flips their open flag
 *   and clears any focus (a focus mode is a different axis).
 * - `code` / `canvas` are always present: toggling means focus/unfocus them.
 */
export function layoutWithPaneToggled(layout: DesignerLayout, pane: DesignerPane): DesignerLayout {
  if (pane === 'library') return { ...layout, focus: null, libraryOpen: !layout.libraryOpen };
  if (pane === 'assistant') return { ...layout, focus: null, assistantOpen: !layout.assistantOpen };
  return { ...layout, focus: layout.focus === pane ? null : pane };
}

export function layoutWithFocusToggled(layout: DesignerLayout, pane: DesignerPane): DesignerLayout {
  return { ...layout, focus: layout.focus === pane ? null : pane };
}

/** In focus mode only the focused pane renders; otherwise open panes render. */
export function isPaneVisible(layout: DesignerLayout, pane: DesignerPane): boolean {
  if (layout.focus) return layout.focus === pane;
  if (pane === 'library') return layout.libraryOpen;
  if (pane === 'assistant') return layout.assistantOpen;
  return true;
}

export function defaultLayoutStorage(): LayoutStorage | null {
  // Gate on `window` so node (which now exposes a stubbed `localStorage` that
  // emits an experimental warning on access) never touches it.
  try {
    if (typeof window === 'undefined') return null;
    const candidate = (globalThis as { localStorage?: LayoutStorage }).localStorage;
    if (candidate && typeof candidate.getItem === 'function' && typeof candidate.setItem === 'function') {
      return candidate;
    }
  } catch {
    /* access to localStorage can throw under hardened/restricted environments */
  }
  return null;
}

export function loadLayout(storage: LayoutStorage | null = defaultLayoutStorage()): DesignerLayout {
  if (!storage) return { ...DEFAULT_LAYOUT };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_LAYOUT };
    const parsed = JSON.parse(raw) as Partial<DesignerLayout>;
    return normalizeLayout(parsed ?? {});
  } catch {
    return { ...DEFAULT_LAYOUT };
  }
}

export function saveLayout(layout: DesignerLayout, storage: LayoutStorage | null = defaultLayoutStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    /* persistence is best-effort */
  }
}
