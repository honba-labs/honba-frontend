import { describe, expect, it } from 'vitest';

import { defaultGraph } from './store';
import { mapNodeLines, nodeLine, spansToMarkers, verifyIssuesToMarkers } from './diagnostics';
import { generateCode } from '../graph/codegen';
import { graphHashSync } from '../graph/model';

describe('editor diagnostics mapping (Phase 2/3)', () => {
  const code = generateCode(defaultGraph(), graphHashSync(defaultGraph()));

  it('locates a node declaration line in the generated source', () => {
    const line = nodeLine(code, 'f');
    expect(line).toBeGreaterThan(0);
    const text = code.split('\n')[(line as number) - 1];
    expect(text).toContain('id="f"');
  });

  it('returns null for a node that is not in the source', () => {
    expect(nodeLine(code, 'does_not_exist')).toBeNull();
  });

  it('maps every graph node to a source line', () => {
    const map = mapNodeLines(code, defaultGraph().nodes.map((n) => n.id));
    expect(Object.keys(map).sort()).toEqual(['c', 'f', 'n1', 'o', 's']);
    for (const line of Object.values(map)) expect(line).toBeGreaterThan(0);
  });

  it('maps verify issues with a located line to error markers on that line', () => {
    const markers = verifyIssuesToMarkers(
      {
        ok: false,
        ir: null,
        issues: [{ code: 'dangling_edge', message: 'Edge joins a missing node', nodeId: 'f', lineno: 12 }],
      },
      code,
    );
    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({ line: 12, severity: 'error', code: 'dangling_edge', nodeId: 'f' });
  });

  it('pins an unlocated issue to line 1 and says so, rather than dropping it', () => {
    const markers = verifyIssuesToMarkers({
      ok: false,
      ir: null,
      issues: [{ code: 'verify_failed', message: 'Transport unreachable', nodeId: null, lineno: null }],
    });
    expect(markers).toHaveLength(1);
    expect(markers[0].line).toBe(1);
    expect(markers[0].message).toMatch(/location not found/i);
  });

  it('maps recogniser spans to warning markers (Phase 3 code_only path)', () => {
    const markers = spansToMarkers([{ start_line: 40, end_line: 44, reason: 'hand-written helper' }]);
    expect(markers[0]).toMatchObject({ line: 40, severity: 'warning', code: 'code_only' });
    expect(markers[0].message).toMatch(/hand-written helper/);
  });

  it('defaults a zero/unknown span line to 1', () => {
    expect(spansToMarkers([{ start_line: 0 }])[0].line).toBe(1);
  });
});
