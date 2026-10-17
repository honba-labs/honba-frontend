import React, { useMemo, useState } from 'react';
import { AlertCircle, Ban, Bot, Check, FileCode, GitBranch, Send, Sparkles, X } from 'lucide-react';

import type { AssistantMessage, GraphDiffSummary } from '../../core/designer/assistant-types';
import { ASSISTANT_PROMPTS, canApply } from '../../core/designer/assistant';
import { changedRows, diffStats, unifiedLineDiff } from '../../core/designer/code-diff';

/**
 * AI Co-Pilot column (Phase 4, HBD-2026-DES-004).
 *
 * Persistent right column: prompt accelerators, a conversation timeline, and
 * actionable **diff cards**. Candidate cards render the graph diff chips plus a
 * unified code diff (`candidate.source` vs the live generated code) and offer
 * Apply (canvas is authoritative) or Discard. Blocked candidates carry an
 * explicit BLOCKED pill and cannot be applied — propose-never-execute (ADR 0029 S5).
 */

export interface AiChatColumnProps {
  messages: AssistantMessage[];
  /** Current generated source, the "before" side of the code diff. */
  currentCode: string;
  status?: 'idle' | 'thinking';
  onPropose: (text: string) => void;
  onApply: (index: number) => void;
  onDiscard: (index: number) => void;
  onClear: () => void;
}

function DecisionBadge({ decision }: { decision: NonNullable<AssistantMessage['decisions']>[number] }) {
  const palette =
    decision.decision === 'approve'
      ? { bg: 'rgba(63, 185, 80, 0.15)', fg: '#3fb950' }
      : decision.decision === 'size_down'
        ? { bg: 'rgba(210, 153, 34, 0.15)', fg: '#d29922' }
        : { bg: 'rgba(248, 81, 73, 0.15)', fg: '#f85149' };
  return (
    <span title={decision.rationale} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 600, background: palette.bg, color: palette.fg }}>
      Risk: {decision.decision.replace('_', ' ').toUpperCase()}
    </span>
  );
}

function DiffChips({ diff }: { diff: GraphDiffSummary }) {
  const chip = (label: string, items: string[], color: string, prefix: string) =>
    items.map((item, index) => (
      <span key={`${label}-${index}`} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, color, background: `${color}22`, border: `1px solid ${color}55` }}>
        {prefix} {item}
      </span>
    ));
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {chip('added', diff.added_nodes, '#3fb950', '+')}
      {chip('modified', diff.modified_nodes, '#d29922', '~')}
      {chip('removed', diff.removed_nodes, '#f85149', '-')}
    </div>
  );
}

