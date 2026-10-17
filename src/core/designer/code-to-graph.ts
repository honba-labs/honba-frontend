import type { StrategyGraphShape, GraphNode, GraphEdge } from '../graph/model';

/**
 * Code -> graph recognition, client-side fast path (Phase 3, HBD-2026-DES-004).
 *
 * Mirrors the semantics of `honba/strategies/graph_recognize.py` (ADR 0029 S3) for
 * the *generated subset*: the `# honba:strategy-graph:v1` marker plus the
 * `GRAPH = _graph.StrategyGraph.build(...)` builder chain. It is the "client-side
 * fast AST parser" from the v1.0 architecture note, so the Flow can update on
 * every keystroke without a round trip; a server-side recogniser can be swapped in
 * later behind the same interface without touching the sync pipeline.
 *
 * Guarantees the pipeline depends on:
 * - A recovered graph is returned only when the builder chain parses.
 * - Anything else is reported as unsupported `spans` (never silently dropped).
 * - Source with no builder block is `codeOnly` with the whole file as one span.
 */

export const GRAPH_MARKER = '# honba:strategy-graph:v1';
export const CLASS_MARKER = '# honba:strategy-graph:generated';

export interface CodeSpan {
  start_line: number;
  end_line: number;
  reason?: string;
}

export interface RecognitionResult {
  graph: StrategyGraphShape | null;
  codeOnly: boolean;
  spans: CodeSpan[];
}

class NotSupported extends Error {}

// --------------------------------------------------------------------------
// Minimal Python literal parser (strings, numbers, bools, None, lists, dicts)
// --------------------------------------------------------------------------

function skipTrivia(text: string, from: number): number {
  let i = from;
  while (i < text.length) {
    const c = text[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i += 1;
    } else if (c === '#') {
      while (i < text.length && text[i] !== '\n') i += 1;
    } else if (c === '\\' && text[i + 1] === '\n') {
      i += 2;
    } else {
      break;
    }
  }
  return i;
}

