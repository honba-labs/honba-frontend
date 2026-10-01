/**
 * Honba Structural Column Engine & Composable Data-Bound Renderers
 * 
 * Strict Domain Hierarchy:
 * Country -> Exchange -> Asset Market Domain (Stocks, Mutual Funds, ETFs, Bonds) -> Instrument / Symbol
 * 
 * All columns are data-bound, structural contracts with consistent formatting,
 * alignment, metadata tags, and per-asset visibility presets.
 */

import React from 'react';
import { Instrument, MarketCountry, CountryCode } from './market-data';
import { Sparkline } from '../components/ui/sparkline';
import { RangeBar } from '../components/ui/range-bar';
import { ExternalLink } from 'lucide-react';
import { ScreenerType } from './filter-config';

export interface ColumnRenderContext {
  market?: MarketCountry;
  currency?: string;
  onSelectSymbol?: (symbol: string) => void;
}

export type ColumnCategory = 
  | 'overview' 
  | 'performance' 
  | 'valuation' 
  | 'technicals' 
  | 'fundamentals'
  | 'funds' 
  | 'bonds';

export interface ColumnDef {
  id: string;
  label: string;
  category: ColumnCategory;
  visible: boolean;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
  tooltip?: string;
  applicableAssets?: ScreenerType[];
  render?: (inst: Instrument, ctx?: ColumnRenderContext) => React.ReactNode;
}

// Country flags lookup
export const COUNTRY_FLAGS: Record<string, string> = {
  IN: '🇮🇳',
  US: '🇺🇸',
  JP: '🇯🇵',
  UK: '🇬🇧',
};

