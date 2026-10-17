import { describe, expect, it } from 'vitest';

import {
  ASSISTANT_WIDTH_DEFAULT,
  ASSISTANT_WIDTH_MAX,
  ASSISTANT_WIDTH_MIN,
  DEFAULT_LAYOUT,
  LIBRARY_WIDTH_MAX,
  LIBRARY_WIDTH_MIN,
  STORAGE_KEY,
  clampRatio,
  clampWidth,
  isPaneVisible,
  layoutWithFocusToggled,
  layoutWithPaneToggled,
  loadLayout,
  normalizeLayout,
  saveLayout,
  type LayoutStorage,
} from './layout';

function fakeStorage(initial: Record<string, string> = {}): LayoutStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

describe('designer layout helpers (Phase 1)', () => {
  it('clampWidth rounds and bounds to the pane range', () => {
    expect(clampWidth(120, LIBRARY_WIDTH_MIN, LIBRARY_WIDTH_MAX)).toBe(LIBRARY_WIDTH_MIN);
    expect(clampWidth(10_000, LIBRARY_WIDTH_MIN, LIBRARY_WIDTH_MAX)).toBe(LIBRARY_WIDTH_MAX);
    expect(clampWidth(301.6, LIBRARY_WIDTH_MIN, LIBRARY_WIDTH_MAX)).toBe(302);
    expect(clampWidth(Number.NaN, LIBRARY_WIDTH_MIN, LIBRARY_WIDTH_MAX)).toBe(LIBRARY_WIDTH_MIN);
  });

  it('clampRatio keeps the code|canvas split inside its bounds', () => {
    expect(clampRatio(0)).toBe(0.25);
    expect(clampRatio(1)).toBe(0.75);
    expect(clampRatio(0.5)).toBe(0.5);
    expect(clampRatio(Number.POSITIVE_INFINITY)).toBe(0.5);
  });

  it('normalizeLayout clamps sizes, ratios and validates focus/drawer tab', () => {
    const layout = normalizeLayout({
      libraryWidth: 9_999,
      assistantWidth: -50,
      codeRatio: 2,
      focus: 'canvas',
      drawerTab: 'results',
    });
    expect(layout.libraryWidth).toBe(LIBRARY_WIDTH_MAX);
    expect(layout.assistantWidth).toBe(ASSISTANT_WIDTH_MIN);
    expect(layout.codeRatio).toBe(0.75);
    expect(layout.focus).toBe('canvas');
    expect(layout.drawerTab).toBe('results');
  });

  it('normalizeLayout rejects an unknown focus value', () => {
    // A persisted layout from a newer/older build must not break the shell.
    const layout = normalizeLayout({ focus: 'nonsense' as never });
    expect(layout.focus).toBeNull();
  });

  it('toggling a pane opens it and clears a conflicting focus; re-toggling closes it', () => {
    const focused = layoutWithFocusToggled(DEFAULT_LAYOUT, 'library');
    expect(focused.focus).toBe('library');

    // Toggling the library column clears focus and flips its open flag.
    const toggled = layoutWithPaneToggled(focused, 'library');
    expect(toggled.focus).toBeNull();
    expect(toggled.libraryOpen).toBe(true);

    // Toggling again closes it.
    expect(layoutWithPaneToggled(toggled, 'library').libraryOpen).toBe(false);
  });

  it('toggling a permanent pane (code/canvas) toggles focus mode', () => {
    const focused = layoutWithPaneToggled(DEFAULT_LAYOUT, 'canvas');
    expect(focused.focus).toBe('canvas');
    expect(layoutWithPaneToggled(focused, 'canvas').focus).toBeNull();
  });

  it('isPaneVisible honours focus mode over individual pane flags', () => {
    const focused = layoutWithFocusToggled(DEFAULT_LAYOUT, 'code');
    expect(isPaneVisible(focused, 'code')).toBe(true);
    expect(isPaneVisible(focused, 'canvas')).toBe(false);
    expect(isPaneVisible(focused, 'assistant')).toBe(false);
    expect(isPaneVisible(focused, 'library')).toBe(false);
  });

  it('isPaneVisible respects library/assistant visibility when not focused', () => {
    expect(isPaneVisible(DEFAULT_LAYOUT, 'library')).toBe(false);
    expect(isPaneVisible(DEFAULT_LAYOUT, 'assistant')).toBe(true);
    expect(isPaneVisible(DEFAULT_LAYOUT, 'code')).toBe(true);
    expect(isPaneVisible(DEFAULT_LAYOUT, 'canvas')).toBe(true);
  });

  it('saveLayout -> loadLayout round-trips through storage', () => {
    const storage = fakeStorage();
    const custom = normalizeLayout({ libraryOpen: true, libraryWidth: 321, assistantWidth: 400, codeRatio: 0.4 });
    saveLayout(custom, storage);
    expect(storage.data[STORAGE_KEY]).toBeTruthy();
    expect(loadLayout(storage)).toEqual(custom);
  });

  it('loadLayout returns defaults for missing or corrupt storage', () => {
    expect(loadLayout(fakeStorage())).toEqual(DEFAULT_LAYOUT);
    expect(loadLayout(fakeStorage({ [STORAGE_KEY]: '{not json' }))).toEqual(DEFAULT_LAYOUT);
    expect(loadLayout(null)).toEqual(DEFAULT_LAYOUT);
  });

  it('defaultLayoutStorage does not throw in a node environment without localStorage wiring', () => {
    expect(() => loadLayout()).not.toThrow();
  });

  it('loadLayout clamps a persisted out-of-range width', () => {
    const storage = fakeStorage({ [STORAGE_KEY]: JSON.stringify({ assistantWidth: 5_000 }) });
    expect(loadLayout(storage).assistantWidth).toBe(ASSISTANT_WIDTH_MAX);
    expect(loadLayout(storage).libraryWidth).toBe(DEFAULT_LAYOUT.libraryWidth);
  });
});

describe('default layout', () => {
  it('keeps the library collapsed and the co-pilot visible', () => {
    expect(DEFAULT_LAYOUT.libraryOpen).toBe(false);
    expect(DEFAULT_LAYOUT.assistantOpen).toBe(true);
    expect(DEFAULT_LAYOUT.assistantWidth).toBe(ASSISTANT_WIDTH_DEFAULT);
    expect(DEFAULT_LAYOUT.focus).toBeNull();
  });
});
