import React, { useState, useMemo, useRef } from 'react';
import { useScreenerStore } from '../../../core/store/use-screener-store';
import { useLayoutStore } from '../../../layouts/use-layout-store';
import { dataLayer } from '../../../core/data-layer';
import { Instrument } from '../../../core/market-data';
import { TechnicalsGauge } from '../../ui/technicals-gauge';
import {
  X,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { SuiteActionGroup, InstrumentChartCard } from '../../domain';
import { generateInstrumentCandles } from '../../../core/candle-generator';

export const SymbolDetailDrawer: React.FC = () => {
  const isDrawerOpen = useLayoutStore((state) => state.isDrawerOpen);
  const setDrawerOpen = useLayoutStore((state) => state.setDrawerOpen);
  const activeSymbol = useScreenerStore((state) => state.activeSymbol);
  const instruments = useScreenerStore((state) => state.instruments);
  const shortlistedSymbols = useScreenerStore((state) => state.shortlistedSymbols);
  const toggleShortlist = useScreenerStore((state) => state.toggleShortlist);

  const [chartRange, setChartRange] = useState<string>('1D');
  const [chartMode, setChartMode] = useState<'area' | 'candles'>('candles');

  const inst = useMemo(() => {
    return (
      instruments.find((i) => i.symbol === activeSymbol) ||
      dataLayer.getInstrument(activeSymbol) ||
      instruments[0] ||
      dataLayer.getInstruments()[0]
    );
  }, [instruments, activeSymbol]);

  if (!isDrawerOpen) return null;

  if (!inst) {
    return (
      <aside className="detail-drawer" id="detail-drawer">
        <div className="drawer-empty-state" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 }}>
          <div style={{ fontSize: 32 }}>📊</div>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>No Symbol Selected</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 220 }}>
            Click on any stock row in the screener table to inspect charts, technical gauges, and statistics.
          </div>
        </div>
      </aside>
    );
  }

  const market = dataLayer.getCurrentMarketInfo();
  const isShortlisted = shortlistedSymbols.includes(inst.symbol);
  const isUp = inst.changePercent >= 0;

  const formatNumber = (num: number, decimals: number = 2): string => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const formatCompact = (num: number): string => {
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e7) return (num / 1e7).toFixed(2) + 'Cr';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return String(num);
  };

  // Candles data for active range
  const candles = useMemo(() => {
    return generateInstrumentCandles(inst, chartRange);
  }, [inst, chartRange]);

  const minPrice = useMemo(() => Math.min(...candles.map((c) => c.low)), [candles]);
  const maxPrice = useMemo(() => Math.max(...candles.map((c) => c.high)), [candles]);

  // Range calculation based on selected chart timeline (1D, 5D, 1M, 1Y)
  const rangeData = useMemo(() => {
    let title = '52-Week Range';
    let min = inst.low52;
    let max = inst.high52;

    if (chartRange === '1D') {
      title = "Day's Range";
      min = minPrice;
      max = maxPrice;
    } else if (chartRange === '5D') {
      title = '5-Day Range';
      min = minPrice;
      max = maxPrice;
    } else if (chartRange === '1M') {
      title = '1-Month Range';
      min = minPrice;
      max = maxPrice;
    } else {
      title = '52-Week Range';
      min = inst.low52 ? Math.min(inst.low52, minPrice) : minPrice;
      max = inst.high52 ? Math.max(inst.high52, maxPrice) : maxPrice;
    }

    const effectiveMin = Math.min(min, inst.price);
    const effectiveMax = Math.max(max, inst.price);
    const delta = effectiveMax - effectiveMin || 1;
    const pct = Math.max(0, Math.min(100, ((inst.price - effectiveMin) / delta) * 100));

    return {
      title,
      min: effectiveMin,
      max: effectiveMax,
      pct,
    };
  }, [chartRange, minPrice, maxPrice, inst.low52, inst.high52, inst.price]);

  const renderPerfRow = (label: string, val?: number) => {
    if (val === undefined || val === null) return null;
    const isRowUp = val >= 0;
    const absVal = Math.min(100, Math.abs(val) * 2.5);

    return (
      <div className="perf-row" key={label}>
        <div className="perf-row-label">{label}</div>
        <div className="perf-bar-track">
          <div
            className={`perf-bar-fill ${isRowUp ? 'bg-up' : 'bg-down'}`}
            style={{ width: `${Math.max(4, absVal)}%` }}
          />
        </div>
        <div className={`perf-row-val ${isRowUp ? 'val-up' : 'val-down'}`}>
          {isRowUp ? '+' : ''}{val.toFixed(2)}%
        </div>
      </div>
    );
  };

  const avatarBg = ['#2962ff', '#089981', '#7b1fa2', '#f57c00', '#0097a7', '#455a64'][
    inst.symbol.charCodeAt(0) % 6
  ];

  return (
    <aside className="detail-drawer" id="detail-drawer">
      {/* Header */}
      <div className="drawer-header">
        <div className="drawer-header-left">
          <div className="drawer-logo-avatar" style={{ backgroundColor: avatarBg }}>
            {inst.symbol.slice(0, 3)}
          </div>
          <div className="drawer-title-box">
            <div className="drawer-ticker-row">
              <a
                href={`/instrument.html?symbol=${encodeURIComponent(inst.symbol)}`}
                className="drawer-ticker drawer-ticker-link"
                title={`Open ${inst.symbol} instrument page`}
              >
                {inst.symbol}
              </a>
              <span className="drawer-exchange-tag">{inst.exchange}</span>
              <span className="drawer-country-flag">{market.flag}</span>
            </div>
            <a
              href={`/instrument.html?symbol=${encodeURIComponent(inst.symbol)}`}
              className="drawer-company-name drawer-name-link"
              title={`Open ${inst.name} instrument page`}
            >
              {inst.name}
            </a>
          </div>
        </div>

        <div className="drawer-header-actions">
          <button
            className={`drawer-action-btn star-btn ${isShortlisted ? 'active' : ''}`}
            onClick={() => toggleShortlist(inst.symbol)}
            title={isShortlisted ? 'Remove from Shortlist' : 'Add to Shortlist'}
          >
            {isShortlisted ? <BookmarkCheck size={14} color="var(--primary)" /> : <Bookmark size={14} />}
          </button>
          <a
            href={`/workbench.html?symbol=${encodeURIComponent(inst.symbol)}`}
            className="drawer-action-btn"
            title="Open in WorkBench Terminal"
          >
            <ExternalLink size={14} />
          </a>
          <button
            className="drawer-action-btn"
            onClick={() => setDrawerOpen(false)}
            title="Close Panel"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="drawer-scroll-body">
        {/* Real-Time Quote Banner */}
        <div className="drawer-quote-banner">
          <div className="drawer-quote-primary-row">
            <span className="drawer-quote-price">
              {market.currencySymbol}{formatNumber(inst.price)}
            </span>
            <div className={`drawer-quote-change ${isUp ? 'val-up' : 'val-down'}`}>
              <span className={`badge-pill ${isUp ? 'pill-bullish' : 'pill-bearish'}`} style={{ display: 'inline-flex', alignItems: 'center' }}>
                {isUp ? <TrendingUp size={12} style={{ marginRight: 3 }} /> : <TrendingDown size={12} style={{ marginRight: 3 }} />}
                {isUp ? '+' : ''}{formatNumber(inst.change)} ({isUp ? '+' : ''}{inst.changePercent.toFixed(2)}%)
              </span>
            </div>
          </div>
          <div className="drawer-quote-sub">
            <span>Vol: {formatCompact(inst.volume)}</span>
            <span>•</span>
            <span>Day: {market.currencySymbol}{formatNumber(inst.low52 * 1.01)} - {market.currencySymbol}{formatNumber(inst.high52 * 0.99)}</span>
          </div>
        </div>

        {/* Primary Action Buttons (Top) */}
        {/* Suite Action Buttons */}
        <SuiteActionGroup symbol={inst.symbol} variant="stacked" />

        {/* Interactive Chart Preview Section */}
        <div className="drawer-section">
          <div className="drawer-section-header">
            <div className="drawer-section-title">Chart Preview</div>
          </div>
          <InstrumentChartCard
            instrument={inst}
            chartMode={chartMode}
            onChartModeChange={setChartMode}
            selectedRange={chartRange}
            onRangeChange={setChartRange}
            ranges={['1D', '5D', '1M', '1Y']}
            height={135}
            showVolume={false}
            showHeaderMeta={true}
            showModeLabels={false}
            currencySymbol={market.currencySymbol}
          />
        </div>

        {/* Dynamic Range Bar based on chart timeline (1D, 5D, 1M, 1Y) */}
        <div className="drawer-section">
          <div className="drawer-section-header">
            <div className="drawer-section-title">{rangeData.title}</div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>
              {chartRange}
            </span>
          </div>
          <div className="range52-wrapper">
            <div className="range52-endpoints">
              <span className="range-endpoint">
                <span className="range-tag range-tag-low">LOW</span>
                <span>{market.currencySymbol}{formatNumber(rangeData.min)}</span>
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                Current: {market.currencySymbol}{formatNumber(inst.price)}
              </span>
              <span className="range-endpoint">
                <span className="range-tag range-tag-high">HIGH</span>
                <span>{market.currencySymbol}{formatNumber(rangeData.max)}</span>
              </span>
            </div>
            <div className="range52-track">
              <div className="range52-fill" style={{ width: `${rangeData.pct}%` }} />
              <div className="range52-pip" style={{ left: `${rangeData.pct}%` }} />
            </div>
          </div>
        </div>

        {/* Technical Rating Speedometer Gauge */}
        <div className="drawer-section">
          <div className="drawer-section-header">
            <div className="drawer-section-title">Technical Analysis</div>
            <span className={`rating-pill rating-${inst.technicalRating.toLowerCase().replace(' ', '-')}`}>
              {inst.technicalRating}
            </span>
          </div>

          <div className="gauge-card">
            <TechnicalsGauge rating={inst.technicalRating} />

            <div className="indicators-breakdown-row" style={{ marginTop: 12, width: '100%' }}>
              <div className="indicator-group-card">
                <div className="ind-title">Oscillators</div>
                <div className="ind-badge-row">
                  <span className="ind-count ind-sell">{inst.rsi14 > 70 ? 2 : 0} Sell</span>
                  <span className="ind-count ind-neutral">{inst.rsi14 >= 40 && inst.rsi14 <= 70 ? 8 : 4} Neutral</span>
                  <span className="ind-count ind-buy">{inst.rsi14 < 40 ? 3 : 1} Buy</span>
                </div>
              </div>

              <div className="indicator-group-card">
                <div className="ind-title">Moving Averages</div>
                <div className="ind-badge-row">
                  <span className="ind-count ind-sell">{inst.price < inst.sma200 ? 5 : 1} Sell</span>
                  <span className="ind-count ind-neutral">1 Neutral</span>
                  <span className="ind-count ind-buy">{inst.price >= inst.sma200 ? 9 : 4} Buy</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Key Statistics Grid */}
        <div className="drawer-section">
          <div className="drawer-section-header">
            <div className="drawer-section-title">Key Statistics</div>
          </div>
          <div className="stats-keyval-grid">
            <div className="stat-cell">
              <div className="stat-label">Market Cap</div>
              <div className="stat-value">{market.currencySymbol}{formatCompact(inst.marketCap)}</div>
            </div>
            <div className="stat-cell">
              <div className="stat-label">P/E (TTM)</div>
              <div className="stat-value">{inst.pe ? inst.pe.toFixed(2) : '-'}</div>
            </div>
            <div className="stat-cell">
              <div className="stat-label">Forward P/E</div>
              <div className="stat-value">{inst.forwardPe ? inst.forwardPe.toFixed(2) : '-'}</div>
            </div>
            <div className="stat-cell">
              <div className="stat-label">Price to Book</div>
              <div className="stat-value">{inst.pb ? inst.pb.toFixed(2) : '-'}</div>
            </div>
            <div className="stat-cell">
              <div className="stat-label">EPS (TTM)</div>
              <div className="stat-value">{market.currencySymbol}{inst.eps ? inst.eps.toFixed(2) : '-'}</div>
            </div>
            <div className="stat-cell">
              <div className="stat-label">Dividend Yield</div>
              <div className="stat-value">{inst.dividendYield ? inst.dividendYield.toFixed(2) + '%' : '0.00%'}</div>
            </div>
            <div className="stat-cell">
              <div className="stat-label">RSI (14)</div>
              <div className={`stat-value ${inst.rsi14 > 70 ? 'val-down' : inst.rsi14 < 35 ? 'val-up' : ''}`}>
                {inst.rsi14.toFixed(1)}
              </div>
            </div>
            <div className="stat-cell">
              <div className="stat-label">200 SMA</div>
              <div className="stat-value">{market.currencySymbol}{formatNumber(inst.sma200)}</div>
            </div>
            <div className="stat-cell">
              <div className="stat-label">ROCE %</div>
              <div className="stat-value">{inst.roce.toFixed(1)}%</div>
            </div>
            <div className="stat-cell">
              <div className="stat-label">Debt / Equity</div>
              <div className="stat-value">{inst.debtToEquity.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* Historical Performance */}
        <div className="drawer-section">
          <div className="drawer-section-header">
            <div className="drawer-section-title">Performance</div>
          </div>
          <div className="perf-bars-container">
            {renderPerfRow('1 Week', inst.perf1W)}
            {renderPerfRow('1 Month', inst.perf1M)}
            {renderPerfRow('3 Months', inst.perf3M)}
            {renderPerfRow('1 Year', inst.perf1Y)}
          </div>
        </div>
      </div>
    </aside>
  );
};

export const HbSymbolDetailDrawer = SymbolDetailDrawer;