function parseString(text: string, start: number): { value: string; next: number } {
  const quote = text[start];
  let i = start + 1;
  let out = '';
  while (i < text.length) {
    const c = text[i];
    if (c === '\\') {
      const nxt = text[i + 1];
      const escapes: Record<string, string> = { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"' };
      out += escapes[nxt] ?? nxt;
      i += 2;
      continue;
    }
    if (c === quote) return { value: out, next: i + 1 };
    out += c;
    i += 1;
  }
  throw new NotSupported('unterminated string literal');
}

function parseNumber(text: string, start: number): { value: number; next: number } {
  const match = /^[+-]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?/.exec(text.slice(start));
  if (!match) throw new NotSupported('invalid number literal');
  return { value: Number(match[0]), next: start + match[0].length };
}

function parseLiteral(text: string, from: number): { value: unknown; next: number } {
  let i = skipTrivia(text, from);
  if (i >= text.length) throw new NotSupported('unexpected end of literal');
  const c = text[i];

  if (c === '"' || c === "'") return parseString(text, i);
  if (c === '[') {
    i += 1;
    const items: unknown[] = [];
    i = skipTrivia(text, i);
    while (text[i] !== ']') {
      const item = parseLiteral(text, i);
      items.push(item.value);
      i = skipTrivia(text, item.next);
      if (text[i] === ',') {
        i = skipTrivia(text, i + 1);
      } else if (text[i] !== ']') {
        throw new NotSupported('expected , or ] in list');
      }
    }
    return { value: items, next: i + 1 };
  }
  if (c === '{') {
    i += 1;
    const dict: Record<string, unknown> = {};
    i = skipTrivia(text, i);
    while (text[i] !== '}') {
      const key = parseLiteral(text, i);
      i = skipTrivia(text, key.next);
      if (text[i] !== ':') throw new NotSupported('expected : in dict');
      const value = parseLiteral(text, i + 1);
      dict[String(key.value)] = value.value;
      i = skipTrivia(text, value.next);
      if (text[i] === ',') {
        i = skipTrivia(text, i + 1);
      } else if (text[i] !== '}') {
        throw new NotSupported('expected , or } in dict');
      }
    }
    return { value: dict, next: i + 1 };
  }
  if (c === '-' || c === '+' || (c >= '0' && c <= '9') || (c === '.' && /\d/.test(text[i + 1] ?? ''))) {
    return parseNumber(text, i);
  }
  for (const [word, value] of [['True', true], ['False', false], ['None', null]] as const) {
    if (text.startsWith(word, i)) return { value, next: i + word.length };
  }
  throw new NotSupported(`unexpected token ${JSON.stringify(text.slice(i, i + 12))}`);
}

function isIdentifierStart(c: string): boolean {
  return /[A-Za-z_]/.test(c);
}

/** Parse `key=value, key=value, ...` (builder calls take keyword literals only). */
export function parseKeywordArguments(inner: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  let i = skipTrivia(inner, 0);
  while (i < inner.length) {
    if (!isIdentifierStart(inner[i])) throw new NotSupported(`expected keyword at ${i}`);
    let j = i;
    while (j < inner.length && /[A-Za-z0-9_]/.test(inner[j])) j += 1;
    const key = inner.slice(i, j);
    const afterKey = skipTrivia(inner, j);
    if (inner[afterKey] !== '=') throw new NotSupported('builder calls take keyword arguments only');
    const value = parseLiteral(inner, afterKey + 1);
    out[key] = value.value;
    i = skipTrivia(inner, value.next);
    if (inner[i] === ',') {
      i = skipTrivia(inner, i + 1);
    } else if (i < inner.length) {
      throw new NotSupported(`unexpected trailing input after ${key}`);
    }
  }
  return out;
}

// --------------------------------------------------------------------------
// Builder-chain scanning
// --------------------------------------------------------------------------

/** Index of the parenthesis matching the one at `open`. Skips strings/comments. */
export function findMatchingParen(text: string, open: number): number {
  let depth = 0;
  let i = open;
  while (i < text.length) {
    const c = text[i];
    if (c === '#') {
      while (i < text.length && text[i] !== '\n') i += 1;
      continue;
    }
    if (c === '"' || c === "'") {
      i = parseString(text, i).next;
      continue;
    }
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
    i += 1;
  }
  throw new NotSupported('unbalanced parentheses');
}

/**
 * Line (1-based) of the first unbalanced bracket, or null when balanced.
 * Catches the common "unterminated call" edit that would otherwise look valid.
 */
export function findUnbalancedLine(source: string): number | null {
  const stack: string[] = [];
  let line = 1;
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (c === '\n') {
      line += 1;
      i += 1;
      continue;
    }
    if (c === '#') {
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }
    if (c === '"' || c === "'") {
      try {
        const next = parseString(source, i).next;
        for (let k = i; k < next; k += 1) if (source[k] === '\n') line += 1;
        i = next;
        continue;
      } catch {
        return line;
      }
    }
    if (c === '(' || c === '[' || c === '{') stack.push(c);
    else if (c === ')' || c === ']' || c === '}') {
      if (stack.length === 0) return line;
      stack.pop();
    }
    i += 1;
  }
  if (stack.length > 0) return line;
  return null;
}

const METHOD_RE = /\.(build|with_subscriptions|node|edge)\s*\(/g;

function lineOf(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i += 1) if (source[i] === '\n') line += 1;
  return line;
}

function locateGraphRegion(source: string): { start: number; end: number } | null {
  const match = /^GRAPH\s*=/m.exec(source);
  if (!match) return null;
  const eq = source.indexOf('=', match.index);
  const open = source.indexOf('(', eq);
  if (open === -1) return null;
  const close = findMatchingParen(source, open);
  return { start: eq, end: close + 1 };
}

