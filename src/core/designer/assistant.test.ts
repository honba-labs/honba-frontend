import { describe, expect, it } from 'vitest';

import { defaultGraph } from './store';
import type { AssistantMessage } from './assistant-types';
import { ASSISTANT_PROMPTS, assistantContext, canApply, hasAssistantPropose, runSummary, toAssistantMessage } from './assistant';

describe('AI co-pilot client helpers (Phase 4)', () => {
  it('exposes the five prompt accelerators', () => {
    expect(ASSISTANT_PROMPTS).toHaveLength(5);
    expect(ASSISTANT_PROMPTS[0]).toMatch(/ATR trailing stop/i);
  });

  it('maps a candidate response and allows apply', () => {
    const msg = toAssistantMessage({
      kind: 'candidate',
      message: 'add an ATR risk node',
      graph: defaultGraph(),
      decisions: [{ orderId: 'o', decision: 'approve', rationale: 'ok' }],
    });
    expect(msg.kind).toBe('candidate');
    expect(msg.blocked).toBe(false);
    expect(canApply(msg)).toBe(true);
  });

  it('quarantines a validation_error even without a blocked flag', () => {
    const msg = toAssistantMessage({
      kind: 'validation_error',
      message: 'unknown indicator',
      findings: [{ code: 'unknown_indicator', message: 'no such indicator' }],
    });
    expect(msg.blocked).toBe(true);
    expect(canApply(msg)).toBe(false);
  });

  it('quarantines a candidate that arrives with findings (defensive)', () => {
    const msg = toAssistantMessage({
      kind: 'candidate',
      message: 'sneaky',
      graph: defaultGraph(),
      findings: [{ code: 'x', message: 'y' }],
    });
    expect(msg.blocked).toBe(true);
    expect(canApply(msg)).toBe(false);
  });

  it('feature-detects the backend assistant method', () => {
    expect(hasAssistantPropose({})).toBe(false);
    expect(hasAssistantPropose(undefined)).toBe(false);
    expect(hasAssistantPropose({ postAssistantPropose: () => Promise.resolve({}) })).toBe(true);
  });

  it('trims conversational context to the last N messages', () => {
    const messages: AssistantMessage[] = Array.from({ length: 10 }, (_, i) => ({
      kind: 'discussion',
      message: `m${i}`,
      blocked: false,
    }));
    const context = assistantContext({ graph: defaultGraph(), source: 'x', messages, maxMessages: 3 });
    expect(context?.messages?.map((m) => m.message)).toEqual(['m7', 'm8', 'm9']);
  });

  it('summarises a completed run as derived metrics', () => {
    expect(runSummary(null)).toBeNull();
    expect(runSummary({ run_id: 'r1', metrics: { sharpe: 1.5, max_drawdown: 0.12 } })).toEqual({
      run_id: 'r1',
      sharpe: 1.5,
      max_drawdown_pct: 12,
    });
  });
});
