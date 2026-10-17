import React from 'react';
import {
  FastForward,
  Play,
  Pause,
  RotateCcw,
  StepForward,
  Zap,
  TrendingUp,
  TrendingDown,
  Layers,
  Activity,
} from 'lucide-react';
import type { SimulationEngineState } from '../../../core/simulator/engine/types';

export interface ReplayToolbarProps {
  engineState: SimulationEngineState;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onInstant: () => void;
  onSpeedChange: (speed: number) => void;
  onScrub: (index: number) => void;
  onToggleMultiTimeframe: () => void;
}

const SPEEDS = [1, 5, 10, 25, 50];

export const ReplayToolbar: React.FC<ReplayToolbarProps> = ({
  engineState,
  onPlay,
  onPause,
  onStep,
  onReset,
  onInstant,
  onSpeedChange,
  onScrub,
  onToggleMultiTimeframe,
}) => {
  const isPlaying = engineState.status === 'playing';
  const isCompleted = engineState.status === 'completed';
  const hasBars = engineState.totalBars > 0;
  const progressPct = hasBars ? (engineState.currentBarIndex / (engineState.totalBars - 1)) * 100 : 0;

  const activeBullish = engineState.activeSignals.filter((s) => s.active && s.indication === 'bullish');
  const activeBearish = engineState.activeSignals.filter((s) => s.active && s.indication === 'bearish');

  const pnlColor =
    engineState.unrealizedPnl > 0
      ? 'var(--bullish)'
      : engineState.unrealizedPnl < 0
      ? 'var(--bearish)'
      : 'var(--text-muted)';

  const realizedColor =
    engineState.realizedPnl > 0
      ? 'var(--bullish)'
      : engineState.realizedPnl < 0
      ? 'var(--bearish)'
      : 'var(--text-muted)';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '6px 12px',
        gap: 6,
      }}
    >
      {/* Top row: controls + live P&L + speed */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        {/* Playback buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            type="button"
            className="shortlist-btn shortlist-btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              padding: '4px 10px',
              minWidth: 70,
              justifyContent: 'center',
            }}
            onClick={isPlaying ? onPause : onPlay}
            disabled={!hasBars}
          >
            {isPlaying ? <Pause size={12} /> : <Play size={12} />}
            {isPlaying ? 'Pause' : isCompleted ? 'Replay' : 'Play'}
          </button>

          <button
            type="button"
            className="shortlist-btn"
            style={{ fontSize: 11, padding: '4px 8px' }}
            title="Step 1 Bar forward"
            onClick={onStep}
            disabled={!hasBars || isPlaying}
          >
            <StepForward size={12} />
            <span style={{ marginLeft: 3 }}>Step</span>
          </button>

          <button
            type="button"
            className="shortlist-btn"
            style={{ fontSize: 11, padding: '4px 8px' }}
            title="Rewind to start"
            onClick={onReset}
            disabled={!hasBars}
          >
            <RotateCcw size={12} />
            <span style={{ marginLeft: 3 }}>Reset</span>
          </button>

          <button
            type="button"
            className="shortlist-btn"
            style={{ fontSize: 11, padding: '4px 8px', color: 'var(--accent-gold)' }}
            title="Fast simulate entire dataset to the end"
            onClick={onInstant}
            disabled={!hasBars}
          >
            <Zap size={12} />
            <span style={{ marginLeft: 3 }}>Run to End</span>
          </button>

          {/* Speed Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 8 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginRight: 2 }}>Speed:</span>
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                className={engineState.speed === s ? 'shortlist-btn shortlist-btn-primary' : 'shortlist-btn'}
                style={{ fontSize: 10, padding: '2px 6px' }}
                onClick={() => onSpeedChange(s)}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Multi-Timeframe Toggle */}
          <button
            type="button"
            className={engineState.multiTimeframe ? 'shortlist-btn shortlist-btn-primary' : 'shortlist-btn'}
            style={{ fontSize: 10, padding: '3px 8px', marginLeft: 8, display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={onToggleMultiTimeframe}
            title="Toggle Multi-Chart / Multi-Timeframe Split View"
          >
            <Layers size={11} />
            <span>Multi-Chart {engineState.multiTimeframe ? '(On)' : '(Off)'}</span>
          </button>
        </div>

        {/* Live Active Signal HUD */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
          <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Activity size={12} /> Signals:
          </span>
          {engineState.activeSignals.length === 0 ? (
            <span style={{ color: 'var(--text-muted)' }}>Waiting for bars…</span>
          ) : (
            engineState.activeSignals.map((sig) => (
              <span
                key={sig.id}
                style={{
                  fontSize: 10,
                  padding: '1px 6px',
                  borderRadius: 3,
                  fontWeight: 600,
                  background: sig.active
                    ? sig.indication === 'bullish'
                      ? 'var(--bullish-subtle, rgba(8, 153, 129, 0.2))'
                      : 'var(--bearish-subtle, rgba(242, 54, 69, 0.2))'
                    : 'var(--bg-surface-elevated)',
                  color: sig.active
                    ? sig.indication === 'bullish'
                      ? 'var(--bullish)'
                      : 'var(--bearish)'
                    : 'var(--text-muted)',
                  border: `1px solid ${
                    sig.active
                      ? sig.indication === 'bullish'
                        ? 'rgba(8, 153, 129, 0.4)'
                        : 'rgba(242, 54, 69, 0.4)'
                      : 'var(--border-subtle)'
                  }`,
                }}
                title={sig.details}
              >
                {sig.label}: {sig.active ? (sig.indication === 'bullish' ? '▲ BUY' : '▼ SELL') : '—'}
              </span>
            ))
          )}

          {engineState.lastConfluence && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 4,
                background:
                  engineState.lastConfluence.action === 'buy'
                    ? 'var(--bullish)'
                    : engineState.lastConfluence.action === 'sell'
                    ? 'var(--bearish)'
                    : 'transparent',
                color: engineState.lastConfluence.action !== 'hold' ? '#fff' : 'var(--text-muted)',
              }}
            >
              Confluence: {engineState.lastConfluence.bullishScore}/{engineState.lastConfluence.totalSignals}
            </span>
          )}
        </div>

        {/* Live Sandboxed Portfolio Ticker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11 }}>
          {engineState.activePosition ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: 'var(--accent-subtle)',
                color: 'var(--accent-primary)',
                padding: '2px 8px',
                borderRadius: 4,
                fontWeight: 600,
              }}
            >
              {engineState.activePosition.side.toUpperCase()} {engineState.activePosition.quantity} {engineState.activePosition.symbol} @ ₹{engineState.activePosition.entryPrice.toFixed(2)}
            </span>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Flat (No open position)</span>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ color: 'var(--text-muted)' }}>
              Unrealized: <strong style={{ color: pnlColor }}>₹{engineState.unrealizedPnl >= 0 ? '+' : ''}{engineState.unrealizedPnl.toFixed(2)}</strong>
            </span>
            <span style={{ color: 'var(--text-muted)' }}>
              Realized: <strong style={{ color: realizedColor }}>₹{engineState.realizedPnl >= 0 ? '+' : ''}{engineState.realizedPnl.toFixed(2)}</strong>
            </span>
            <span style={{ color: 'var(--text-muted)' }}>
              Equity: <strong style={{ color: 'var(--text-primary)' }}>₹{engineState.equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Bottom row: Scrubber progress slider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          type="range"
          min={0}
          max={Math.max(0, engineState.totalBars - 1)}
          value={engineState.currentBarIndex}
          onChange={(e) => onScrub(Number(e.target.value))}
          disabled={!hasBars}
          style={{
            flex: 1,
            cursor: hasBars ? 'pointer' : 'default',
            accentColor: 'var(--accent-primary, #2962ff)',
          }}
        />
        <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 100, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          Bar {engineState.currentBarIndex + 1} / {engineState.totalBars} ({progressPct.toFixed(0)}%)
        </span>
      </div>
    </div>
  );
};
