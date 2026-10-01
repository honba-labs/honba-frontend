/**
 * Honba Screener Multi-Asset Filter & Tabs Configuration Registry
 * Defines domain-specific filter pills, table tabs, and default metadata
 * for Stock, ETF, Bond, and Mutual Fund screeners to match TradingView usability.
 */

import { AdvancedFilterState } from './filters';

export type ScreenerType = 'stocks' | 'etf' | 'bonds' | 'mf';

export interface FilterPillConfig {
  id: string;
  label: string;
  type: 'select' | 'range' | 'multi-select' | 'boolean' | 'custom';
  dropdownKey: string;
  badgeValue?: (state: AdvancedFilterState) => string | number | null;
  hasActiveFilter?: (state: AdvancedFilterState) => boolean;
}

export interface TabConfig {
  id: string;
  label: string;
  columns?: string[];
}

export interface ScreenerAssetConfig {
  id: ScreenerType;
  name: string;
  defaultTitle: string; // e.g. "All stocks", "ETF vault", "All bonds", "All mutual funds"
  pillConfigs: FilterPillConfig[];
  tabs: TabConfig[];
  defaultSort: { field: string; direction: 'asc' | 'desc' };
}

export const STOCK_TABS: TabConfig[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'performance', label: 'Performance' },
  { id: 'technicals', label: 'Technicals' },
  { id: 'extended_hours', label: 'Extended hours' },
  { id: 'forecasts', label: 'Forecasts' },
  { id: 'valuation', label: 'Valuation' },
  { id: 'dividends', label: 'Dividends' },
  { id: 'profitability', label: 'Profitability' },
  { id: 'income_statement', label: 'Income statement' },
  { id: 'balance_sheet', label: 'Balance sheet' },
  { id: 'cash_flow', label: 'Cash flow' },
  { id: 'per_share', label: 'Per share' },
];

export const ETF_TABS: TabConfig[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'performance', label: 'Performance' },
  { id: 'technicals', label: 'Technicals' },
  { id: 'extended_hours', label: 'Extended hours' },
  { id: 'fund_flows', label: 'Fund flows' },
  { id: 'dividends', label: 'Dividends' },
  { id: 'nav_performance', label: 'NAV performance' },
  { id: 'holdings', label: 'Holdings' },
  { id: 'risk', label: 'Risk' },
];

export const BOND_TABS: TabConfig[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'security_info', label: 'Security info' },
  { id: 'interest_rate_risk', label: 'Interest rate risk' },
  { id: 'spreads', label: 'Spreads' },
  { id: 'amounts', label: 'Amounts' },
  { id: 'bond_features', label: 'Bond features' },
  { id: 'coupon', label: 'Coupon' },
  { id: 'issuer', label: 'Issuer' },
  { id: 'ratings', label: 'Ratings' },
];

export const MF_TABS: TabConfig[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'returns_cagr', label: 'Returns & CAGR' },
  { id: 'portfolio_holdings', label: 'Portfolio Holdings' },
  { id: 'sector_allocation', label: 'Sector Allocation' },
  { id: 'risk_ratios', label: 'Risk & Ratios' },
  { id: 'fees_loads', label: 'Fees & Loads' },
];

