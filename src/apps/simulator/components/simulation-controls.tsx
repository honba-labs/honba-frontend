import React, { useState } from 'react';
import { FlaskConical, Play, Search, SlidersHorizontal } from 'lucide-react';

import { SymbolSearchModal } from '../../../components/features/workbench/symbol-search-modal';
import {
  FILL_MODELS,
  PERIOD_PRESETS,
  TIMEFRAMES,
  type PeriodPreset,
} from '../../../core/simulator/controls';
import { useSimulatorStore } from '../store/simulator-store';

/**
 * Simulation controls (Phase 6).
 *
 * Symbol selection reuses the Workbench's shared symbol-search modal. Commission
 * and slippage are captured but flagged as not transmitted, because the run
 * contract carries neither (risk R5) — they are never fabricated onto the wire.
 */
export interface SimulationControlsProps {
  onRun: () => void;
  onSweeps?: () => void;
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color: 'var(--text-muted)',
  marginBottom: 4,
  display: 'block',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-surface-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 6,
  padding: '6px 8px',
  color: 'var(--text-primary)',
  fontSize: 12,
};

const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', marginBottom: 12 };

function NumberField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
}) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="number"
          style={inputStyle}
          value={Number.isFinite(value) ? value : ''}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {suffix ? <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{suffix}</span> : null}
      </div>
    </label>
  );
}

export const SimulationControls: React.FC<SimulationControlsProps> = ({ onRun, onSweeps }) => {
  const { controls, strategyName, origin, run, setControls, plan } = useSimulatorStore();
  const [symbolOpen, setSymbolOpen] = useState(false);
  const issues = plan().issues;
  const busy = run.status === 'running';

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <SlidersHorizontal size={14} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Simulation Controls</span>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>
        Strategy <strong style={{ color: 'var(--text-primary)' }}>{strategyName}</strong>{' '}
        <span style={{ color: 'var(--text-muted)' }}>({origin})</span>
      </div>

      <span style={labelStyle}>Symbol</span>
      <button
        type="button"
        className="shortlist-btn"
        style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, justifyContent: 'flex-start' }}
        onClick={() => setSymbolOpen(true)}
      >
        <Search size={12} />
        {controls.symbol ? `${controls.symbol} (${controls.exchange})` : 'Choose symbol…'}
      </button>

      <label style={fieldStyle}>
        <span style={labelStyle}>Benchmark</span>
        <input
          style={inputStyle}
          value={controls.benchmark}
          onChange={(event) => setControls({ benchmark: event.target.value })}
        />
      </label>

      <span style={labelStyle}>Period</span>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
        {PERIOD_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={controls.period === preset ? 'shortlist-btn shortlist-btn-primary' : 'shortlist-btn'}
            style={{ fontSize: 11, padding: '3px 10px' }}
            onClick={() => setControls({ period: preset as PeriodPreset })}
          >
            {preset}
          </button>
        ))}
      </div>

      {controls.period === 'Custom' ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <label style={{ ...fieldStyle, flex: 1, marginBottom: 0 }}>
            <span style={labelStyle}>Start</span>
            <input
              type="date"
              style={inputStyle}
              value={controls.start ?? ''}
              onChange={(event) => setControls({ start: event.target.value || null })}
            />
          </label>
          <label style={{ ...fieldStyle, flex: 1, marginBottom: 0 }}>
            <span style={labelStyle}>End</span>
            <input
              type="date"
              style={inputStyle}
              value={controls.end ?? ''}
              onChange={(event) => setControls({ end: event.target.value || null })}
            />
          </label>
        </div>
      ) : null}

      <label style={fieldStyle}>
        <span style={labelStyle}>Timeframe</span>
        <select style={inputStyle} value={controls.timeframe} onChange={(event) => setControls({ timeframe: event.target.value })}>
          {(TIMEFRAMES.includes(controls.timeframe) ? TIMEFRAMES : [controls.timeframe, ...TIMEFRAMES]).map((tf) => (
            <option key={tf} value={tf}>
              {tf}
            </option>
          ))}
        </select>
      </label>

      <NumberField label="Initial capital" value={controls.capital} onChange={(capital) => setControls({ capital })} suffix="INR" />

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <NumberField label="Commission" value={controls.commission} onChange={(commission) => setControls({ commission })} />
        </div>
        <div style={{ flex: 1 }}>
          <NumberField label="Slippage" value={controls.slippage} onChange={(slippage) => setControls({ slippage })} suffix="bps" />
        </div>
      </div>

      <label style={fieldStyle}>
        <span style={labelStyle}>Fill model</span>
        <select style={inputStyle} value={controls.fillModel} onChange={(event) => setControls({ fillModel: event.target.value })}>
          {FILL_MODELS.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </label>

      {issues.length > 0 ? (
        <ul style={{ margin: '0 0 12px', paddingLeft: 16, color: 'var(--bearish, #f23645)', fontSize: 11 }}>
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'auto', paddingTop: 12 }}>
        <button
          type="button"
          className="shortlist-btn shortlist-btn-primary"
          disabled={busy || issues.length > 0}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: busy || issues.length > 0 ? 0.6 : 1 }}
          onClick={onRun}
        >
          <Play size={13} />
          {busy ? 'Running…' : 'Run Backtest'}
        </button>
        <button
          type="button"
          className="shortlist-btn"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          onClick={onSweeps}
        >
          <FlaskConical size={13} />
          Parameter Sweeps
        </button>
      </div>

      <SymbolSearchModal
        open={symbolOpen}
        onClose={() => setSymbolOpen(false)}
        currentSymbol={controls.symbol}
        onSelectSymbol={(symbol, exchange) =>
          setControls({ symbol, exchange: exchange ?? controls.exchange })
        }
      />
    </div>
  );
};
