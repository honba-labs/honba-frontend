import type {
  Currency,
  InstrumentId,
  Money,
  PortfolioAccount,
  PortfolioGreeks,
  PortfolioHolding,
  PortfolioMode,
  PortfolioPosition,
  PortfolioSnapshot,
  PortfolioSource,
  PortfolioTotals,
  PositionSide,
  Product,
  Trade,
  UnixNanos,
} from '../types/generated/domain';

export type {
  Currency,
  InstrumentId,
  Money,
  PortfolioAccount,
  PortfolioGreeks,
  PortfolioHolding,
  PortfolioMode,
  PortfolioPosition,
  PortfolioSnapshot,
  PortfolioSource,
  PortfolioTotals,
  PositionSide,
  Product,
  Trade,
  UnixNanos,
};

export type PortfolioTab =
  | 'accounts'
  | 'holdings'
  | 'positions'
  | 'orders'
  | 'trades'
  | 'analytics'
  | 'depth';

export interface PortfolioFilterState {
  searchQuery: string;
  modeFilter: 'all' | 'sandbox' | 'live';
  groupFilter?: string;
}