export const SCREENER_CONFIG: Record<ScreenerType, ScreenerAssetConfig> = {
  stocks: {
    id: 'stocks',
    name: 'Stock Screener',
    defaultTitle: 'All stocks',
    defaultSort: { field: 'marketCap', direction: 'desc' },
    tabs: STOCK_TABS,
    pillConfigs: [
      { id: 'market', label: 'Market', type: 'select', dropdownKey: 'market' },
      { id: 'watchlist', label: 'Watchlist', type: 'boolean', dropdownKey: 'watchlist' },
      {
        id: 'index',
        label: 'Index',
        type: 'multi-select',
        dropdownKey: 'index',
        badgeValue: (f) => (f.indices && f.indices.length > 0 ? `${f.indices.length}` : null),
        hasActiveFilter: (f) => !!(f.indices && f.indices.length > 0),
      },
      {
        id: 'price',
        label: 'Price',
        type: 'range',
        dropdownKey: 'price',
        hasActiveFilter: (f) => f.minPrice !== null || f.maxPrice !== null,
      },
      {
        id: 'chg',
        label: 'Chg %',
        type: 'range',
        dropdownKey: 'chg',
        hasActiveFilter: (f) => f.minChangePercent !== null || f.maxChangePercent !== null,
      },
      {
        id: 'mktcap',
        label: 'Mkt cap',
        type: 'select',
        dropdownKey: 'mktcap',
        hasActiveFilter: (f) => f.marketCapTier !== 'all',
      },
      {
        id: 'pe',
        label: 'P/E',
        type: 'range',
        dropdownKey: 'pe',
        hasActiveFilter: (f) => f.peMin !== null || f.peMax !== null,
      },
      {
        id: 'epsGrowth',
        label: 'EPS dil growth',
        type: 'range',
        dropdownKey: 'epsGrowth',
        hasActiveFilter: (f) => false,
      },
      {
        id: 'dividend',
        label: 'Div yield %',
        type: 'range',
        dropdownKey: 'dividend',
        hasActiveFilter: (f) => f.minDividendYield !== null,
      },
      {
        id: 'sector',
        label: 'Sector',
        type: 'select',
        dropdownKey: 'sector',
        hasActiveFilter: (f) => f.sector !== 'all',
      },
      {
        id: 'rating',
        label: 'Analyst rating',
        type: 'select',
        dropdownKey: 'rating',
        hasActiveFilter: (f) => f.technicalRating !== 'all',
      },
    ],
  },

  etf: {
    id: 'etf',
    name: 'ETF Screener',
    defaultTitle: 'ETF vault',
    defaultSort: { field: 'marketCap', direction: 'desc' },
    tabs: ETF_TABS,
    pillConfigs: [
      { id: 'market', label: 'Market', type: 'select', dropdownKey: 'market' },
      { id: 'watchlist', label: 'Watchlist', type: 'boolean', dropdownKey: 'watchlist' },
      {
        id: 'assetClass',
        label: 'Asset class',
        type: 'select',
        dropdownKey: 'assetClass',
        hasActiveFilter: (f) => (f.assetClass ? f.assetClass !== 'all' : false),
      },
      {
        id: 'focus',
        label: 'Focus',
        type: 'select',
        dropdownKey: 'focus',
        hasActiveFilter: (f) => (f.focus ? f.focus !== 'all' : false),
      },
      {
        id: 'brand',
        label: 'Brand / AMC',
        type: 'select',
        dropdownKey: 'brand',
        hasActiveFilter: (f) => (f.brand ? f.brand !== 'all' : false),
      },
      {
        id: 'aum',
        label: 'AUM',
        type: 'range',
        dropdownKey: 'aum',
        hasActiveFilter: (f) => (f.minAum !== null && f.minAum !== undefined) || (f.maxAum !== null && f.maxAum !== undefined),
      },
      {
        id: 'expenseRatio',
        label: 'Expense ratio',
        type: 'range',
        dropdownKey: 'expenseRatio',
        hasActiveFilter: (f) => f.maxExpenseRatio !== null && f.maxExpenseRatio !== undefined,
      },
      {
        id: 'navReturn',
        label: 'NAV return',
        type: 'range',
        dropdownKey: 'navReturn',
        hasActiveFilter: (f) => f.minNavReturn !== null && f.minNavReturn !== undefined,
      },
      {
        id: 'divYield',
        label: 'Div yield %',
        type: 'range',
        dropdownKey: 'divYield',
        hasActiveFilter: (f) => f.minDividendYield !== null,
      },
      {
        id: 'perf',
        label: 'Perf %',
        type: 'range',
        dropdownKey: 'perf',
        hasActiveFilter: (f) => f.minChangePercent !== null || f.maxChangePercent !== null,
      },
    ],
  },

  bonds: {
    id: 'bonds',
    name: 'Bond Screener',
    defaultTitle: 'All bonds',
    defaultSort: { field: 'pe', direction: 'desc' }, // or YTW
    tabs: BOND_TABS,
    pillConfigs: [
      { id: 'watchlist', label: 'Watchlist', type: 'boolean', dropdownKey: 'watchlist' },
      {
        id: 'issuerType',
        label: 'Issuer type',
        type: 'select',
        dropdownKey: 'issuerType',
        hasActiveFilter: (f) => (f.issuerType ? f.issuerType !== 'all' : false),
      },
      {
        id: 'issuer',
        label: 'Issuer',
        type: 'select',
        dropdownKey: 'issuer',
        hasActiveFilter: (f) => (f.issuer ? f.issuer !== 'all' : false),
      },
      {
        id: 'ytw',
        label: 'YTW %',
        type: 'range',
        dropdownKey: 'ytw',
        hasActiveFilter: (f) => (f.minYtw !== null && f.minYtw !== undefined) || (f.maxYtw !== null && f.maxYtw !== undefined),
      },
      {
        id: 'coupon',
        label: 'Coupon %',
        type: 'range',
        dropdownKey: 'coupon',
        hasActiveFilter: (f) => (f.minCoupon !== null && f.minCoupon !== undefined) || (f.maxCoupon !== null && f.maxCoupon !== undefined),
      },
      {
        id: 'couponType',
        label: 'Coupon type',
        type: 'select',
        dropdownKey: 'couponType',
        hasActiveFilter: (f) => (f.couponType ? f.couponType !== 'all' : false),
      },
      {
        id: 'maturity',
        label: 'Maturity date',
        type: 'range',
        dropdownKey: 'maturity',
        hasActiveFilter: (f) => (f.maturityYear !== null && f.maturityYear !== undefined),
      },
      {
        id: 'rating',
        label: 'Credit rating',
        type: 'select',
        dropdownKey: 'rating',
        hasActiveFilter: (f) => (f.creditRating ? f.creditRating !== 'all' : false),
      },
    ],
  },

  mf: {
    id: 'mf',
    name: 'MF Screener',
    defaultTitle: 'All mutual funds',
    defaultSort: { field: 'marketCap', direction: 'desc' }, // AUM
    tabs: MF_TABS,
    pillConfigs: [
      { id: 'watchlist', label: 'Watchlist', type: 'boolean', dropdownKey: 'watchlist' },
      {
        id: 'schemeType',
        label: 'Type (Liquid/Debt/Hybrid/Equity)',
        type: 'select',
        dropdownKey: 'schemeType',
        hasActiveFilter: (f) => (f.mfSchemeType ? f.mfSchemeType !== 'all' : false),
      },
      {
        id: 'category',
        label: 'Category',
        type: 'select',
        dropdownKey: 'category',
        hasActiveFilter: (f) => (f.mfCategory ? f.mfCategory !== 'all' : false),
      },
      {
        id: 'amc',
        label: 'AMC / Fund House',
        type: 'select',
        dropdownKey: 'amc',
        hasActiveFilter: (f) => (f.brand ? f.brand !== 'all' : false),
      },
      {
        id: 'aum',
        label: 'AUM',
        type: 'range',
        dropdownKey: 'aum',
        hasActiveFilter: (f) => (f.minAum !== null && f.minAum !== undefined),
      },
      {
        id: 'cagr3y',
        label: '3Y Return %',
        type: 'range',
        dropdownKey: 'cagr3y',
        hasActiveFilter: (f) => (f.minCagr3y !== null && f.minCagr3y !== undefined),
      },
      {
        id: 'cagr5y',
        label: '5Y Return %',
        type: 'range',
        dropdownKey: 'cagr5y',
        hasActiveFilter: (f) => (f.minCagr5y !== null && f.minCagr5y !== undefined),
      },
      {
        id: 'expenseRatio',
        label: 'Exp Ratio (Base+Total)',
        type: 'range',
        dropdownKey: 'expenseRatio',
        hasActiveFilter: (f) => (f.totalExpenseRatio !== null && f.totalExpenseRatio !== undefined) || (f.maxExpenseRatio !== null && f.maxExpenseRatio !== undefined),
      },
      {
        id: 'sharpeRatio',
        label: 'Sharpe ratio',
        type: 'range',
        dropdownKey: 'sharpeRatio',
        hasActiveFilter: (f) => (f.minSharpeRatio !== null && f.minSharpeRatio !== undefined),
      },
      {
        id: 'riskometer',
        label: 'Riskometer',
        type: 'select',
        dropdownKey: 'riskometer',
        hasActiveFilter: (f) => (f.riskometer ? f.riskometer !== 'all' : false),
      },
      {
        id: 'plan',
        label: 'Direct / Regular',
        type: 'select',
        dropdownKey: 'plan',
        hasActiveFilter: (f) => (f.planType ? f.planType !== 'all' : false),
      },
    ],
  },
};