function CodeDiff({ before, after }: { before: string; after: string }) {
  const rows = useMemo(() => unifiedLineDiff(before, after), [before, after]);
  const stats = useMemo(() => diffStats(rows), [rows]);
  const visible = useMemo(() => changedRows(rows, 1), [rows]);
  if (stats.added === 0 && stats.removed === 0) {
    return <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No code change.</div>;
  }
  const bg: Record<string, string> = { add: 'rgba(63, 185, 80, 0.12)', del: 'rgba(248, 81, 73, 0.12)', same: 'transparent' };
  const fg: Record<string, string> = { add: '#3fb950', del: '#ff7b72', same: 'var(--text-secondary)' };
  return (
    <div style={{ border: '1px solid var(--border-color, #30363d)', borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 8px', fontSize: 10, background: 'rgba(0,0,0,0.3)', color: 'var(--text-muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <FileCode size={11} /> Unified code diff
        </span>
        <span>
          <span style={{ color: '#3fb950' }}>+{stats.added}</span> <span style={{ color: '#ff7b72' }}>-{stats.removed}</span>
        </span>
      </div>
      <div style={{ maxHeight: 220, overflow: 'auto', fontFamily: 'var(--font-family-mono)', fontSize: 10.5, lineHeight: 1.5 }}>
        {visible.map((row, index) => (
          <div key={index} style={{ display: 'flex', gap: 8, padding: '0 8px', background: bg[row.kind], color: fg[row.kind], whiteSpace: 'pre' }}>
            <span style={{ width: 22, flex: '0 0 auto', textAlign: 'right', opacity: 0.5 }}>{row.oldLine ?? ''}</span>
            <span style={{ width: 22, flex: '0 0 auto', textAlign: 'right', opacity: 0.5 }}>{row.newLine ?? ''}</span>
            <span style={{ flex: '0 0 auto' }}>{row.kind === 'add' ? '+' : row.kind === 'del' ? '-' : ' '}</span>
            <span>{row.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const AiChatColumn: React.FC<AiChatColumnProps> = ({ messages, currentCode, status = 'idle', onPropose, onApply, onDiscard, onClear }) => {
  const [draft, setDraft] = useState('');
  const [applied, setApplied] = useState<number[]>([]);
  const [discarded, setDiscarded] = useState<number[]>([]);

  const submit = (text: string) => {
    const value = text.trim();
    if (!value) return;
    onPropose(value);
    setDraft('');
  };

  const handleApply = (index: number) => {
    onApply(index);
    setApplied((prev) => (prev.includes(index) ? prev : [...prev, index]));
  };

  const handleDiscard = (index: number) => {
    onDiscard(index);
    setDiscarded((prev) => (prev.includes(index) ? prev : [...prev, index]));
  };

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', height: '100%', gap: 10, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color, #30363d)', paddingBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
            <Bot size={16} />
          </span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>AI Strategy Co-Pilot</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Propose-never-execute (ADR 0029 S5)</div>
          </div>
        </div>
        <button type="button" onClick={onClear} className="shortlist-btn" style={{ fontSize: 11, padding: '3px 8px' }}>
          Clear
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {ASSISTANT_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => submit(prompt)}
            className="shortlist-btn"
            style={{ fontSize: 10, padding: '2px 8px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Sparkles size={10} style={{ color: '#38bdf8' }} />
            <span>{prompt}</span>
          </button>
        ))}
      </div>

      <div data-testid="assistant-timeline" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
        {messages.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', marginTop: 30 }}>
            Ask the co-pilot to propose mutations, tune parameters, or add risk filters.
          </div>
        ) : (
          messages.map((item, index) => {
            const isCandidate = item.kind === 'candidate';
            const isBlocked = item.blocked || item.kind === 'validation_error';
            const diffSummary = item.diff && 'added_nodes' in item.diff ? (item.diff as GraphDiffSummary) : null;
            const primary = item.decisions?.[0];
            const applyable = canApply(item);
            const appliedHere = applied.includes(index);
            const discardedHere = discarded.includes(index);

            return (
              <div
                key={index}
                style={{
                  fontSize: 12,
                  padding: 10,
                  borderRadius: 8,
                  background: isBlocked ? 'rgba(248, 81, 73, 0.08)' : isCandidate ? 'rgba(56, 189, 248, 0.06)' : 'var(--bg-secondary, #161b22)',
                  border: `1px solid ${isBlocked ? '#f85149' : isCandidate ? 'rgba(56, 189, 248, 0.3)' : 'var(--border-color, #30363d)'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      className="badge"
                      style={{
                        fontSize: 10,
                        textTransform: 'uppercase',
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: isCandidate ? 'rgba(56, 189, 248, 0.2)' : isBlocked ? 'rgba(248, 81, 73, 0.2)' : 'rgba(139, 148, 158, 0.2)',
                        color: isCandidate ? '#38bdf8' : isBlocked ? '#f85149' : '#8b949e',
                      }}
                    >
                      {item.kind.replace('_', ' ')}
                    </span>
                    {isBlocked ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: '#f85149', border: '1px solid #f85149', borderRadius: 4, padding: '0 5px' }}>
                        <Ban size={10} /> BLOCKED
                      </span>
                    ) : null}
                    {primary ? <DecisionBadge decision={primary} /> : null}
                  </div>
                  {item.timestamp ? <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(item.timestamp).toLocaleTimeString()}</span> : null}
                </div>

                <div style={{ color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1.45 }}>{item.message}</div>

                {item.findings && item.findings.length > 0 ? (
                  <div style={{ marginTop: 6, padding: 8, borderRadius: 6, background: 'rgba(248, 81, 73, 0.12)', border: '1px solid rgba(248, 81, 73, 0.4)' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#f85149', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertCircle size={12} /> Defects (quarantined from execution):
                    </div>
                    {item.findings.map((finding, fi) => (
                      <div key={fi} style={{ fontSize: 11, color: '#ff7b72', display: 'flex', gap: 6 }}>
                        <span>•</span>
                        <span>
                          [{finding.code}] {finding.message}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {diffSummary ? (
                  <div style={{ marginTop: 8, padding: 8, borderRadius: 6, background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color, #30363d)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <GitBranch size={11} /> GRAPH MUTATION
                    </div>
                    <DiffChips diff={diffSummary} />
                    {item.source ? <CodeDiff before={currentCode} after={item.source} /> : null}
                  </div>
                ) : null}

                {isCandidate && item.graph ? (
                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
                    {isBlocked ? (
                      <span style={{ fontSize: 11, color: '#f85149', fontStyle: 'italic' }}>Application blocked by verification guardrail</span>
                    ) : appliedHere ? (
                      <span style={{ fontSize: 11, color: '#3fb950', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Check size={12} /> Applied
                      </span>
                    ) : discardedHere ? (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Discarded</span>
                    ) : (
                      <>
                        <button type="button" onClick={() => handleDiscard(index)} className="shortlist-btn" style={{ fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <X size={12} /> Discard
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApply(index)}
                          disabled={!applyable}
                          className="shortlist-btn shortlist-btn-primary"
                          style={{ fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <Sparkles size={12} /> Apply to Canvas
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })
        )}

        {status === 'thinking' ? (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="assistant-typing" style={{ display: 'inline-flex', gap: 3 }}>
              <span>•</span>
              <span>•</span>
              <span>•</span>
            </span>
            Co-Pilot is thinking…
          </div>
        ) : null}
      </div>

      <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border-color, #30363d)' }}>
        <input
          aria-label="assistant prompt"
          value={draft}
          placeholder="e.g. Add an ATR trailing stop with multiplier 2.5..."
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && draft.trim()) {
              event.preventDefault();
              submit(draft);
            }
          }}
          style={{ flex: 1, background: 'var(--bg-secondary, #0d1117)', border: '1px solid var(--border-color, #30363d)', borderRadius: 6, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 12 }}
        />
        <button type="button" className="shortlist-btn shortlist-btn-primary" onClick={() => submit(draft)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Send size={14} />
          <span>Propose</span>
        </button>
      </div>
    </div>
  );
};