function buildGraph(
  base: Record<string, unknown>,
  subscriptions: Record<string, unknown>,
  nodes: Array<Record<string, unknown>>,
  edges: Array<Record<string, unknown>>,
): StrategyGraphShape {
  if (typeof base.name !== 'string') throw new NotSupported('build() needs a name');
  if (typeof base.universe !== 'object' || base.universe === null) throw new NotSupported('build() needs a universe');
  if (typeof base.driving_timeframe !== 'object' || base.driving_timeframe === null) {
    throw new NotSupported('build() needs a driving_timeframe');
  }
  if (typeof base.warmup_bars !== 'number') throw new NotSupported('build() needs warmup_bars');

  const graph: StrategyGraphShape = {
    schema_version: 1,
    name: base.name,
    universe: base.universe as StrategyGraphShape['universe'],
    driving_timeframe: base.driving_timeframe as StrategyGraphShape['driving_timeframe'],
    warmup_bars: base.warmup_bars,
    nodes: nodes.map((n) => n as unknown as GraphNode),
    edges: edges.map((e) => e as unknown as GraphEdge),
  };
  if (Object.keys(subscriptions).length > 0) {
    graph.subscriptions = {
      quotes: Boolean(subscriptions.quotes),
      trades: Boolean(subscriptions.trades),
    };
  }
  for (const node of graph.nodes) {
    if (typeof node.id !== 'string' || typeof node.type !== 'string') throw new NotSupported('every node needs id and type');
  }
  for (const edge of graph.edges ?? []) {
    if (typeof edge.id !== 'string' || typeof edge.from_node !== 'string' || typeof edge.to_node !== 'string') {
      throw new NotSupported('every edge needs id/from_node/to_node');
    }
  }
  return graph;
}

function parseBuilder(source: string): StrategyGraphShape {
  const region = locateGraphRegion(source);
  if (!region) throw new NotSupported('no GRAPH assignment');
  const text = source.slice(region.start, region.end);

  let base: Record<string, unknown> | null = null;
  let subscriptions: Record<string, unknown> = {};
  const nodes: Array<Record<string, unknown>> = [];
  const edges: Array<Record<string, unknown>> = [];

  METHOD_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = METHOD_RE.exec(text)) !== null) {
    const open = match.index + match[0].length - 1;
    const close = findMatchingParen(text, open);
    const kwargs = parseKeywordArguments(text.slice(open + 1, close));
    if (match[1] === 'build') {
      if (base) throw new NotSupported('more than one build() call');
      base = kwargs;
    } else if (match[1] === 'with_subscriptions') {
      subscriptions = kwargs;
    } else if (match[1] === 'node') {
      nodes.push(kwargs);
    } else {
      edges.push(kwargs);
    }
    METHOD_RE.lastIndex = close + 1;
  }

  if (!base) throw new NotSupported('no build() call in the builder chain');
  return buildGraph(base, subscriptions, nodes, edges);
}

// --------------------------------------------------------------------------
// Unsupported-span analysis (mirrors graph_recognize's statement walk)
// --------------------------------------------------------------------------

