import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, ScrollText } from 'lucide-react';

import {
  collectRunLog,
  hasEventStream,
  initialRunLog,
  type EventStreamClient,
  type RunLogState,
} from '../../../core/simulator/events';

/**
 * Run log & events drawer (Phase 8, ADR 0021).
 *
 * The poll loop already leaves a progress log; on top of it this drawer tails
 * `GET /backtests/{id}/events` (SSE) when the client exposes the route, folding
 * frames into compact lines. A client without the route simply shows the poll
 * log — the drawer never blocks on the stream (risk: a missing route must not
 * break the bench).
 */

export interface RunLogDrawerProps {
  client?: EventStreamClient | null;
  runId?: string | null;
  status: string;
  /** Progress lines already gathered by the poll loop. */
  pollLines: string[];
  defaultOpen?: boolean;
}

export const RunLogDrawer: React.FC<RunLogDrawerProps> = ({ client, runId, status, pollLines, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  const [live, setLive] = useState<RunLogState>(initialRunLog());
  const [streaming, setStreaming] = useState(false);

  const streamable = Boolean(runId) && hasEventStream(client);

  useEffect(() => {
    setLive(initialRunLog());
    if (!open || !runId || !hasEventStream(client)) return;
    const controller = new AbortController();
    setStreaming(true);
    void collectRunLog(client, runId, {
      signal: controller.signal,
      maxFrames: 500,
      onState: (state) => setLive(state),
    }).finally(() => {
      if (!controller.signal.aborted) setStreaming(false);
    });
    return () => controller.abort();
  }, [open, runId, client, status]);

  const lines = [...pollLines, ...live.lines];

  return (
    <div data-testid="run-log-drawer" style={{ border: '1px solid var(--border-subtle, #2a2e39)', borderRadius: 6 }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '6px 10px',
          boxSizing: 'border-box',
          fontSize: 11,
          color: 'var(--text-secondary)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <ScrollText size={12} />
          Run log &amp; events
          <span style={{ color: 'var(--text-muted)' }}>({lines.length})</span>
        </span>
        <span style={{ fontSize: 10, color: streaming ? 'var(--accent-primary, #2962ff)' : 'var(--text-muted)' }}>
          {streamable ? (streaming ? 'streaming…' : 'SSE') : 'poll only'}
        </span>
      </button>

      {open ? (
        <div
          style={{
            maxHeight: 220,
            overflowY: 'auto',
            padding: '6px 10px 10px',
            fontFamily: 'var(--font-family-mono, monospace)',
            fontSize: 11,
            color: 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {lines.length === 0 ? (
            <span style={{ color: 'var(--text-muted)' }}>No run activity yet.</span>
          ) : (
            lines.map((line, index) => (
              <span key={`${index}-${line}`} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {line}
              </span>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
};
