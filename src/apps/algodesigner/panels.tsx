import React, { useState } from 'react';

import type { HonbaClient } from '../../core/api/generated/client';
import type { BacktestResponse } from '../../core/types/generated/domain';
import type { AssistantKind } from '../../core/designer/assistant-types';
import { trustBadges } from '../../core/designer/ops';
import type { VerifyState } from '../../core/designer/store';

export const CodePane: React.FC<{ code: string; onChange: (code: string) => void }> = ({ code, onChange }) => (
  <textarea
    aria-label="generated strategy code"
    value={code}
    onChange={(event) => onChange(event.target.value)}
    spellCheck={false}
    style={{
      width: '100%',
      height: '100%',
      fontFamily: 'var(--font-family-mono)',
      fontSize: 12,
      background: 'var(--bg-secondary)',
      color: 'var(--text-primary)',
      border: 'none',
      padding: 16,
      resize: 'none',
    }}
  />
);

export const VerifyPanel: React.FC<{ verify: VerifyState; onVerify: () => void }> = ({ verify, onVerify }) => (
  <div style={{ padding: 16 }}>
    <button className="shortlist-btn shortlist-btn-primary" onClick={onVerify}>Verify</button>
    <div style={{ marginTop: 12, fontSize: 13 }}>
      {verify.ok ? (
        <span style={{ color: 'var(--success, #3fb950)' }}>verified ✓ IR ready</span>
      ) : verify.issues.length === 0 ? (
        <span style={{ color: 'var(--text-muted)' }}>not verified yet</span>
      ) : (
        <ul>
          {verify.issues.map((issue, index) => (
            <li key={index}>
              <code>{issue.code}</code> {issue.message}
              {issue.nodeId ? ` (node ${issue.nodeId}${issue.lineno ? `, line ${issue.lineno}` : ''})` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
);

export const RunPanel: React.FC<{
  status: string;
  runId: string | null;
  response: BacktestResponse | null;
  error: string | null;
  onRun: () => void;
}> = ({ status, runId, response, error, onRun }) => (
  <div style={{ padding: 16 }}>
    <button className="shortlist-btn shortlist-btn-primary" onClick={onRun}>Run</button>
    <div style={{ marginTop: 12, fontSize: 13 }}>
      <div>status: {status}{runId ? ` · ${runId}` : ''}</div>
      {response?.metrics ? (
        <pre style={{ fontSize: 12 }}>{JSON.stringify(response.metrics, null, 2)}</pre>
      ) : null}
      {error ? <div style={{ color: 'var(--danger, #f85149)' }}>{error}</div> : null}
    </div>
  </div>
);

export const AssistantPanel: React.FC<{
  messages: Array<{ kind: AssistantKind; message: string }>;
  onPropose: (text: string) => void;
  onClear: () => void;
}> = ({ messages, onPropose, onClear }) => {
  const [draft, setDraft] = useState('');
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12 }}>
        {messages.map((item, index) => (
          <div key={index} style={{ fontSize: 12, marginBottom: 8 }}>
            <span className="badge" style={{ marginRight: 6 }}>{item.kind}</span>
            {item.message}
          </div>
        ))}
        {messages.length === 0 ? <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>no proposals yet</span> : null}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          aria-label="assistant prompt"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          style={{ flex: 1 }}
        />
        <button
          className="shortlist-btn shortlist-btn-primary"
          onClick={() => {
            if (draft.trim()) {
              onPropose(draft.trim());
              setDraft('');
            }
          }}
        >
          Propose
        </button>
        <button className="shortlist-btn" onClick={onClear}>Clear</button>
      </div>
    </div>
  );
};

interface OpsProps {
  client: HonbaClient;
  mode: string;
  badge: string;
  orders: number;
  onRefresh: () => void;
  onClose: () => void;
}

export const OpsPanel: React.FC<OpsProps> = ({ mode, badge, orders, onRefresh, onClose }) => (
  <div style={{ padding: 16, fontSize: 13 }}>
    <div>
      run mode: <span className="badge">{mode}</span> <span style={{ color: 'var(--text-muted)' }}>{badge}</span>
    </div>
    <div style={{ marginTop: 8 }}>orders: {orders}</div>
    <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
      <button className="shortlist-btn" onClick={onRefresh}>Refresh</button>
      <button className="shortlist-btn" onClick={onClose}>Close all</button>
    </div>
  </div>
);

export const ResultsPanel: React.FC<{ response: BacktestResponse | null }> = ({ response }) => {
  const validation = (response as unknown as { validation?: Record<string, unknown> } | null)?.validation ?? null;
  const badges = trustBadges(validation);
  const assumptions = (response as unknown as { assumptions?: { not_modelled?: string[] } } | null)?.assumptions;
  return (
    <div style={{ padding: 16, fontSize: 13 }}>
      <h3>Trust</h3>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {badges.map((badge) => (
          <span key={badge.key} className="badge">{badge.label}: {badge.passed ? 'pass' : 'fail'}</span>
        ))}
        {badges.length === 0 ? <span style={{ color: 'var(--text-muted)' }}>no validation block</span> : null}
      </div>
      <h3 style={{ marginTop: 12 }}>Not modelled</h3>
      <ul>
        {(assumptions?.not_modelled ?? []).map((name) => (
          <li key={name}><code>{name}</code></li>
        ))}
      </ul>
    </div>
  );
};
