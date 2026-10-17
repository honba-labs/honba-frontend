import React, { useState } from 'react';
import { FlaskConical, Play, Search, SlidersHorizontal } from 'lucide-react';

import { SymbolSearchModal } from '../../../components/features/workbench/symbol-search-modal';
import {
  FILL_MODELS,
  FILL_MODEL_DESCRIPTORS,
  PERIOD_PRESETS,
  TIMEFRAMES,
  formatTimeframe,
  presetRange,
  resolveRange,
  type PeriodPreset,
} from '../../../core/simulator/controls';
import { useSimulatorStore } from '../store/simulator-store';

/**
 * Simulation controls (Phase 6).
 *
 * Symbol selection reuses the Workbench's shared symbol-search modal. Commission
 * (flat, per fill) and slippage (adverse, basis points) are transmitted as the
 * `commission_per_fill` / `slippage_bps` request fields `honba-api` resolves in
 * Phase 6; any control without a wire field is surfaced as not modelled rather
 * than fabricated (risk R5).
 */
import { getSandboxAccounts } from '../../../core/simulator/engine/portfolio-adapter';

export interface SimulationControlsProps {
  onRun: () => void;
  onSweeps?: () => void;
  selectedAccountId?: string;
  onSelectAccount?: (accountId: string) => void;
  multiTimeframe?: boolean;
  secondaryTimeframe?: string;
  onToggleMultiTf?: (enabled: boolean, tf: string) => void;
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

export const SimulationControls: React.FC<SimulationControlsProps> = ({
  onRun,
  onSweeps,
  selectedAccountId = 'acc-sandbox-primary',
  onSelectAccount,
  multiTimeframe = false,
  secondaryTimeframe = '1h',
  onToggleMultiTf,
}) => {
  const { controls, strategyName, origin, run, setControls, plan } = useSimulatorStore();
  const [symbolOpen, setSymbolOpen] = useState(false);
  const [portfolioAccountId, setPortfolioAccountId] = useState(selectedAccountId);
  const [multiTf, setMultiTf] = useState(multiTimeframe);
  const [secTf, setSecTf] = useState(secondaryTimeframe);
  const sandboxAccounts = getSandboxAccounts();
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

      {/* Date Range Section */}
      {(() => {
        const effectiveRange = resolveRange(controls);
        const startDate = controls.start || effectiveRange.start;
        const endDate = controls.end || effectiveRange.end;

        return (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={labelStyle}>Date Range</span>
              <span style={{ fontSize: 10, color: 'var(--accent-primary, #4f8cff)', fontWeight: 600 }}>
                {controls.period !== 'Custom' ? `${controls.period} Active` : 'Custom Range'}
              </span>
            </div>

            {/* Quick Presets */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
              {PERIOD_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={controls.period === preset ? 'shortlist-btn shortlist-btn-primary' : 'shortlist-btn'}
                  style={{ fontSize: 10, padding: '2px 8px' }}
                  onClick={() => {
                    if (preset === 'Custom') {
                      setControls({ period: 'Custom', start: startDate, end: endDate });
                    } else {
                      const range = presetRange(preset, new Date());
                      setControls({ period: preset, start: range.start, end: range.end });
                    }
                  }}
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Always Editable Start & End Date Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                  Start Date
                </span>
                <input
                  type="date"
                  style={inputStyle}
                  value={startDate}
                  onChange={(event) => {
                    const val = event.target.value;
                    setControls({ period: 'Custom', start: val || null, end: endDate });
                  }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                  End Date
                </span>
                <input
                  type="date"
                  style={inputStyle}
                  value={endDate}
                  onChange={(event) => {
                    const val = event.target.value;
                    setControls({ period: 'Custom', start: startDate, end: val || null });
                  }}
                />
              </label>
            </div>
          </div>
        );
      })()}

      {/* Timeframe Section */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={labelStyle}>Timeframe</span>
          <span style={{ fontSize: 10, color: 'var(--accent-gold, #f7a600)', fontWeight: 600 }}>
            {formatTimeframe(controls.timeframe)}
          </span>
        </div>

        {/* Quick Chips for Popular Timeframes */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
          {['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1mo'].map((tf) => (
            <button
              key={tf}
              type="button"
              className={controls.timeframe === tf ? 'shortlist-btn shortlist-btn-primary' : 'shortlist-btn'}
              style={{ fontSize: 10, padding: '2px 7px' }}
              onClick={() => setControls({ timeframe: tf })}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Full Grouped Timeframe Select */}
        <select
          style={inputStyle}
          value={controls.timeframe}
          onChange={(event) => setControls({ timeframe: event.target.value })}
        >
          <optgroup label="Minutes">
            <option value="1m">1m (1 Minute)</option>
            <option value="2m">2m (2 Minutes)</option>
            <option value="3m">3m (3 Minutes)</option>
            <option value="5m">5m (5 Minutes)</option>
            <option value="10m">10m (10 Minutes)</option>
            <option value="15m">15m (15 Minutes)</option>
            <option value="30m">30m (30 Minutes)</option>
            <option value="45m">45m (45 Minutes)</option>
          </optgroup>
          <optgroup label="Hours">
            <option value="1h">1h (1 Hour)</option>
            <option value="2h">2h (2 Hours)</option>
            <option value="3h">3h (3 Hours)</option>
            <option value="4h">4h (4 Hours)</option>
          </optgroup>
          <optgroup label="Daily / Weekly / Monthly">
            <option value="1d">1d (1 Day - Daily)</option>
            <option value="1w">1w (1 Week - Weekly)</option>
            <option value="1mo">1mo (1 Month - Monthly)</option>
          </optgroup>
        </select>
      </div>

      <NumberField label="Initial capital" value={controls.capital} onChange={(capital) => setControls({ capital })} suffix="INR" />

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <NumberField label="Commission / fill" value={controls.commission} onChange={(commission) => setControls({ commission })} />
        </div>
        <div style={{ flex: 1 }}>
          <NumberField label="Slippage" value={controls.slippage} onChange={(slippage) => setControls({ slippage })} suffix="bps" />
        </div>
      </div>

      <label style={fieldStyle}>
        <span style={labelStyle}>Sandboxed Portfolio</span>
        <select
          style={inputStyle}
          value={portfolioAccountId}
          onChange={(event) => {
            setPortfolioAccountId(event.target.value);
            onSelectAccount?.(event.target.value);
          }}
        >
          {sandboxAccounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name} ({acc.mode})
            </option>
          ))}
        </select>
      </label>

      <div style={{ ...fieldStyle, border: '1px solid var(--border-subtle)', padding: 8, borderRadius: 6, background: 'var(--bg-surface-elevated)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: multiTf ? 6 : 0 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>Multi-Chart Sync</span>
          <input
            type="checkbox"
            checked={multiTf}
            onChange={(e) => {
              setMultiTf(e.target.checked);
              onToggleMultiTf?.(e.target.checked, secTf);
            }}
            style={{ cursor: 'pointer' }}
          />
        </div>
        {multiTf && (
          <div>
            <span style={labelStyle}>Higher Timeframe</span>
            <select
              style={{ ...inputStyle, padding: '4px 6px' }}
              value={secTf}
              onChange={(e) => {
                setSecTf(e.target.value);
                onToggleMultiTf?.(true, e.target.value);
              }}
            >
              <optgroup label="Intraday / Hours">
                <option value="15m">15 Minutes</option>
                <option value="30m">30 Minutes</option>
                <option value="1h">1 Hour</option>
                <option value="2h">2 Hours</option>
                <option value="4h">4 Hours</option>
              </optgroup>
              <optgroup label="Daily / Weekly / Monthly">
                <option value="1d">1 Day (Daily)</option>
                <option value="1w">1 Week (Weekly)</option>
                <option value="1mo">1 Month (Monthly)</option>
              </optgroup>
            </select>
          </div>
        )}
      </div>

      <label style={fieldStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={labelStyle}>Fill model</span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: '1px 5px',
              borderRadius: 3,
              background: 'var(--accent-subtle)',
              color: 'var(--accent-primary)',
            }}
          >
            {FILL_MODEL_DESCRIPTORS[controls.fillModel]?.badge ?? 'Execution'}
          </span>
        </div>
        <select
          style={inputStyle}
          value={controls.fillModel}
          onChange={(event) => setControls({ fillModel: event.target.value })}
        >
          {FILL_MODELS.map((model) => {
            const desc = FILL_MODEL_DESCRIPTORS[model];
            return (
              <option key={model} value={model}>
                {desc ? `${desc.label} (${desc.badge})` : model}
              </option>
            );
          })}
        </select>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.3 }}>
          {FILL_MODEL_DESCRIPTORS[controls.fillModel]?.description ?? 'Simulation execution model.'}
        </span>
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
          {busy ? 'Running…' : 'Run Simulation'}
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