function unsupportedSpans(source: string, regionStartLine: number, regionEndLine: number): CodeSpan[] {
  const lines = source.split('\n');
  const spans: CodeSpan[] = [];
  let inDocstring = false;
  let docstringDelim = '';

  for (let index = 0; index < lines.length; index += 1) {
    const lineNo = index + 1;
    const line = lines[index];
    const trimmed = line.trim();

    if (inDocstring) {
      if (trimmed.includes(docstringDelim)) inDocstring = false;
      continue;
    }
    if (idxIsDocstringStart(trimmed)) {
      const delim = trimmed.startsWith('"""') ? '"""' : "'''";
      if (trimmed.length <= 3 || trimmed.slice(3).includes(delim)) continue;
      inDocstring = true;
      docstringDelim = delim;
      continue;
    }

    if (lineNo >= regionStartLine && lineNo <= regionEndLine) continue; // GRAPH assignment
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    if (/^(import|from)\s/.test(trimmed)) continue;
    if (/^(GRAPH_HASH|GRAPH)\s*=/.test(trimmed)) continue;
    if (/^class\s/.test(trimmed)) {
      // Generated class iff the marker line precedes it.
      if (index > 0 && lines[index - 1].includes(CLASS_MARKER)) continue;
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*\s*=/.test(trimmed) || /^[A-Za-z_][A-Za-z0-9_.]*\s*\(/.test(trimmed) || trimmed.startsWith('@') || /^def\s/.test(trimmed)) {
      if (line.startsWith(' ') || line.startsWith('\t')) continue; // class/function body
    }
    // Indented lines are treated as part of an enclosing (already-classified) block.
    if (line.startsWith(' ') || line.startsWith('\t')) continue;

    spans.push({ start_line: lineNo, end_line: lineNo, reason: 'not captured by the graph' });
  }
  return spans;
}

function idxIsDocstringStart(trimmed: string): boolean {
  return trimmed.startsWith('"""') || trimmed.startsWith("'''");
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

/**
 * A recogniser may be synchronous (the client-side fast path) or asynchronous
 * (a future `POST /strategies/recognize`). Both are accepted by the scheduler.
 */
export type Recognizer = (source: string, signal?: AbortSignal) => RecognitionResult | Promise<RecognitionResult>;

export interface SyncSchedulerOptions {
  recognize: Recognizer;
  /** Called as soon as a keystroke is queued, so the UI can show `pending`. */
  onPending?: () => void;
  onResult: (result: RecognitionResult, source: string) => void;
  onError?: (error: unknown) => void;
  /** Debounce window; the plan specifies 300 ms. */
  debounceMs?: number;
}

export interface SyncScheduler {
  /** Queue a source for recognition after the debounce window. */
  schedule(source: string): void;
  /** Run any queued recognition immediately (used by tests / Ctrl+Enter). */
  flush(): void;
  /** Drop queued work and abort an in-flight recognition (canvas edits win). */
  cancel(): void;
  dispose(): void;
}

/**
 * Debounced, coalescing, cancellable recognition driver (Phase 3).
 *
 * One timer and one `AbortController` at a time: a newer keystroke aborts the
 * in-flight run and restarts the debounce, so the Flow never renders a stale
 * recognition and only the newest source is ever applied. Kept free of store
 * and DOM access so the timing semantics are unit tested with fake timers.
 */
export function createSyncScheduler(opts: SyncSchedulerOptions): SyncScheduler {
  const debounceMs = opts.debounceMs ?? 300;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let controller: AbortController | null = null;
  let queuedSource: string | null = null;
  let inFlight = false;
  let lastApplied: string | null = null;

  async function run(source: string): Promise<void> {
    controller?.abort();
    controller = new AbortController();
    const { signal } = controller;
    inFlight = true;
    try {
      const result = await opts.recognize(source, signal);
      if (signal.aborted) return;
      inFlight = false;
      lastApplied = source;
      opts.onResult(result, source);
    } catch (error) {
      if (signal.aborted) return;
      inFlight = false;
      opts.onError?.(error);
    }
  }

  return {
    schedule(source) {
      if (source === lastApplied && !inFlight) return;
      queuedSource = source;
      if (timer) clearTimeout(timer);
      opts.onPending?.();
      timer = setTimeout(() => {
        timer = null;
        const next = queuedSource;
        queuedSource = null;
        if (next !== null) void run(next);
      }, debounceMs);
    },
    flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      const next = queuedSource;
      queuedSource = null;
      if (next !== null) void run(next);
    },
    cancel() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      queuedSource = null;
      controller?.abort();
      controller = null;
      inFlight = false;
    },
    dispose() {
      this.cancel();
    },
  };
}

export function recognizeGeneratedSource(source: string): RecognitionResult {
  const lines = source.split('\n');
  const lastLine = lines.length || 1;

  const unbalanced = findUnbalancedLine(source);
  if (unbalanced !== null) {
    return { graph: null, codeOnly: false, spans: [{ start_line: unbalanced, end_line: unbalanced, reason: 'syntax_error' }] };
  }

  const hasMarker = source.includes(GRAPH_MARKER);
  if (!hasMarker) {
    return { graph: null, codeOnly: true, spans: [{ start_line: 1, end_line: lastLine, reason: 'no strategy graph builder block' }] };
  }

  const region = locateGraphRegion(source);
  if (!region) {
    return { graph: null, codeOnly: true, spans: [{ start_line: 1, end_line: lastLine, reason: 'no strategy graph builder block' }] };
  }

  let graph: StrategyGraphShape;
  try {
    graph = parseBuilder(source);
  } catch (error) {
    const reason = error instanceof NotSupported ? error.message : 'unsupported builder block';
    const startLine = lineOf(source, region.start);
    const endLine = lineOf(source, region.end);
    return { graph: null, codeOnly: false, spans: [{ start_line: startLine, end_line: endLine, reason }] };
  }

  const spans = unsupportedSpans(source, lineOf(source, region.start), lineOf(source, region.end));
  return { graph, codeOnly: false, spans };
}
