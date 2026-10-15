import { create } from 'zustand';
import type { HonbaClient } from '../api/generated/client';
import type { Order, Trade, TradingState } from '../types/generated/domain';
import { INSTRUMENTS_DATABASE } from '../market-data';
import type {
  ChartPaneConfig,
  DrawerTab,
  OrderTicketDraft,
  WorkbenchLayout,
  WorkbenchPositionItem,
} from './types';

const DEFAULT_PANES: ChartPaneConfig[] = [
  { id: 'pane-0', symbol: 'RELIANCE', timeframe: '1D', chartMode: 'candles' },
  { id: 'pane-1', symbol: 'INFY', timeframe: '1D', chartMode: 'candles' },
  { id: 'pane-2', symbol: 'HDFCBANK', timeframe: '1D', chartMode: 'candles' },
  { id: 'pane-3', symbol: 'TCS', timeframe: '1D', chartMode: 'candles' },
];

function getInstrumentPrice(symbol: string): number {
  const match = INSTRUMENTS_DATABASE.find((i) => i.symbol.toUpperCase() === symbol.toUpperCase());
  return match?.price ?? 1000;
}

const INITIAL_POSITIONS: WorkbenchPositionItem[] = [
  {
    instrument_id: { exchange: 'NSE', symbol: 'RELIANCE' },
    side: 'long',
    quantity: 50,
    avg_price: 2920.5,
    currency: 'INR',
    realized_pnl: { amount: 1450.0, currency: 'INR' },
    ltp: 2954.2,
    unrealized_pnl: (2954.2 - 2920.5) * 50,
  },
  {
    instrument_id: { exchange: 'NSE', symbol: 'INFY' },
    side: 'long',
    quantity: 100,
    avg_price: 1880.0,
    currency: 'INR',
    realized_pnl: { amount: -320.0, currency: 'INR' },
    ltp: 1895.4,
    unrealized_pnl: (1895.4 - 1880.0) * 100,
  },
];

const INITIAL_ORDERS: Order[] = [
  {
    order_id: 'ORD-10928',
    instrument_id: { exchange: 'NSE', symbol: 'TCS' },
    order_type: 'limit',
    side: 'buy',
    quantity: 20,
    price: 3950.0,
    status: 'accepted',
    product: 'intraday',
    time_in_force: 'day',
    ts_init: { iso: new Date().toISOString(), unix_nanos: `${Date.now()}000000` },
    ts_event: { iso: new Date().toISOString(), unix_nanos: `${Date.now()}000000` },
  },
  {
    order_id: 'ORD-10927',
    instrument_id: { exchange: 'NSE', symbol: 'HDFCBANK' },
    order_type: 'limit',
    side: 'sell',
    quantity: 40,
    price: 1720.0,
    status: 'accepted',
    product: 'intraday',
    time_in_force: 'day',
    ts_init: { iso: new Date().toISOString(), unix_nanos: `${Date.now()}000000` },
    ts_event: { iso: new Date().toISOString(), unix_nanos: `${Date.now()}000000` },
  },
];

export interface WorkbenchState {
  layout: WorkbenchLayout;
  activePaneIndex: number;
  panes: ChartPaneConfig[];
  orderTicket: OrderTicketDraft;
  positions: WorkbenchPositionItem[];
  orders: Order[];
  trades: Trade[];
  tradingState: TradingState;
  drawerTab: DrawerTab;
  isDrawerOpen: boolean;
  statusMessage: string | null;
  error: string | null;

  setLayout: (layout: WorkbenchLayout) => void;
  setActivePane: (index: number) => void;
  updatePane: (index: number, updates: Partial<ChartPaneConfig>) => void;
  setTicketField: <K extends keyof OrderTicketDraft>(key: K, value: OrderTicketDraft[K]) => void;
  syncTicketWithSymbol: (symbol: string) => void;
  placeOrder: (client?: HonbaClient) => Promise<void>;
  cancelOrder: (client: HonbaClient | undefined, orderId: string) => Promise<void>;
  closePosition: (client: HonbaClient | undefined, symbol: string) => Promise<void>;
  closeAllPositions: (client?: HonbaClient) => Promise<void>;
  setTradingState: (client: HonbaClient | undefined, state: TradingState, reason?: string) => Promise<void>;
  fetchState: (client: HonbaClient) => Promise<void>;
  setDrawerTab: (tab: DrawerTab) => void;
  toggleDrawer: () => void;
  dismissStatus: () => void;
}