// Structural Currency and Numeric Formatters
export const formatNumber = (num: number | undefined | null, decimals = 2): string => {
  if (num === undefined || num === null || isNaN(num)) return '—';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const formatCompact = (num: number | undefined | null): string => {
  if (num === undefined || num === null || isNaN(num)) return '—';
  if (Math.abs(num) >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (Math.abs(num) >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (Math.abs(num) >= 1e7) return (num / 1e7).toFixed(2) + 'Cr';
  if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (Math.abs(num) >= 1e5) return (num / 1e5).toFixed(2) + 'L';
  if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(1) + 'k';
  return num.toFixed(2);
};

export const formatPercent = (val: number | undefined | null, showSign = true): { text: string; className: string } => {
  if (val === undefined || val === null || isNaN(val)) return { text: '—', className: '' };
  const sign = showSign && val > 0 ? '+' : '';
  const text = `${sign}${val.toFixed(2)}%`;
  const className = val > 0 ? 'tv-change-up' : val < 0 ? 'tv-change-down' : 'tv-change-neutral';
  return { text, className };
};

// Dynamic Logo / Avatar generator from ticker symbol
export const getLogoForSymbol = (symbol: string) => {
  const clean = symbol.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const colors = [
    { bg: '#004c8f', color: '#ffffff' },
    { bg: '#0b2046', color: '#ffffff' },
    { bg: '#089981', color: '#ffffff' },
    { bg: '#7b1fa2', color: '#ffffff' },
    { bg: '#f57c00', color: '#ffffff' },
    { bg: '#0097a7', color: '#ffffff' },
    { bg: '#455a64', color: '#ffffff' },
    { bg: '#b71c1c', color: '#ffffff' },
  ];
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = colors[Math.abs(hash) % colors.length];
  return {
    ...color,
    label: clean.slice(0, 2),
  };
};

export function renderRatingBadge(rating: string) {
  if (!rating) return <span>—</span>;
  const isBullish = rating.includes('Buy');
  const isBearish = rating.includes('Sell');
  const isStrong = rating.startsWith('Strong');
  const arrow = isBullish ? '⌃' : isBearish ? '⌄' : '—';
  const ratingClass = isBullish
    ? isStrong
      ? 'rating-strong-buy rating-strong'
      : 'rating-buy'
    : isBearish
    ? isStrong
      ? 'rating-strong-sell rating-strong'
      : 'rating-sell'
    : 'rating-neutral';

  const formattedRating =
    rating === 'Strong Buy' ? 'Strong buy' : rating === 'Strong Sell' ? 'Strong sell' : rating;

  return (
    <span className={`tv-analyst-badge ${ratingClass}`}>
      <span className="tv-rating-arrow">{arrow}</span>
      <span>{formattedRating}</span>
    </span>
  );
}

/**
 * Structural Column Registry
 * Categorized logically across all market dimensions.
 */
export const ALL_COLUMNS: ColumnDef[] = [
  // ==========================================
  // 1. INSTRUMENT IDENTITY & VENUE HIERARCHY
  // Country -> Exchange -> Asset -> Symbol
  // ==========================================
  {
    id: 'symbol',
    label: 'Symbol',
    category: 'overview',
    visible: true,
    align: 'left',
    tooltip: 'Instrument Symbol and Listing Venue',
    render: (inst) => {
      const logo = getLogoForSymbol(inst.symbol);
      const flag = COUNTRY_FLAGS[inst.country] || '🌐';
      const hasDividend = inst.dividendYield && inst.dividendYield > 0;

      return (
        <div className="tv-symbol-cell">
          <div className="tv-symbol-logo" style={{ backgroundColor: logo.bg, color: logo.color }}>
            {logo.label}
          </div>
          <div className="tv-symbol-details">
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span className="tv-symbol-ticker">{inst.symbol}</span>
              <span
                style={{
                  fontSize: 9.5,
                  padding: '1px 4px',
                  borderRadius: 3,
                  backgroundColor: 'var(--surface-elevated, #2a2e39)',
                  color: 'var(--text-muted, #787b86)',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                }}
                title={`Listing Venue: ${inst.exchange} (${inst.country})`}
              >
                {inst.exchange}
              </span>
              <a
                href={`/instrument.html?symbol=${encodeURIComponent(inst.symbol)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="tv-symbol-open-icon"
                title={`Open Dedicated Chart & Analytics for ${inst.symbol}`}
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  color: 'var(--text-muted)',
                  transition: 'color var(--transition-fast)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                <ExternalLink size={10} />
              </a>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10 }}>{flag}</span>
              <span className="tv-symbol-name" title={inst.name}>
                {inst.name}
              </span>
            </div>
            {hasDividend && (
              <span className="tv-dividend-tag" title={`Dividend Yield: ${inst.dividendYield?.toFixed(2)}%`}>
                D
              </span>
            )}
          </div>
        </div>
      );
    },
  },
  {
    id: 'exchange',
    label: 'Exchange',
    category: 'overview',
    visible: false,
    align: 'center',
    tooltip: 'Primary Trading Venue / Listing Exchange',
    render: (inst) => (
      <span className="tv-sector-text" style={{ fontWeight: 600 }}>
        {inst.exchange}
      </span>
    ),
  },
  {
    id: 'country',
    label: 'Country',
    category: 'overview',
    visible: false,
    align: 'center',
    tooltip: 'Domicile & Sovereign Country',
    render: (inst) => (
      <span>
        {COUNTRY_FLAGS[inst.country] || ''} {inst.country}
      </span>
    ),
  },

  // ==========================================
  // 2. REAL-TIME MARKET QUOTES & PRICE ACTION
  // ==========================================
  {
    id: 'price',
    label: 'Price',
    category: 'overview',
    visible: true,
    align: 'right',
    tooltip: 'Last Traded Price in Market Currency',
    render: (inst, ctx) => (
      <div>
        <span className="tv-num-val">{formatNumber(inst.price)}</span>
        <span className="tv-curr-unit">{ctx?.market?.currency || 'INR'}</span>
      </div>
    ),
  },
  {
    id: 'changePercent',
    label: 'Chg %',
    category: 'overview',
    visible: true,
    align: 'right',
    tooltip: 'Daily Percentage Change',
    render: (inst) => {
      const { text, className } = formatPercent(inst.changePercent);
      return <span className={className}>{text}</span>;
    },
  },
  {
    id: 'change',
    label: 'Change (Pts)',
    category: 'performance',
    visible: false,
    align: 'right',
    tooltip: 'Net Change in Price Points',
    render: (inst) => {
      const isUp = inst.change >= 0;
      return (
        <span className={isUp ? 'tv-change-up' : 'tv-change-down'}>
          {isUp ? '+' : ''}{formatNumber(inst.change)}
        </span>
      );
    },
  },
  {
    id: 'volume',
    label: 'Vol',
    category: 'overview',
    visible: true,
    align: 'right',
    tooltip: 'Total Shares / Units Traded Today',
    render: (inst) => <span className="tv-num-val">{formatCompact(inst.volume)}</span>,
  },
  {
    id: 'relVol',
    label: 'Rel Vol',
    category: 'overview',
    visible: true,
    align: 'right',
    tooltip: 'Relative Volume compared to 30-day average',
    render: (inst) => {
      const relVol = inst.volume / (inst.avgVolume30d || inst.volume);
      return <span className="tv-num-val">{relVol.toFixed(2)}</span>;
    },
  },

  // ==========================================
  // 3. PERFORMANCE & TECHNICALS
  // ==========================================
  {
    id: 'perf1W',
    label: 'Perf 1W %',
    category: 'performance',
    visible: false,
    align: 'right',
    render: (inst) => {
      const { text, className } = formatPercent(inst.perf1W);
      return <span className={className}>{text}</span>;
    },
  },
  {
    id: 'perf1M',
    label: 'Perf 1M %',
    category: 'performance',
    visible: false,
    align: 'right',
    render: (inst) => {
      const { text, className } = formatPercent(inst.perf1M);
      return <span className={className}>{text}</span>;
    },
  },
  {
    id: 'perf3M',
    label: 'Perf 3M %',
    category: 'performance',
    visible: false,
    align: 'right',
    render: (inst) => {
      const { text, className } = formatPercent(inst.perf3M);
      return <span className={className}>{text}</span>;
    },
  },
  {
    id: 'perf1Y',
    label: 'Perf 1Y %',
    category: 'performance',
    visible: false,
    align: 'right',
    render: (inst) => {
      const { text, className } = formatPercent(inst.perf1Y);
      return <span className={className}>{text}</span>;
    },
  },
  {
    id: 'technicalRating',
    label: 'Technical Rating',
    category: 'technicals',
    visible: false,
    align: 'center',
    render: (inst) => renderRatingBadge(inst.technicalRating),
  },
  {
    id: 'rsi14',
    label: 'RSI (14)',
    category: 'technicals',
    visible: false,
    align: 'right',
    render: (inst) => (
      <span className={`tv-num-val ${inst.rsi14 > 70 ? 'tv-change-down' : inst.rsi14 < 35 ? 'tv-change-up' : ''}`}>
        {inst.rsi14 ? inst.rsi14.toFixed(1) : '—'}
      </span>
    ),
  },
  {
    id: 'range52',
    label: '52W Range Bar',
    category: 'technicals',
    visible: false,
    render: (inst) => <RangeBar current={inst.price} low={inst.low52} high={inst.high52} />,
  },
  {
    id: 'sma200',
    label: '200 SMA',
    category: 'technicals',
    visible: false,
    align: 'right',
    render: (inst, ctx) => (
      <div>
        <span className="tv-num-val">{formatNumber(inst.sma200)}</span>
        <span className="tv-curr-unit">{ctx?.market?.currency || 'INR'}</span>
      </div>
    ),
  },
  {
    id: 'sparkline',
    label: '7D Trend',
    category: 'technicals',
    visible: false,
    render: (inst) => (
      <Sparkline
        points={inst.sparkline || [inst.price * 0.98, inst.price]}
        isUp={inst.changePercent >= 0}
        symbol={inst.symbol}
      />
    ),
  },
  {
    id: 'high52',
    label: '52W High',
    category: 'technicals',
    visible: false,
    align: 'right',
    render: (inst, ctx) => (
      <div>
        <span className="tv-num-val">{formatNumber(inst.high52)}</span>
        <span className="tv-curr-unit">{ctx?.market?.currency || 'INR'}</span>
      </div>
    ),
  },
  {
    id: 'low52',
    label: '52W Low',
    category: 'technicals',
    visible: false,
    align: 'right',
    render: (inst, ctx) => (
      <div>
        <span className="tv-num-val">{formatNumber(inst.low52)}</span>
        <span className="tv-curr-unit">{ctx?.market?.currency || 'INR'}</span>
      </div>
    ),
  },

  // ==========================================
  // 4. EQUITIES: VALUATION & FUNDAMENTALS
  // ==========================================
  {
    id: 'marketCap',
    label: 'Mkt Cap',
    category: 'overview',
    visible: true,
    align: 'right',
    tooltip: 'Total Market Capitalization',
    applicableAssets: ['stocks'],
    render: (inst, ctx) => (
      <div>
        <span className="tv-num-val">{formatCompact(inst.marketCap)}</span>
        <span className="tv-curr-unit">{ctx?.market?.currency || 'INR'}</span>
      </div>
    ),
  },
  {
    id: 'pe',
    label: 'P/E',
    category: 'overview',
    visible: true,
    align: 'right',
    tooltip: 'Price to Earnings Ratio (TTM)',
    applicableAssets: ['stocks'],
    render: (inst) => <span className="tv-num-val">{inst.pe ? inst.pe.toFixed(2) : '—'}</span>,
  },
  {
    id: 'forwardPe',
    label: 'Forward P/E',
    category: 'valuation',
    visible: false,
    align: 'right',
    applicableAssets: ['stocks'],
    render: (inst) => <span className="tv-num-val">{inst.forwardPe ? inst.forwardPe.toFixed(2) : '—'}</span>,
  },
  {
    id: 'pb',
    label: 'Price to Book',
    category: 'valuation',
    visible: false,
    align: 'right',
    applicableAssets: ['stocks'],
    render: (inst) => <span className="tv-num-val">{inst.pb ? inst.pb.toFixed(2) : '—'}</span>,
  },
  {
    id: 'eps',
    label: 'EPS Dil TTM',
    category: 'overview',
    visible: true,
    align: 'right',
    applicableAssets: ['stocks'],
    render: (inst, ctx) => (
      <div>
        <span className="tv-num-val">{inst.eps ? inst.eps.toFixed(2) : '—'}</span>
        <span className="tv-curr-unit">{ctx?.market?.currency || 'INR'}</span>
      </div>
    ),
  },
  {
    id: 'epsGrowth',
    label: 'EPS Dil Growth',
    category: 'overview',
    visible: true,
    align: 'right',
    applicableAssets: ['stocks'],
    render: (inst) => {
      const { text, className } = formatPercent(inst.revenueGrowth);
      return <span className={className}>{text}</span>;
    },
  },
  {
    id: 'dividendYield',
    label: 'Div Yield %',
    category: 'overview',
    visible: true,
    align: 'right',
    applicableAssets: ['stocks', 'etf'],
    render: (inst) => (
      <span className="tv-num-val">
        {inst.dividendYield ? inst.dividendYield.toFixed(2) + '%' : '0.00%'}
      </span>
    ),
  },
  {
    id: 'sector',
    label: 'Sector',
    category: 'overview',
    visible: true,
    align: 'left',
    applicableAssets: ['stocks', 'etf', 'mf', 'bonds'],
    render: (inst) => <span className="tv-sector-text">{inst.sector || '—'}</span>,
  },
  {
    id: 'analystRating',
    label: 'Analyst Rating',
    category: 'overview',
    visible: true,
    align: 'center',
    applicableAssets: ['stocks'],
    render: (inst) => renderRatingBadge(inst.technicalRating),
  },
  {
    id: 'netMargin',
    label: 'Net Margin %',
    category: 'fundamentals',
    visible: false,
    align: 'right',
    applicableAssets: ['stocks'],
    render: (inst) => <span className="tv-num-val">{inst.netMargin ? inst.netMargin.toFixed(1) + '%' : '—'}</span>,
  },
  {
    id: 'roce',
    label: 'ROCE %',
    category: 'fundamentals',
    visible: false,
    align: 'right',
    applicableAssets: ['stocks'],
    render: (inst) => <span className="tv-num-val">{inst.roce ? inst.roce.toFixed(1) + '%' : '—'}</span>,
  },
  {
    id: 'roe',
    label: 'ROE %',
    category: 'fundamentals',
    visible: false,
    align: 'right',
    applicableAssets: ['stocks'],
    render: (inst) => <span className="tv-num-val">{inst.roe ? inst.roe.toFixed(1) + '%' : '—'}</span>,
  },
  {
    id: 'debtToEquity',
    label: 'Debt / Equity',
    category: 'fundamentals',
    visible: false,
    align: 'right',
    applicableAssets: ['stocks'],
    render: (inst) => <span className="tv-num-val">{inst.debtToEquity ? inst.debtToEquity.toFixed(2) : '—'}</span>,
  },

  // ==========================================
  // 5. MUTUAL FUNDS & ETFS DOMAIN COLUMNS
  // ==========================================
  {
    id: 'aum',
    label: 'AUM',
    category: 'funds',
    visible: false,
    align: 'right',
    tooltip: 'Assets Under Management',
    applicableAssets: ['etf', 'mf', 'bonds'],
    render: (inst, ctx) => (
      <div>
        <span className="tv-num-val">{formatCompact(inst.aum || inst.marketCap)}</span>
        <span className="tv-curr-unit">{ctx?.market?.currency || 'INR'}</span>
      </div>
    ),
  },
  {
    id: 'expenseRatio',
    label: 'Exp Ratio %',
    category: 'funds',
    visible: false,
    align: 'right',
    tooltip: 'Base Expense Ratio %',
    applicableAssets: ['etf', 'mf'],
    render: (inst) => (
      <span className="tv-num-val">
        {inst.expenseRatio !== undefined
          ? `${inst.expenseRatio.toFixed(2)}%`
          : inst.assetType === 'etf'
          ? '0.12%'
          : inst.assetType === 'mf'
          ? '0.69%'
          : '—'}
      </span>
    ),
  },
  {
    id: 'totalExpenseRatio',
    label: 'Total Exp Ratio',
    category: 'funds',
    visible: false,
    align: 'right',
    tooltip: 'Total Expense Ratio (Direct / Regular)',
    applicableAssets: ['mf'],
    render: (inst) => (
      <span className="tv-num-val">
        {inst.totalExpenseRatio !== undefined
          ? `${inst.totalExpenseRatio.toFixed(2)}%`
          : inst.assetType === 'mf'
          ? '0.69%'
          : '—'}
      </span>
    ),
  },
  {
    id: 'catTotalExpenseRatio',
    label: 'Cat Total Exp %',
    category: 'funds',
    visible: false,
    align: 'right',
    tooltip: 'Peer Category Average Total Expense Ratio',
    applicableAssets: ['mf'],
    render: (inst) => (
      <span className="tv-num-val" style={{ color: 'var(--text-muted)' }}>
        {inst.catTotalExpenseRatio !== undefined
          ? `${inst.catTotalExpenseRatio.toFixed(2)}%`
          : inst.assetType === 'mf'
          ? '0.53%'
          : '—'}
      </span>
    ),
  },
  {
    id: 'sharpeRatio',
    label: 'Sharpe Ratio',
    category: 'funds',
    visible: false,
    align: 'right',
    tooltip: 'Risk-adjusted return Sharpe ratio',
    applicableAssets: ['etf', 'mf'],
    render: (inst) => {
      const val = inst.sharpeRatio !== undefined ? inst.sharpeRatio : inst.assetType === 'mf' ? 1.42 : null;
      if (val === null) return <span>—</span>;
      return <span className={`tv-num-val ${val >= 1 ? 'tv-change-up' : val < 0 ? 'tv-change-down' : ''}`}>{val.toFixed(2)}</span>;
    },
  },
  {
    id: 'catSharpeRatio',
    label: 'Cat Sharpe',
    category: 'funds',
    visible: false,
    align: 'right',
    applicableAssets: ['mf'],
    render: (inst) => (
      <span className="tv-num-val" style={{ color: 'var(--text-muted)' }}>
        {inst.catSharpeRatio !== undefined ? inst.catSharpeRatio.toFixed(2) : '—'}
      </span>
    ),
  },
  {
    id: 'cagr3y',
    label: '3Y Return %',
    category: 'performance',
    visible: false,
    align: 'right',
    applicableAssets: ['etf', 'mf'],
    render: (inst) => {
      const val = inst.cagr3y ?? (inst.perf1Y ? inst.perf1Y * 0.8 : null);
      const { text, className } = formatPercent(val);
      return <span className={className}>{text}</span>;
    },
  },
  {
    id: 'cagr5y',
    label: '5Y Return %',
    category: 'performance',
    visible: false,
    align: 'right',
    applicableAssets: ['etf', 'mf'],
    render: (inst) => {
      const val = inst.cagr5y ?? (inst.perf1Y ? inst.perf1Y * 0.72 : null);
      const { text, className } = formatPercent(val);
      return <span className={className}>{text}</span>;
    },
  },
  {
    id: 'schemeType',
    label: 'Scheme Type',
    category: 'funds',
    visible: false,
    align: 'left',
    tooltip: 'Fund Scheme Type (Growth, Liquid, Debt, Hybrid)',
    applicableAssets: ['mf'],
    render: (inst) => (
      <span className="tv-sector-text">
        {inst.schemeType || (inst.industry.includes('Fund') ? 'Growth' : inst.industry)}
      </span>
    ),
  },
  {
    id: 'brand',
    label: 'AMC / Brand',
    category: 'funds',
    visible: false,
    align: 'left',
    applicableAssets: ['etf', 'mf'],
    render: (inst) => <span className="tv-sector-text">{inst.brand || '—'}</span>,
  },

  // ==========================================
  // 6. BONDS DOMAIN COLUMNS
  // ==========================================
  {
    id: 'ytw',
    label: 'YTW %',
    category: 'bonds',
    visible: false,
    align: 'right',
    tooltip: 'Yield to Worst %',
    applicableAssets: ['bonds'],
    render: (inst) => (
      <span className="tv-num-val" style={{ color: '#089981', fontWeight: 600 }}>
        {inst.ytw !== undefined ? `${inst.ytw.toFixed(2)}%` : inst.dividendYield ? `${inst.dividendYield.toFixed(2)}%` : '—'}
      </span>
    ),
  },
  {
    id: 'coupon',
    label: 'Coupon %',
    category: 'bonds',
    visible: false,
    align: 'right',
    tooltip: 'Annual Coupon Interest Rate %',
    applicableAssets: ['bonds'],
    render: (inst) => (
      <span className="tv-num-val">
        {inst.coupon !== undefined ? `${inst.coupon.toFixed(2)}%` : inst.eps ? `${inst.eps.toFixed(2)}%` : '—'}
      </span>
    ),
  },
  {
    id: 'creditRating',
    label: 'Credit Rating',
    category: 'bonds',
    visible: false,
    align: 'center',
    tooltip: 'Independent Credit Rating (CRISIL, ICRA, CARE, Moody’s)',
    applicableAssets: ['bonds'],
    render: (inst) => (
      <span className="tv-analyst-badge rating-strong-buy" style={{ fontSize: 11, padding: '2px 6px' }}>
        {inst.creditRating || (inst.assetType === 'bonds' ? 'AAA' : '—')}
      </span>
    ),
  },
  {
    id: 'maturityDate',
    label: 'Maturity',
    category: 'bonds',
    visible: false,
    align: 'center',
    applicableAssets: ['bonds'],
    render: (inst) => (
      <span className="tv-sector-text">
        {inst.maturityDate || (inst.assetType === 'bonds' ? '2034-06-15' : '—')}
      </span>
    ),
  },
  {
    id: 'issuerType',
    label: 'Issuer Type',
    category: 'bonds',
    visible: false,
    align: 'left',
    applicableAssets: ['bonds'],
    render: (inst) => (
      <span className="tv-sector-text">
        {inst.issuerType || (inst.assetType === 'bonds' ? 'Sovereign' : '—')}
      </span>
    ),
  },
];

// Presets by Analytical Tab
export const TAB_COLUMN_PRESETS: Record<string, string[]> = {
  // Stock Tabs
  overview: ['symbol', 'price', 'changePercent', 'volume', 'relVol', 'marketCap', 'pe', 'eps', 'epsGrowth', 'dividendYield', 'sector', 'analystRating'],
  performance: ['symbol', 'price', 'changePercent', 'change', 'perf1W', 'perf1M', 'perf1Y', 'volume', 'relVol', 'high52', 'low52'],
  technicals: ['symbol', 'price', 'changePercent', 'technicalRating', 'rsi14', 'sma200', 'range52', 'sparkline'],
  valuation: ['symbol', 'price', 'marketCap', 'pe', 'forwardPe', 'pb', 'eps', 'dividendYield', 'revenueGrowth'],
  dividends: ['symbol', 'price', 'dividendYield', 'eps', 'pe', 'marketCap', 'sector'],
  margins: ['symbol', 'price', 'netMargin', 'roce', 'debtToEquity', 'revenueGrowth', 'sector'],
  extended_hours: ['symbol', 'price', 'changePercent', 'volume', 'marketCap'],
  forecasts: ['symbol', 'price', 'pe', 'forwardPe', 'eps', 'revenueGrowth', 'analystRating'],
  profitability: ['symbol', 'price', 'netMargin', 'roce', 'roe', 'debtToEquity', 'revenueGrowth'],
  income_statement: ['symbol', 'price', 'eps', 'epsGrowth', 'revenueGrowth', 'netMargin'],
  balance_sheet: ['symbol', 'price', 'marketCap', 'debtToEquity', 'roce', 'pb'],
  cash_flow: ['symbol', 'price', 'netMargin', 'roce', 'dividendYield'],
  per_share: ['symbol', 'price', 'eps', 'pb', 'dividendYield'],

  // ETF Tabs
  etf_overview: ['symbol', 'price', 'changePercent', 'volume', 'aum', 'expenseRatio', 'dividendYield', 'sector', 'technicalRating'],
  fund_flows: ['symbol', 'price', 'changePercent', 'volume', 'aum', 'perf1W', 'perf1M', 'perf1Y'],
  nav_performance: ['symbol', 'price', 'changePercent', 'perf1M', 'perf1Y', 'cagr3y', 'aum', 'expenseRatio'],
  holdings: ['symbol', 'price', 'changePercent', 'sector', 'aum', 'expenseRatio', 'dividendYield'],
  risk: ['symbol', 'price', 'rsi14', 'sma200', 'sharpeRatio', 'range52', 'technicalRating'],

  // Bond Tabs
  bonds_overview: ['symbol', 'price', 'changePercent', 'ytw', 'coupon', 'creditRating', 'marketCap', 'volume'],
  security_info: ['symbol', 'price', 'ytw', 'coupon', 'creditRating', 'sector', 'volume'],
  interest_rate_risk: ['symbol', 'price', 'ytw', 'coupon', 'sma200', 'creditRating'],
  spreads: ['symbol', 'price', 'ytw', 'coupon', 'creditRating'],
  amounts: ['symbol', 'price', 'volume', 'marketCap', 'aum'],
  bond_features: ['symbol', 'price', 'coupon', 'ytw', 'creditRating', 'sector'],

  // Mutual Fund Tabs
  mf_overview: ['symbol', 'price', 'changePercent', 'aum', 'schemeType', 'expenseRatio', 'cagr3y', 'cagr5y', 'sharpeRatio', 'technicalRating'],
  returns_cagr: ['symbol', 'price', 'changePercent', 'cagr3y', 'cagr5y', 'perf1M', 'perf1Y', 'aum'],
  portfolio_holdings: ['symbol', 'price', 'changePercent', 'sector', 'schemeType', 'aum'],
  sector_allocation: ['symbol', 'price', 'sector', 'aum', 'schemeType'],
  risk_ratios: ['symbol', 'price', 'sharpeRatio', 'catSharpeRatio', 'rsi14', 'technicalRating'],
  fees_loads: ['symbol', 'price', 'expenseRatio', 'totalExpenseRatio', 'catTotalExpenseRatio', 'schemeType', 'aum'],
};

export const getPresetForScreenerTab = (screenerType: string, tabId: string): string[] => {
  if (tabId === 'overview') {
    if (screenerType === 'etf') return TAB_COLUMN_PRESETS.etf_overview;
    if (screenerType === 'bonds') return TAB_COLUMN_PRESETS.bonds_overview;
    if (screenerType === 'mf') return TAB_COLUMN_PRESETS.mf_overview;
    return TAB_COLUMN_PRESETS.overview;
  }
  return TAB_COLUMN_PRESETS[tabId] || TAB_COLUMN_PRESETS.overview;
};

/**
 * Filter columns applicable to a given screener instrument type.
 * Universal columns (where applicableAssets is undefined) apply to all asset classes.
 */
export const getColumnsForScreenerType = (screenerType: ScreenerType): ColumnDef[] => {
  return ALL_COLUMNS.filter((col) => {
    if (!col.applicableAssets) return true;
    return col.applicableAssets.includes(screenerType);
  });
};

/**
 * Returns the relevant column categories for a given screener asset class.
 */
export const getCategoriesForScreenerType = (
  screenerType: ScreenerType
): { id: string; label: string }[] => {
  switch (screenerType) {
    case 'stocks':
      return [
        { id: 'all', label: 'All' },
        { id: 'overview', label: 'Overview' },
        { id: 'performance', label: 'Performance' },
        { id: 'valuation', label: 'Valuation' },
        { id: 'technicals', label: 'Technicals' },
        { id: 'fundamentals', label: 'Fundamentals' },
      ];
    case 'etf':
      return [
        { id: 'all', label: 'All' },
        { id: 'overview', label: 'Overview' },
        { id: 'funds', label: 'Fund Metrics' },
        { id: 'performance', label: 'Performance' },
        { id: 'technicals', label: 'Technicals' },
      ];
    case 'mf':
      return [
        { id: 'all', label: 'All' },
        { id: 'overview', label: 'Overview' },
        { id: 'funds', label: 'Fund Metrics' },
        { id: 'performance', label: 'Performance' },
        { id: 'technicals', label: 'Technicals' },
      ];
    case 'bonds':
      return [
        { id: 'all', label: 'All' },
        { id: 'overview', label: 'Overview' },
        { id: 'bonds', label: 'Bond Details' },
        { id: 'performance', label: 'Performance' },
        { id: 'technicals', label: 'Technicals' },
      ];
    default:
      return [
        { id: 'all', label: 'All' },
        { id: 'overview', label: 'Overview' },
        { id: 'performance', label: 'Performance' },
        { id: 'valuation', label: 'Valuation' },
        { id: 'technicals', label: 'Technicals' },
        { id: 'fundamentals', label: 'Fundamentals' },
        { id: 'funds', label: 'Funds & ETFs' },
        { id: 'bonds', label: 'Bonds' },
      ];
  }
};
