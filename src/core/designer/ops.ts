import type { ValidationBlock } from '../types/generated/domain';

export type RunMode = 'paper' | 'signal_only' | 'live';

export const RUN_MODES: ReadonlyArray<RunMode> = ['paper', 'signal_only', 'live'] as const;

export interface RunModeBadge {
  mode: RunMode;
  label: string;
  level: 'paper' | 'warning' | 'live';
  blocked: boolean;
  killSwitch: boolean;
}

export function runModeBadge(mode: string, options: { killSwitch?: boolean; approved?: boolean } = {}): RunModeBadge {
  const { killSwitch = false, approved = true } = options;
  if (mode !== 'paper' && mode !== 'signal_only' && mode !== 'live') {
    throw new Error(`unknown run mode '${mode}'`);
  }
  const blocked = mode === 'live' && (killSwitch || !approved);
  const label = mode === 'paper' ? 'Paper' : mode === 'signal_only' ? 'Signal only' : 'Live';
  const level = mode === 'live' ? 'live' : mode === 'signal_only' ? 'warning' : 'paper';
  return { mode, label, level, blocked, killSwitch };
}

export interface TrustBadge {
  key: string;
  label: string;
  passed: boolean;
}

const TRUST_LABELS: Record<string, string> = {
  dsr: 'Deflated Sharpe',
  pbo: 'Prob. backtest overfitting',
  holdout: 'Hold-out',
  walk_forward: 'Walk-forward',
  monte_carlo: 'Monte Carlo',
  cost_stress: 'Cost stress',
};

export function trustBadges(validation: Record<string, unknown> | ValidationBlock | null | undefined): TrustBadge[] {
  if (!validation) return [];
  const rec = validation as Record<string, unknown>;
  const badges: TrustBadge[] = [];
  for (const [key, label] of Object.entries(TRUST_LABELS)) {
    const block = rec[key];
    if (block !== null && typeof block === 'object') {
      badges.push({ key, label, passed: Boolean((block as Record<string, unknown>).passed) });
    }
  }
  return badges;
}

export function drawdownSeries(equity: number[]): number[] {
  const out: number[] = [];
  let peak = Number.NEGATIVE_INFINITY;
  for (const value of equity) {
    peak = Math.max(peak, value);
    out.push(peak <= 0 ? 0 : ((peak - value) / peak) * 100);
  }
  return out;
}

export function equityFromCurve(curve: Array<[number, number]>): { ts: number[]; equity: number[] } {
  return { ts: curve.map(([t]) => t), equity: curve.map(([, e]) => e) };
}

export function maxDrawdownPct(equity: number[]): number {
  const series = drawdownSeries(equity);
  return series.length === 0 ? 0 : Math.max(...series);
}

export function closedRoundTrips(fills: Array<{ quantity: number; side: string }>): number {
  let held = 0;
  let trips = 0;
  for (const fill of fills) {
    const before = held;
    held += fill.side === 'buy' ? fill.quantity : -fill.quantity;
    if (Math.abs(held) <= 1e-9) {
      held = 0;
      if (Math.abs(before) > 1e-9) trips += 1;
    }
  }
  return trips;
}
