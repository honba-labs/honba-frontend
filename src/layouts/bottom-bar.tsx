import React, { useState, useEffect } from 'react';
import { useScreenerStore } from '../core/store/use-screener-store';
import { usePortfolioStore } from '../core/portfolio/store';
import { formatMoney, moneyToMajor } from '../core/portfolio/money';
import { dataLayer } from '../core/data-layer';
import { SlidersHorizontal, Code2, PlayCircle, BarChart3, Briefcase } from 'lucide-react';

export const BottomBar: React.FC = () => {
  const shortlistedSymbols = useScreenerStore((state) => state.shortlistedSymbols);
  const currentMarket = useScreenerStore((state) => state.currentMarket);
  const isLive = useScreenerStore((state) => state.isLive);
  const toggleLiveTicks = useScreenerStore((state) => state.toggleLiveTicks);

  const { getActiveAccount } = usePortfolioStore();
  const activeAccount = getActiveAccount();

  const holdingsCount = activeAccount?.holdings.length ?? 0;
  const positionsCount = activeAccount?.positions.length ?? 0;
  const totalPortfolioItems = holdingsCount + positionsCount;

  const totalPnl = activeAccount
    ? moneyToMajor(activeAccount.unrealized_pnl) + moneyToMajor(activeAccount.realized_pnl)
    : 0;
  const isPnlPositive = totalPnl >= 0;

  const [timeStr, setTimeStr] = useState<string>(() => new Date().toTimeString().split(' ')[0]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTimeStr(new Date().toTimeString().split(' ')[0]);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const market = dataLayer.getCurrentMarketInfo();

  return (
    <footer className="hb-bottom-bar" id="bottom-bar-container">
      <div className="bottom-bar-left">
        <button className="hb-bottom-tab tv-bottom-tab active" data-tab="screener">
          <SlidersHorizontal size={13} style={{ marginRight: 6 }} />
          <span>Stock Screener</span>
        </button>

        <a
          href="/portfolio.html"
          className="hb-bottom-tab tv-bottom-tab"
          data-tab="portfolio"
          title="Open Honba Portfolio Manager"
        >
          <Briefcase size={13} style={{ marginRight: 6 }} />
          <span>Portfolio</span>
          {totalPortfolioItems > 0 && (
            <span
              style={{
                fontSize: 9.5,
                padding: '0 5px',
                borderRadius: 8,
                background: 'var(--accent-subtle)',
                color: 'var(--accent-primary)',
                fontWeight: 700,
                marginLeft: 5,
              }}
            >
              {totalPortfolioItems}
            </span>
          )}
        </a>

        <a href="/algodesigner.html" className="hb-bottom-tab tv-bottom-tab" data-tab="algodesigner">
          <Code2 size={13} style={{ marginRight: 6 }} />
          <span>Algo Designer</span>
        </a>
        <a href="/simulator.html" className="hb-bottom-tab tv-bottom-tab" data-tab="simulator">
          <PlayCircle size={13} style={{ marginRight: 6 }} />
          <span>Backtest Simulator</span>
        </a>
        <a href="/workbench.html" className="hb-bottom-tab tv-bottom-tab" data-tab="workbench">
          <BarChart3 size={13} style={{ marginRight: 6 }} />
          <span>WorkBench</span>
        </a>
      </div>

      <div className="bottom-bar-right">
        {activeAccount && (
          <a
            href="/portfolio.html"
            className="hb-status-item tv-status-item"
            style={{ textDecoration: 'none', fontFamily: 'var(--font-family-mono)', display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}
            title="Open Honba Portfolio Manager"
          >
            <Briefcase size={11} color="var(--accent-primary)" />
            <span style={{ color: 'var(--text-muted)' }}>{activeAccount.name}:</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {formatMoney(activeAccount.equity, activeAccount.currency)}
            </span>
            <span style={{ fontWeight: 700, color: isPnlPositive ? 'var(--bullish)' : 'var(--bearish)' }}>
              ({isPnlPositive ? '+' : ''}{formatMoney(totalPnl, activeAccount.currency)})
            </span>
          </a>
        )}

        {shortlistedSymbols.length > 0 && (
          <div className="hb-status-item tv-status-item tv-highlight" style={{ cursor: 'pointer' }}>
            <span>Selected: {shortlistedSymbols.length}</span>
          </div>
        )}
        <div
          className="hb-status-item tv-status-item"
          style={{ cursor: 'pointer' }}
          onClick={toggleLiveTicks}
          title={isLive ? 'Live Ticks Active (Click to Pause)' : 'Paused (Click to Resume)'}
        >
          <span className={`status-dot ${isLive ? 'live-pulsing' : ''}`} style={{ background: isLive ? 'var(--bullish)' : 'var(--text-muted)' }} />
          <span>{isLive ? 'Live Feed' : 'Market Closed'} ({market.primaryExchanges[0]})</span>
        </div>
        <div className="hb-status-item tv-status-item">
          <span>Latency: <strong style={{ color: 'var(--bullish)' }}>12ms</strong></span>
        </div>
        <div className="hb-status-item tv-status-item" id="bottom-clock-display">
          {timeStr}
        </div>
        <div className="hb-status-item tv-status-item" style={{ color: 'var(--text-muted)' }}>
          <span>UTC+5:30</span>
        </div>
      </div>
    </footer>
  );
};

export const HbBottomBar = BottomBar;
