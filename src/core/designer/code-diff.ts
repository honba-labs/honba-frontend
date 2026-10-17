/**
 * Unified line diff for the co-pilot diff cards (Phase 4, HBD-2026-DES-004).
 *
 * Candidate cards show what *would* change against the current generated source
 * (`generateCode(candidate)` vs `generateCode(current)`). This is a small,
 * dependency-free LCS diff so it runs in the browser and is unit tested in node
 * without pulling a diff library into the Designer chunk.
 */

export type DiffKind = 'same' | 'add' | 'del';

export interface DiffRow {
  kind: DiffKind;
  text: string;
  /** 1-based line in the "before" document (absent for additions). */
  oldLine?: number;
  /** 1-based line in the "after" document (absent for deletions). */
  newLine?: number;
}

export interface DiffStats {
  added: number;
  removed: number;
}

/** Above this cell budget the LCS table is skipped for a coarse fallback. */
const MAX_LCS_CELLS = 4_000_000;

function splitLines(text: string): string[] {
  // Trim one trailing newline so `"a\n"` and `"a"` compare equal.
  const normalised = text.endsWith('\n') ? text.slice(0, -1) : text;
  return normalised.length === 0 ? [] : normalised.split('\n');
}

function lcsTable(a: string[], b: string[]): Uint32Array {
  const width = b.length + 1;
  const table = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i * width + j] =
        a[i] === b[j]
          ? table[(i + 1) * width + (j + 1)] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + (j + 1)]);
    }
  }
  return table;
}

/**
 * Line diff between two documents. Returns one row per line, in document order,
 * with `oldLine`/`newLine` numbers so the card can render a two-column gutter.
 */
export function unifiedLineDiff(before: string, after: string): DiffRow[] {
  const a = splitLines(before);
  const b = splitLines(after);

  if (a.length * b.length > MAX_LCS_CELLS) {
    const rows: DiffRow[] = [];
    a.forEach((text, index) => rows.push({ kind: 'del', text, oldLine: index + 1 }));
    b.forEach((text, index) => rows.push({ kind: 'add', text, newLine: index + 1 }));
    return rows;
  }

  const table = lcsTable(a, b);
  const width = b.length + 1;
  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      rows.push({ kind: 'same', text: a[i], oldLine: i + 1, newLine: j + 1 });
      i += 1;
      j += 1;
    } else if (table[(i + 1) * width + j] >= table[i * width + (j + 1)]) {
      rows.push({ kind: 'del', text: a[i], oldLine: i + 1 });
      i += 1;
    } else {
      rows.push({ kind: 'add', text: b[j], newLine: j + 1 });
      j += 1;
    }
  }
  while (i < a.length) {
    rows.push({ kind: 'del', text: a[i], oldLine: i + 1 });
    i += 1;
  }
  while (j < b.length) {
    rows.push({ kind: 'add', text: b[j], newLine: j + 1 });
    j += 1;
  }
  return rows;
}

export function diffStats(rows: ReadonlyArray<DiffRow>): DiffStats {
  let added = 0;
  let removed = 0;
  for (const row of rows) {
    if (row.kind === 'add') added += 1;
    else if (row.kind === 'del') removed += 1;
  }
  return { added, removed };
}

/** Only the changed rows plus a little context, for a compact card. */
export function changedRows(rows: ReadonlyArray<DiffRow>, context = 2): DiffRow[] {
  const keep = new Set<number>();
  rows.forEach((row, index) => {
    if (row.kind === 'same') return;
    for (let k = index - context; k <= index + context; k += 1) {
      if (k >= 0 && k < rows.length) keep.add(k);
    }
  });
  return rows.filter((_, index) => keep.has(index));
}