export const useWorkbenchStore = create<WorkbenchState>((set, get) => ({
  layout: '1x2',
  activePaneIndex: 0,
  panes: DEFAULT_PANES,
  orderTicket: {
    symbol: 'RELIANCE',
    side: 'buy',
    orderType: 'limit',
    product: 'intraday',
    quantity: 25,
    price: getInstrumentPrice('RELIANCE'),
    triggerPrice: 0,
    tif: 'day',
  },
  positions: INITIAL_POSITIONS,
  orders: INITIAL_ORDERS,
  trades: [],
  tradingState: 'active',
  drawerTab: 'positions',
  isDrawerOpen: false,
  statusMessage: null,
  error: null,

  setLayout: (layout) => set({ layout }),

  setActivePane: (index) => {
    const pane = get().panes[index];
    if (pane) {
      set({ activePaneIndex: index });
      get().syncTicketWithSymbol(pane.symbol);
    }
  },

  updatePane: (index, updates) => {
    set((state) => {
      const panes = [...state.panes];
      if (panes[index]) {
        panes[index] = { ...panes[index], ...updates };
      }
      return { panes };
    });
    if (updates.symbol && index === get().activePaneIndex) {
      get().syncTicketWithSymbol(updates.symbol);
    }
  },

  setTicketField: (key, value) => {
    set((state) => ({
      orderTicket: { ...state.orderTicket, [key]: value },
    }));
  },

  syncTicketWithSymbol: (symbol) => {
    const ltp = getInstrumentPrice(symbol);
    set((state) => ({
      orderTicket: {
        ...state.orderTicket,
        symbol: symbol.toUpperCase(),
        price: ltp,
      },
    }));
  },

  placeOrder: async (client) => {
    const { orderTicket, tradingState } = get();
    if (tradingState === 'halted') {
      set({ error: 'Cannot place order: Trading state is HALTED' });
      return;
    }

    const orderId = `ORD-${Date.now().toString().slice(-5)}`;
    const ltp = orderTicket.orderType === 'market' ? getInstrumentPrice(orderTicket.symbol) : orderTicket.price;
    const nowIso = new Date().toISOString();
    const nowNanos = `${Date.now()}000000`;

    const newOrder: Order = {
      order_id: orderId,
      instrument_id: { exchange: 'NSE', symbol: orderTicket.symbol },
      order_type: orderTicket.orderType,
      side: orderTicket.side,
      quantity: orderTicket.quantity,
      price: ltp,
      status: orderTicket.orderType === 'market' ? 'filled' : 'accepted',
      product: orderTicket.product,
      time_in_force: orderTicket.tif,
      ts_init: { iso: nowIso, unix_nanos: nowNanos },
      ts_event: { iso: nowIso, unix_nanos: nowNanos },
    };

    if (client) {
      try {
        await client.postOrders({
          client_order_id: orderId,
          instrument_id: { exchange: 'NSE', symbol: orderTicket.symbol },
          order_type: orderTicket.orderType,
          side: orderTicket.side,
          qty: orderTicket.quantity,
          price: ltp,
          tif: orderTicket.tif,
        });
      } catch (err) {
        // Fall back to local optimistic state if backend is mock/local
        set({ error: err instanceof Error ? err.message : String(err) });
      }
    }

    if (orderTicket.orderType === 'market') {
      const trade: Trade = {
        instrument_id: { exchange: 'NSE', symbol: orderTicket.symbol },
        order_id: orderId,
        price: ltp,
        quantity: orderTicket.quantity,
        side: orderTicket.side,
        costs: { amount: Number((ltp * orderTicket.quantity * 0.0003).toFixed(2)), currency: 'INR' },
        ts_init: { iso: nowIso, unix_nanos: nowNanos },
        ts_event: { iso: nowIso, unix_nanos: nowNanos },
      };

      set((state) => {
        const existingIdx = state.positions.findIndex(
          (p) => p.instrument_id.symbol === orderTicket.symbol
        );
        let updatedPositions = [...state.positions];

        if (existingIdx >= 0) {
          const current = updatedPositions[existingIdx];
          const newQty = orderTicket.side === 'buy' ? current.quantity + orderTicket.quantity : current.quantity - orderTicket.quantity;
          if (newQty <= 0) {
            updatedPositions = updatedPositions.filter((_, i) => i !== existingIdx);
          } else {
            updatedPositions[existingIdx] = {
              ...current,
              quantity: newQty,
              ltp,
              unrealized_pnl: (ltp - current.avg_price) * newQty,
            };
          }
        } else if (orderTicket.side === 'buy') {
          updatedPositions.push({
            instrument_id: { exchange: 'NSE', symbol: orderTicket.symbol },
            side: 'long',
            quantity: orderTicket.quantity,
            avg_price: ltp,
            currency: 'INR',
            realized_pnl: { amount: 0, currency: 'INR' },
            ltp,
            unrealized_pnl: 0,
          });
        }

        return {
          trades: [trade, ...state.trades],
          positions: updatedPositions,
          statusMessage: `Market order ${orderId} filled for ${orderTicket.quantity}x ${orderTicket.symbol} @ ₹${ltp}`,
          error: null,
        };
      });
    } else {
      set((state) => ({
        orders: [newOrder, ...state.orders],
        statusMessage: `Limit order ${orderId} placed for ${orderTicket.quantity}x ${orderTicket.symbol} @ ₹${ltp}`,
        error: null,
      }));
    }
  },

  cancelOrder: async (client, orderId) => {
    if (client) {
      try {
        await client.deleteOrdersById(orderId);
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) });
      }
    }
    set((state) => ({
      orders: state.orders.filter((o) => o.order_id !== orderId),
      statusMessage: `Order ${orderId} cancelled`,
    }));
  },

  closePosition: async (client, symbol) => {
    if (client) {
      try {
        await client.postPositionsClose();
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) });
      }
    }
    set((state) => ({
      positions: state.positions.filter((p) => p.instrument_id.symbol !== symbol),
      statusMessage: `Closed position for ${symbol}`,
    }));
  },

  closeAllPositions: async (client) => {
    if (client) {
      try {
        await client.postPositionsClose();
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) });
      }
    }
    set({
      positions: [],
      statusMessage: 'All open positions have been closed',
    });
  },

  setTradingState: async (client, state, reason) => {
    if (client) {
      try {
        await client.putTradingState({ state, reason: reason ?? 'User operator manual toggle' });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) });
      }
    }
    set({
      tradingState: state,
      statusMessage: `Trading state transitioned to ${state.toUpperCase()}`,
    });
  },

  fetchState: async (client) => {
    try {
      const [tradingStateRes, ordersRes] = await Promise.all([
        client.getTradingState(),
        client.getOrders(),
      ]);
      set({
        tradingState: tradingStateRes.data?.state ?? 'active',
        orders: ordersRes.data?.orders ?? [],
        error: null,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  setDrawerTab: (drawerTab) => set({ drawerTab }),
  toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),
  dismissStatus: () => set({ statusMessage: null, error: null }),
}));
