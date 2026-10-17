import { describe, expect, it } from 'vitest';

import { changedRows, diffStats, unifiedLineDiff } from './code-diff';

describe('unified code diff (Phase 4)', () => {
  it('marks an unchanged document as all same lines', () => {
    const rows = unifiedLineDiff('a\nb\nc\n', 'a\nb\nc\n');
    expect(rows.every((row) => row.kind === 'same')).toBe(true);
    expect(diffStats(rows)).toEqual({ added: 0, removed: 0 });
  });

  it('detects an inserted line with correct new line numbers', () => {
    const rows = unifiedLineDiff('a\nc\n', 'a\nb\nc\n');
    const added = rows.filter((row) => row.kind === 'add');
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ text: 'b', newLine: 2 });
    expect(diffStats(rows)).toEqual({ added: 1, removed: 0 });
  });

  it('detects a changed line as one delete plus one add', () => {
    const rows = unifiedLineDiff('a\nold\nc\n', 'a\nnew\nc\n');
    expect(diffStats(rows)).toEqual({ added: 1, removed: 1 });
    expect(rows.find((row) => row.kind === 'del')?.oldLine).toBe(2);
    expect(rows.find((row) => row.kind === 'add')?.newLine).toBe(2);
  });

  it('treats a trailing newline as insignificant', () => {
    expect(diffStats(unifiedLineDiff('a\nb', 'a\nb\n'))).toEqual({ added: 0, removed: 0 });
  });

  it('keeps only changed rows plus context in the compact view', () => {
    const before = ['1', '2', '3', '4', '5', '6', '7'].join('\n');
    const after = ['1', '2', '3', 'X', '5', '6', '7'].join('\n');
    const compact = changedRows(unifiedLineDiff(before, after), 1);
    // X (del+add) plus one line of context on each side of the change region.
    expect(compact.length).toBeLessThan(7);
    expect(compact.some((row) => row.text === '3')).toBe(true);
    expect(compact.some((row) => row.text === '5')).toBe(true);
  });
});
