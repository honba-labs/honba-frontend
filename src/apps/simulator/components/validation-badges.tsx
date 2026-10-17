import React from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';

import type { ValidationBlock } from '../../../core/types/generated/domain';
import { trustBadges } from '../../../core/designer/ops';

/**
 * Trust badges & not-modelled assumptions (Phase 8).
 *
 * Reuses the Designer's `trustBadges` mapping so DSR / PBO / hold-out /
 * walk-forward read identically in both workspaces, and surfaces the payload's
 * `assumptions.not_modelled` list — everything the run did *not* model — rather
 * than quietly dropping it (risk R5).
 */

const DESCRIPTIONS: Record<string, string> = {
  dsr: 'Deflated Sharpe Ratio: corrects for selection bias across multiple trials.',
  pbo: 'Probability of Backtest Overfitting: chance an in-sample winner underperforms out of sample.',
  holdout: 'Hold-out test: an independent out-of-sample partition.',
  walk_forward: 'Walk-forward analysis: rolling out-of-sample validation.',
  monte_carlo: 'Monte Carlo resampling of the trade sequence.',
  cost_stress: 'Cost stress: friction tolerance under multiplied fees/slippage.',
};

export interface ValidationBadgesProps {
  validation?: ValidationBlock | null;
  assumptions?: unknown;
}

function notModelledOf(assumptions: unknown): string[] {
  if (!assumptions || typeof assumptions !== 'object') return [];
  const list = (assumptions as { not_modelled?: unknown }).not_modelled;
  if (!Array.isArray(list)) return [];
  return list.filter((item): item is string => typeof item === 'string');
}

export const ValidationBadges: React.FC<ValidationBadgesProps> = ({ validation, assumptions }) => {
  const badges = trustBadges(validation);
  const notModelled = notModelledOf(assumptions);
  const passed = validation?.passed ?? null;
  const warnings = validation?.warnings ?? [];

  return (
    <div data-testid="validation-badges" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ShieldCheck size={15} style={{ color: passed === false ? 'var(--bearish, #f23645)' : 'var(--accent-primary, #2962ff)' }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Institutional trust</span>
        {passed !== null ? (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '1px 8px',
              borderRadius: 10,
              color: passed ? 'var(--bullish, #089981)' : 'var(--bearish, #f23645)',
              background: passed ? 'rgba(8, 153, 129, 0.15)' : 'rgba(242, 54, 69, 0.15)',
            }}
          >
            {passed ? 'PASS' : 'FAIL'}
          </span>
        ) : null}
      </div>

      {badges.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          The run payload carried no validation block (DSR / PBO / hold-out / walk-forward). Nothing is inferred.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
          {badges.map((badge) => (
            <div
              key={badge.key}
              style={{
                border: `1px solid ${badge.passed ? 'rgba(8, 153, 129, 0.4)' : 'rgba(242, 54, 69, 0.4)'}`,
                borderRadius: 6,
                padding: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                background: 'var(--bg-surface-elevated, #2a2e39)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{badge.label}</span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 10,
                    fontWeight: 600,
                    color: badge.passed ? 'var(--bullish, #089981)' : 'var(--bearish, #f23645)',
                  }}
                >
                  {badge.passed ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                  {badge.passed ? 'PASS' : 'FAIL'}
                </span>
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{DESCRIPTIONS[badge.key] ?? ''}</span>
            </div>
          ))}
        </div>
      )}

      {warnings.length > 0 ? (
        <div style={{ fontSize: 11, color: 'var(--accent-gold, #f7a600)', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {warnings.map((warning, index) => (
            <span key={`${index}-${warning}`}>⚠ {warning}</span>
          ))}
        </div>
      ) : null}

      <div style={{ borderTop: '1px solid var(--border-subtle, #2a2e39)', paddingTop: 8 }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-muted)', marginBottom: 4 }}>
          Not modelled
        </div>
        {notModelled.length === 0 ? (
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            The payload listed no unmodelled assumptions.
          </span>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {notModelled.map((item) => (
              <span
                key={item}
                style={{
                  fontSize: 11,
                  padding: '1px 8px',
                  borderRadius: 10,
                  color: 'var(--accent-gold, #f7a600)',
                  background: 'rgba(247, 166, 0, 0.12)',
                }}
              >
                {item}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
