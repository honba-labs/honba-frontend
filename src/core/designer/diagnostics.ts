import type { VerifyState } from './store';

/**
 * Diagnostics mapping for the Python editor (Phase 2/3, HBD-2026-DES-004).
 *
 * Turns verifier issues and code-recognition spans into editor markers, and maps
 * node ids to generated-source lines so the editor and the canvas can navigate
 * each other. All pure so the mapping is unit tested without a DOM.
 */

export type MarkerSeverity = 'error' | 'warning' | 'info';

export interface EditorMarker {
  /** 1-based line number. */
  line: number;
  severity: MarkerSeverity;
  message: string;
  code?: string;
  /** Node this marker belongs to, when known. */
  nodeId?: string | null;
}

/**
 * Find the generated-source line that declares a graph node. `generateCode`
 * emits node ids through `JSON.stringify`, i.e. `id="f"`; accept single quotes
 * too so hand-edited modules are still located.
 */
export function nodeLine(source: string, nodeId: string): number | null {
  const lines = source.split('\n');
  const doubleQuoted = `id=${JSON.stringify(nodeId)}`;
  const singleQuoted = `id='${nodeId}'`;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('.node(') && (lines[i].includes(doubleQuoted) || lines[i].includes(singleQuoted))) {
      return i + 1;
    }
  }
  return null;
}

export function mapNodeLines(source: string, nodeIds: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of nodeIds) {
    const line = nodeLine(source, id);
    if (line !== null) out[id] = line;
  }
  return out;
}

/**
 * Map verifier issues to editor markers.
 *
 * Issues carry a `lineno` when the store could locate the node in the generated
 * source; when it could not, the marker is pinned to line 1 with a `(unlocated)`
 * hint rather than being dropped, so nothing is silently hidden.
 */
export function verifyIssuesToMarkers(verify: VerifyState, _code?: string): EditorMarker[] {
  return verify.issues.map((issue) => ({
    line: issue.lineno && issue.lineno > 0 ? issue.lineno : 1,
    severity: 'error',
    message: issue.lineno ? issue.message : `${issue.message} (location not found in generated source)`,
    code: issue.code,
    nodeId: issue.nodeId,
  }));
}

/**
 * Map unrecognised code spans (Phase 3 `code_only` / syntax errors) to markers.
 * Kept here so both verifier issues and recognition spans share one marker type.
 */
export function spansToMarkers(
  spans: ReadonlyArray<{ start_line: number; end_line?: number; reason?: string }>,
): EditorMarker[] {
  return spans.map((span) => ({
    line: span.start_line > 0 ? span.start_line : 1,
    severity: 'warning',
    message: span.reason ? `Recogniser could not capture this span: ${span.reason}` : 'Recogniser could not capture this span',
    code: 'code_only',
    nodeId: null,
  }));
}
