import React from 'react';

import { formatMetricValue, type RibbonMetric } from '../../../core/simulator/analytics';

/**
 * Metrics ribbon (Phase 8).
 *
 * Echoes the run payload's wire metrics exactly and shows the *derived* ones
 * (CAGR, Calmar, win rate, profit factor, exposure) tagged as derived, plus an
 * explicit `n/a` for Sortino, which the contract cannot supply. The provenance
 * tag and the tooltip make the difference between a reported and a computed
 * number visible at a glance (risk R5).
 */

const PROVENANCE_STYLE: Record<RibbonMetric['provenance'], { label: string; color: string; background: string }> = {
  wire: { label: 'reported', color: 'var(--text-muted)', background: 'var(--bg-surface, #1e222d)' },
  derived: { label: 'derived', color: 'var(--accent-gold, #f7a600)', background: 'rgba(247, 166, 0, 0.12)' },
  unavailable: { label: 'n/a', color: 'var(--text-muted)', background: 'var(--bg-surface, #1e222d)' },
};

function toneFor(metric: RibbonMetric): string {
  if (metric.provenance === 'unavailable' || metric.value === null) return 'var(--text-muted)';
  if (metric.kind === 'drawdown') return 'var(--bearish, #f23645)';
  if (metric.kind === 'percent' || metric.kind === 'currency') {
    return metric.value >= 0 ? 'var(--bullish, #089981)' : 'var(--bearish, #f23645)';
  }
  return 'var(--text-primary)';
}

export interface MetricsRibbonProps {
  metrics: RibbonMetric[];
}

export const MetricsRibbon: React.FC<MetricsRibbonProps> = ({ metrics }) => {
  return (
    <div
      data-testid="metrics-ribbon"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}
    >
      {metrics.map((metric) => {
        const chip = PROVENANCE_STYLE[metric.provenance];
        return (
          <div
            key={metric.key}
            title={metric.note}
            style={{
              border: '1px solid var(--border-subtle, #2a2e39)',
              borderRadius: 8,
              padding: '8px 10px',
              background: 'var(--bg-surface-elevated, #2a2e39)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              minWidth: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-muted)' }}>
                {metric.label}
              </span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  padding: '0 5px',
                  borderRadius: 8,
                  color: chip.color,
                  background: chip.background,
                  whiteSpace: 'nowrap',
                }}
              >
                {chip.label}
              </span>
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: toneFor(metric),
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatMetricValue(metric.value, metric.kind)}
            </div>
          </div>
        );
      })}
    </div>
  );
};
