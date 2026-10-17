import React, { useState } from 'react';
import {
  BarChart3,
  Briefcase,
  FileSpreadsheet,
  Activity,
  ScrollText,
  Download,
  Trash2,
  TrendingUp,
  TrendingDown,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import type { SimulationEngineState } from '../../../core/simulator/engine/types';
import { clearSandboxPortfolio } from '../../../core/simulator/engine/portfolio-adapter';
import { usePortfolioStore } from '../../../core/portfolio/store';
import { roundTripStats } from '../../../core/simulator/analytics';
import type { RoundTrip } from '../../../core/simulator/trade-pairing';

export type WorkbenchTab = 'overview' | 'portfolio' | 'trades' | 'signals' | 'logs';

export interface WorkbenchTabsProps {
  engineState: SimulationEngineState;
  onClearPortfolio: () => void;
}

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--border-subtle)',
  borderRadius: 6,
  padding: '10px 14px',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
};

export const WorkbenchTabs: React.FC<WorkbenchTabsProps> = ({ engineState, onClearPortfolio }) => {
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('overview');
  const portfolioSnapshot = usePortfolioStore((state) => state.snapshot);
  const activeAccountId = usePortfolioStore((state) => state.activeAccountId);
  const activeAccount = portfolioSnapshot.accounts.find((a) => a.id === activeAccountId) ?? portfolioSnapshot.accounts[0];

  const trips = engineState.roundTrips;
  const stats = roundTripStats(trips);

  const totalReturnPct =
    engineState.initialCapital > 0 ? (engineState.realizedPnl + engineState.unrealizedPnl) / engineState.initialCapital : 0;

  const exportTradesCSV = () => {
    if (trips.length === 0) return;
    const header = 'ID,Instrument,Side,Quantity,EntryTime,ExitTime,EntryPrice,ExitPrice,RealizedPnL,ReturnPct,Status\n';
    const rows = trips
      .map((t) =>
        [
          t.id,
          t.instrument,
          t.direction,
          t.quantity,
          new Date(t.entryTs * 1000).toISOString(),
          t.exitTs ? new Date(t.exitTs * 1000).toISOString() : '',
          t.avgEntry,
          t.avgExit ?? '',
          t.realizedPnl ?? '',
          t.returnPct ? (t.returnPct * 100).toFixed(2) + '%' : '',
          t.status,
        ].join(','),
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `honba_trades_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: 'var(--bg-app)', color: 'var(--text-primary)' }}>
      {/* Navigation Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '0 12px',
          background: 'var(--bg-surface-elevated)',
        }}
      >
        <div style={{ display: 'flex', gap: 2 }}>
          <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<BarChart3 size={13} />} label="Overview" />
          <TabButton
            active={activeTab === 'portfolio'}
            onClick={() => setActiveTab('portfolio')}
            icon={<Briefcase size={13} />}
            label={`Sandboxed Portfolio (${activeAccount?.positions.length ?? 0})`}
          />
          <TabButton
            active={activeTab === 'trades'}
            onClick={() => setActiveTab('trades')}
            icon={<FileSpreadsheet size={13} />}
            label={`Trade Journal (${trips.length})`}
          />
          <TabButton
            active={activeTab === 'signals'}
            onClick={() => setActiveTab('signals')}
            icon={<Activity size={13} />}
            label={`Signal History (${engineState.confluenceHistory.length})`}
          />
        </div>

        {activeTab === 'portfolio' && (
          <button
            type="button"
            className="shortlist-btn"
            style={{ fontSize: 11, padding: '3px 8px', color: 'var(--bearish, #f23645)', display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={onClearPortfolio}
            title="Clear all sandboxed positions and reset P&L until cleared"
          >
            <Trash2 size={12} />
            <span>Clear Portfolio P&L</span>
          </button>
        )}

        {activeTab === 'trades' && trips.length > 0 && (
          <button
            type="button"
            className="shortlist-btn"
            style={{ fontSize: 11, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={exportTradesCSV}
          >
            <Download size={12} />
            <span>Export CSV</span>
          </button>
        )}
      </div>

      {/* Tab Contents */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12 }}>
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Key Metrics Ribbon */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              <MetricCard
                label="Total Return"
                value={`${totalReturnPct >= 0 ? '+' : ''}${(totalReturnPct * 100).toFixed(2)}%`}
                color={totalReturnPct >= 0 ? 'var(--bullish, #089981)' : 'var(--bearish, #f23645)'}
              />
              <MetricCard
                label="Net Realized PnL"
                value={`₹${engineState.realizedPnl >= 0 ? '+' : ''}${engineState.realizedPnl.toFixed(2)}`}
                color={engineState.realizedPnl >= 0 ? 'var(--bullish, #089981)' : 'var(--bearish, #f23645)'}
              />
              <MetricCard
                label="Unrealized PnL"
                value={`₹${engineState.unrealizedPnl >= 0 ? '+' : ''}${engineState.unrealizedPnl.toFixed(2)}`}
                color={engineState.unrealizedPnl >= 0 ? 'var(--bullish, #089981)' : 'var(--bearish, #f23645)'}
              />
              <MetricCard
                label="Win Rate"
                value={stats.winRate !== null ? `${(stats.winRate * 100).toFixed(1)}%` : '—'}
                color="var(--text-primary)"
              />
              <MetricCard
                label="Profit Factor"
                value={stats.profitFactor !== null ? stats.profitFactor.toFixed(2) : '—'}
                color="var(--text-primary)"
              />
              <MetricCard
                label="Total Trades"
                value={String(stats.closed + stats.open)}
                sub={`${stats.wins}W / ${stats.losses}L`}
                color="var(--text-primary)"
              />
              <MetricCard
                label="Current Equity"
                value={`₹${engineState.equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                sub={`Initial: ₹${engineState.initialCapital.toLocaleString()}`}
                color="var(--accent-primary, #4f8cff)"
              />
            </div>

            {/* Performance Summary Banner */}
            <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ color: 'var(--text-primary)', fontSize: 13 }}>Institutional Simulation Bench</strong>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Pure client-side event replay · Multi-signal confluence evaluator · Real-time sandboxed mark revaluation
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Account:</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {activeAccount?.name ?? 'Sandbox Primary'}
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'portfolio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
              <div style={cardStyle}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Selected Portfolio</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                  {activeAccount?.name || 'Sandbox Primary'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--accent-gold, #f7a600)', marginTop: 2 }}>
                  Mode: {activeAccount?.mode || 'sandbox'}
                </div>
              </div>
              <div style={cardStyle}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cash Balance</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                  ₹{(activeAccount?.cash?.amount ? Number(activeAccount.cash.amount) / 100 : 100000).toLocaleString()}
                </div>
              </div>
              <div style={cardStyle}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Open Positions</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                  {activeAccount?.positions.length ?? 0}
                </div>
              </div>
            </div>

            {/* Positions Table */}
            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle, #2a2e39)', fontSize: 11, fontWeight: 600 }}>
                Active Sandboxed Positions
              </div>
              {(!activeAccount?.positions || activeAccount.positions.length === 0) ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  No open positions in {activeAccount?.name ?? 'Sandbox'}. Run the simulator to open trades.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '6px 12px' }}>Instrument</th>
                      <th style={{ padding: '6px 12px' }}>Side</th>
                      <th style={{ padding: '6px 12px' }}>Qty</th>
                      <th style={{ padding: '6px 12px' }}>Entry Price</th>
                      <th style={{ padding: '6px 12px' }}>Mark Price</th>
                      <th style={{ padding: '6px 12px' }}>Unrealized P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeAccount.positions.map((pos) => {
                      const unPnl = pos.unrealized_pnl?.amount ? Number(pos.unrealized_pnl.amount) / 100 : 0;
                      return (
                        <tr key={`${pos.instrument_id.symbol}-${pos.instrument_id.exchange}`} style={{ borderTop: '1px solid var(--border-subtle, #2a2e39)' }}>
                          <td style={{ padding: '6px 12px', fontWeight: 600 }}>{pos.instrument_id.symbol}</td>
                          <td style={{ padding: '6px 12px', color: pos.side === 'long' ? 'var(--bullish, #089981)' : 'var(--bearish, #f23645)' }}>
                            {pos.side.toUpperCase()}
                          </td>
                          <td style={{ padding: '6px 12px' }}>{pos.quantity}</td>
                          <td style={{ padding: '6px 12px' }}>₹{pos.avg_price.toFixed(2)}</td>
                          <td style={{ padding: '6px 12px' }}>₹{pos.mark.toFixed(2)}</td>
                          <td style={{ padding: '6px 12px', color: unPnl >= 0 ? 'var(--bullish, #089981)' : 'var(--bearish, #f23645)' }}>
                            ₹{unPnl >= 0 ? '+' : ''}{unPnl.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === 'trades' && (
          <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            {trips.length === 0 ? (
              <div style={{ padding: '30px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                No completed trades yet. Play or step through the simulation to generate executions.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 10px' }}>#</th>
                    <th style={{ padding: '6px 10px' }}>Side</th>
                    <th style={{ padding: '6px 10px' }}>Entry Time</th>
                    <th style={{ padding: '6px 10px' }}>Exit Time</th>
                    <th style={{ padding: '6px 10px' }}>Entry ₹</th>
                    <th style={{ padding: '6px 10px' }}>Exit ₹</th>
                    <th style={{ padding: '6px 10px' }}>Qty</th>
                    <th style={{ padding: '6px 10px' }}>Realized P&L</th>
                    <th style={{ padding: '6px 10px' }}>Return %</th>
                    <th style={{ padding: '6px 10px' }}>Exit Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {trips.map((t, idx) => {
                    const isWin = (t.realizedPnl ?? 0) > 0;
                    return (
                      <tr key={t.id} style={{ borderTop: '1px solid var(--border-subtle, #2a2e39)' }}>
                        <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td style={{ padding: '6px 10px', fontWeight: 600, color: t.direction === 'long' ? 'var(--bullish, #089981)' : 'var(--bearish, #f23645)' }}>
                          {t.direction.toUpperCase()}
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          {new Date(t.entryTs * 1000).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          {t.exitTs
                            ? new Date(t.exitTs * 1000).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
                            : 'Open'}
                        </td>
                        <td style={{ padding: '6px 10px' }}>₹{t.avgEntry.toFixed(2)}</td>
                        <td style={{ padding: '6px 10px' }}>{t.avgExit ? `₹${t.avgExit.toFixed(2)}` : '—'}</td>
                        <td style={{ padding: '6px 10px' }}>{t.quantity}</td>
                        <td
                          style={{
                            padding: '6px 10px',
                            fontWeight: 600,
                            color: isWin ? 'var(--bullish, #089981)' : 'var(--bearish, #f23645)',
                          }}
                        >
                          {t.realizedPnl !== null ? `₹${t.realizedPnl >= 0 ? '+' : ''}${t.realizedPnl.toFixed(2)}` : '—'}
                        </td>
                        <td style={{ padding: '6px 10px', color: isWin ? 'var(--bullish, #089981)' : 'var(--bearish, #f23645)' }}>
                          {t.returnPct !== null ? `${(t.returnPct * 100).toFixed(2)}%` : '—'}
                        </td>
                        <td style={{ padding: '6px 10px', color: 'var(--text-secondary)' }}>{t.exitReason}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'signals' && (
          <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            {engineState.confluenceHistory.length === 0 ? (
              <div style={{ padding: '30px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                No signals triggered yet. The strategy will log signal confluence events when conditions evaluate to true.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-elevated)', color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 10px' }}>Time</th>
                    <th style={{ padding: '6px 10px' }}>Price</th>
                    <th style={{ padding: '6px 10px' }}>Confluence Score</th>
                    <th style={{ padding: '6px 10px' }}>Action</th>
                    <th style={{ padding: '6px 10px' }}>Triggered Signals</th>
                    <th style={{ padding: '6px 10px' }}>Execution Details</th>
                  </tr>
                </thead>
                <tbody>
                  {engineState.confluenceHistory.map((conf, idx) => (
                    <tr key={`${conf.barIndex}-${idx}`} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '6px 10px' }}>{conf.timeStr}</td>
                      <td style={{ padding: '6px 10px' }}>₹{conf.price.toFixed(2)}</td>
                      <td style={{ padding: '6px 10px' }}>
                        <span
                          style={{
                            padding: '1px 6px',
                            borderRadius: 3,
                            fontWeight: 700,
                            background: conf.bullishScore > 0 ? 'rgba(8, 153, 129, 0.2)' : 'rgba(242, 54, 69, 0.2)',
                            color: conf.bullishScore > 0 ? 'var(--bullish, #089981)' : 'var(--bearish, #f23645)',
                          }}
                        >
                          {conf.bullishScore}/{conf.totalSignals} Signals
                        </span>
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            color: conf.action === 'buy' ? 'var(--bullish, #089981)' : 'var(--bearish, #f23645)',
                          }}
                        >
                          {conf.action.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {conf.signals
                            .filter((s) => s.active)
                            .map((s) => (
                              <span
                                key={s.id}
                                style={{
                                  fontSize: 10,
                                  background: 'var(--bg-surface-elevated)',
                                  border: '1px solid var(--border-subtle)',
                                  color: 'var(--text-secondary)',
                                  padding: '1px 5px',
                                  borderRadius: 3,
                                }}
                              >
                                {s.label} ({s.details})
                              </span>
                            ))}
                        </div>
                      </td>
                      <td style={{ padding: '6px 10px', color: 'var(--text-secondary)' }}>
                        {conf.executedTrade
                          ? `${conf.executedTrade.side.toUpperCase()} ${conf.executedTrade.quantity} @ ₹${conf.executedTrade.price.toFixed(2)}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({
  active,
  onClick,
  icon,
  label,
}) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '8px 12px',
      fontSize: 11,
      fontWeight: active ? 600 : 400,
      color: active ? 'var(--accent-primary, #4f8cff)' : 'var(--text-muted)',
      borderBottom: `2px solid ${active ? 'var(--accent-primary, #4f8cff)' : 'transparent'}`,
      background: 'transparent',
      borderLeft: 'none',
      borderRight: 'none',
      borderTop: 'none',
      cursor: 'pointer',
    }}
  >
    {icon}
    <span>{label}</span>
  </button>
);

const MetricCard: React.FC<{ label: string; value: string; sub?: string; color: string }> = ({ label, value, sub, color }) => (
  <div style={cardStyle}>
    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
    <div style={{ fontSize: 15, fontWeight: 700, color, marginTop: 2 }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>}
  </div>
);
