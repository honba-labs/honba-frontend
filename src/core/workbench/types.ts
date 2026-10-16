import type { Order, Position, Trade, TradingState } from '../types/generated/domain';

export type WorkbenchLayout =
  | 'single'
  | 'cols2'
  | 'rows2'
  | 'oneTwo'
  | 'grid4'
  | '1x1'
  | '1x2'
  | '2x1'
  | '2x2';

export interface ChartPaneConfig {
  id: string;
  symbol: string;
  timeframe: string;
  chartMode: 'candles' | 'area';
}

export type OrderSideChoice = 'buy' | 'sell';
export type OrderTypeChoice = 'market' | 'limit' | 'stop_market' | 'stop_limit';
export type ProductChoice = 'intraday' | 'delivery';
export type TimeInForceChoice = 'day' | 'ioc';

export interface OrderTicketDraft {
  symbol: string;
  side: OrderSideChoice;
  orderType: OrderTypeChoice;
  product: ProductChoice;
  quantity: number;
  price: number;
  triggerPrice: number;
  tif: TimeInForceChoice;
}

export interface WorkbenchPositionItem extends Position {
  ltp: number;
  unrealized_pnl: number;
}

export type DrawerTab =
  | 'holdings'
  | 'positions'
  | 'orders'
  | 'trades'
  | 'analytics'
  | 'depth';

export interface DepthLevel {
  price: number;
  orders: number;
  qty: number;
}

export interface MarketDepthData {
  bids: DepthLevel[];
  asks: DepthLevel[];
  spread: number;
  totalBidQty: number;
  totalAskQty: number;
}
