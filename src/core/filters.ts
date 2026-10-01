/**
 * Honba Screener Comprehensive Filter Definitions & State
 * Multi-category filter criteria for Descriptive, Financials, and Technical indicators
 * across Stocks, ETFs, Bonds, and Mutual Funds.
 */

export interface AdvancedFilterState {
  // Common / Descriptive
  sector: string;
  marketCapTier: string;
  exchange: string;
  indices: string[];
  minPrice: number | null;
  maxPrice: number | null;
  minChangePercent?: number | null;
  maxChangePercent?: number | null;
  minVolume?: number | null;

  // Valuation & Fundamentals (Stocks)
  peMin: number | null;
  peMax: number | null;
  minDividendYield: number | null;
  minRoce: number | null;
  minNetMargin: number | null;
  technicalRating: string;

  // Technical Indicators
  rsiMin: number | null;
  rsiMax: number | null;
  priceAbove200Sma: boolean;
  priceAbove50Sma: boolean;
  near52WeekHigh: boolean;

  // ETF Specific Filters
  assetClass?: string;
  focus?: string;
  brand?: string;
  minAum?: number | null;
  maxAum?: number | null;
  maxExpenseRatio?: number | null;
  minNavReturn?: number | null;

  // Bond Specific Filters
  issuerType?: string;
  issuer?: string;
  minYtw?: number | null;
  maxYtw?: number | null;
  minCoupon?: number | null;
  maxCoupon?: number | null;
  couponType?: string;
  maturityYear?: number | null;
  creditRating?: string;

  // Mutual Fund (MF) Specific Filters
  mfCategory?: string;
  mfSchemeType?: string; // Liquid, Growth, Debt, Hybrid, ELSS, Overnight
  minCagr3y?: number | null;
  minCagr5y?: number | null;
  baseExpenseRatio?: number | null;
  totalExpenseRatio?: number | null;
  catTotalExpenseRatio?: number | null;
  minSharpeRatio?: number | null;
  catSharpeRatio?: number | null;
  riskometer?: string;
  planType?: string;
}

export const DEFAULT_ADVANCED_FILTERS: AdvancedFilterState = {
  sector: 'all',
  marketCapTier: 'all',
  exchange: 'all',
  indices: [],
  minPrice: null,
  maxPrice: null,
  minChangePercent: null,
  maxChangePercent: null,
  minVolume: null,
  peMin: null,
  peMax: null,
  minDividendYield: null,
  minRoce: null,
  minNetMargin: null,
  technicalRating: 'all',
  rsiMin: null,
  rsiMax: null,
  priceAbove200Sma: false,
  priceAbove50Sma: false,
  near52WeekHigh: false,

  // ETF
  assetClass: 'all',
  focus: 'all',
  brand: 'all',
  minAum: null,
  maxAum: null,
  maxExpenseRatio: null,
  minNavReturn: null,

  // Bonds
  issuerType: 'all',
  issuer: 'all',
  minYtw: null,
  maxYtw: null,
  minCoupon: null,
  maxCoupon: null,
  couponType: 'all',
  maturityYear: null,
  creditRating: 'all',

  // Mutual Funds
  mfCategory: 'all',
  mfSchemeType: 'all',
  minCagr3y: null,
  minCagr5y: null,
  baseExpenseRatio: null,
  totalExpenseRatio: null,
  catTotalExpenseRatio: null,
  minSharpeRatio: null,
  catSharpeRatio: null,
  riskometer: 'all',
  planType: 'all',
};

export function countActiveFilters(filters: AdvancedFilterState): number {
  let count = 0;
  if (filters.sector !== 'all') count++;
  if (filters.marketCapTier !== 'all') count++;
  if (filters.exchange !== 'all') count++;
  if (filters.indices && filters.indices.length > 0) count++;
  if (filters.minPrice !== null || filters.maxPrice !== null) count++;
  if (filters.minChangePercent !== undefined && filters.minChangePercent !== null) count++;
  if (filters.maxChangePercent !== undefined && filters.maxChangePercent !== null) count++;
  if (filters.minVolume !== undefined && filters.minVolume !== null) count++;
  if (filters.peMin !== null || filters.peMax !== null) count++;
  if (filters.minDividendYield !== null) count++;
  if (filters.minRoce !== null) count++;
  if (filters.minNetMargin !== null) count++;
  if (filters.technicalRating !== 'all') count++;
  if (filters.rsiMin !== null || filters.rsiMax !== null) count++;
  if (filters.priceAbove200Sma) count++;
  if (filters.priceAbove50Sma) count++;
  if (filters.near52WeekHigh) count++;

  // Multi-asset active checks
  if (filters.assetClass && filters.assetClass !== 'all') count++;
  if (filters.focus && filters.focus !== 'all') count++;
  if (filters.brand && filters.brand !== 'all') count++;
  if (filters.minAum !== null && filters.minAum !== undefined) count++;
  if (filters.maxExpenseRatio !== null && filters.maxExpenseRatio !== undefined) count++;
  if (filters.minNavReturn !== null && filters.minNavReturn !== undefined) count++;
  if (filters.issuerType && filters.issuerType !== 'all') count++;
  if (filters.issuer && filters.issuer !== 'all') count++;
  if (filters.minYtw !== null && filters.minYtw !== undefined) count++;
  if (filters.minCoupon !== null && filters.minCoupon !== undefined) count++;
  if (filters.couponType && filters.couponType !== 'all') count++;
  if (filters.creditRating && filters.creditRating !== 'all') count++;
  if (filters.mfCategory && filters.mfCategory !== 'all') count++;
  if (filters.mfSchemeType && filters.mfSchemeType !== 'all') count++;
  if (filters.minCagr3y !== null && filters.minCagr3y !== undefined) count++;
  if (filters.minCagr5y !== null && filters.minCagr5y !== undefined) count++;
  if (filters.baseExpenseRatio !== null && filters.baseExpenseRatio !== undefined) count++;
  if (filters.totalExpenseRatio !== null && filters.totalExpenseRatio !== undefined) count++;
  if (filters.minSharpeRatio !== null && filters.minSharpeRatio !== undefined) count++;
  if (filters.riskometer && filters.riskometer !== 'all') count++;
  if (filters.planType && filters.planType !== 'all') count++;

  return count;
}
