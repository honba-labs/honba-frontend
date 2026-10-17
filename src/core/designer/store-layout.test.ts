import { beforeEach, describe, expect, it } from 'vitest';

import { useDesignerStore } from './store';
import { DEFAULT_LAYOUT, LIBRARY_WIDTH_MAX } from './layout';

/**
 * Phase 1 store integration: the layout slice must persist (best-effort) and
 * normalise every mutation, without disturbing the rest of the designer state.
 */
describe('designer store layout slice (Phase 1)', () => {
  beforeEach(() => {
    useDesignerStore.setState({ layout: { ...DEFAULT_LAYOUT } });
  });

  it('starts from the default layout in a node environment', () => {
    expect(useDesignerStore.getState().layout).toEqual(DEFAULT_LAYOUT);
  });

  it('togglePane opens the library drawer and clears focus', () => {
    useDesignerStore.getState().togglePane('library');
    expect(useDesignerStore.getState().layout.libraryOpen).toBe(true);
    expect(useDesignerStore.getState().layout.focus).toBeNull();
  });

  it('toggleFocus switches and clears focus mode', () => {
    useDesignerStore.getState().toggleFocus('canvas');
    expect(useDesignerStore.getState().layout.focus).toBe('canvas');
    useDesignerStore.getState().toggleFocus('canvas');
    expect(useDesignerStore.getState().layout.focus).toBeNull();
  });

  it('setPaneWidth clamps to the pane bounds', () => {
    useDesignerStore.getState().setPaneWidth('library', 9_999);
    expect(useDesignerStore.getState().layout.libraryWidth).toBe(LIBRARY_WIDTH_MAX);
  });

  it('setCodeRatio clamps to the allowed range', () => {
    useDesignerStore.getState().setCodeRatio(5);
    expect(useDesignerStore.getState().layout.codeRatio).toBe(0.75);
  });

  it('setDrawer opens the drawer on a specific tab', () => {
    useDesignerStore.getState().setDrawer(true, 'results');
    expect(useDesignerStore.getState().layout.drawerOpen).toBe(true);
    expect(useDesignerStore.getState().layout.drawerTab).toBe('results');
  });

  it('layout mutations do not touch the graph or code', () => {
    const before = useDesignerStore.getState();
    const graphSnapshot = JSON.stringify(before.graph);
    const codeSnapshot = before.code;
    useDesignerStore.getState().togglePane('assistant');
    useDesignerStore.getState().setLayout({ codeRatio: 0.6 });
    const after = useDesignerStore.getState();
    expect(JSON.stringify(after.graph)).toBe(graphSnapshot);
    expect(after.code).toBe(codeSnapshot);
  });
});
