import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkbenchStore } from './store';

describe('useWorkbenchStore', () => {
  beforeEach(() => {
    useWorkbenchStore.setState({
      layout: 'cols2',
      activePaneIndex: 0,
      tradingState: 'active',
      orders: [],
      positions: [],
      trades: [],
      error: null,
      statusMessage: null,
    });
  });

  it('updates layout and active pane', () => {
    const store = useWorkbenchStore.getState();
    store.setLayout('grid4');
    expect(useWorkbenchStore.getState().layout).toBe('grid4');

    store.setActivePane(1);
    expect(useWorkbenchStore.getState().activePaneIndex).toBe(1);
    expect(useWorkbenchStore.getState().orderTicket.symbol).toBe('INFY');
  });

  it('supports OpenAlgo 1+2 master layout preset', () => {
    const store = useWorkbenchStore.getState();
    store.setLayout('oneTwo');
    expect(useWorkbenchStore.getState().layout).toBe('oneTwo');
  });

  it('updates pane configuration', () => {
    const store = useWorkbenchStore.getState();
    store.updatePane(0, { symbol: 'TCS', chartMode: 'area' });
    const pane = useWorkbenchStore.getState().panes[0];
    expect(pane.symbol).toBe('TCS');
    expect(pane.chartMode).toBe('area');
    expect(useWorkbenchStore.getState().orderTicket.symbol).toBe('TCS');
  });

  it('places a limit order successfully', async () => {
    const store = useWorkbenchStore.getState();
    store.setTicketField('symbol', 'RELIANCE');
    store.setTicketField('orderType', 'limit');
    store.setTicketField('price', 2900);
    store.setTicketField('quantity', 15);

    await store.placeOrder();

    const state = useWorkbenchStore.getState();
    expect(state.orders.length).toBe(1);
    expect(state.orders[0].instrument_id.symbol).toBe('RELIANCE');
    expect(state.orders[0].price).toBe(2900);
    expect(state.orders[0].quantity).toBe(15);
  });

  it('fills a market order and opens position', async () => {
    const store = useWorkbenchStore.getState();
    store.setTicketField('symbol', 'INFY');
    store.setTicketField('orderType', 'market');
    store.setTicketField('quantity', 20);

    await store.placeOrder();

    const state = useWorkbenchStore.getState();
    expect(state.trades.length).toBe(1);
    expect(state.trades[0].instrument_id.symbol).toBe('INFY');
    expect(state.positions.length).toBe(1);
    expect(state.positions[0].instrument_id.symbol).toBe('INFY');
    expect(state.positions[0].quantity).toBe(20);
  });

  it('cancels an active order', async () => {
    const store = useWorkbenchStore.getState();
    store.setTicketField('orderType', 'limit');
    await store.placeOrder();

    const initialOrders = useWorkbenchStore.getState().orders;
    expect(initialOrders.length).toBe(1);
    const orderId = initialOrders[0].order_id;

    await store.cancelOrder(undefined, orderId);
    expect(useWorkbenchStore.getState().orders.length).toBe(0);
  });

  it('closes a position and closes all positions', async () => {
    const store = useWorkbenchStore.getState();
    store.setTicketField('symbol', 'TCS');
    store.setTicketField('orderType', 'market');
    await store.placeOrder();

    expect(useWorkbenchStore.getState().positions.length).toBe(1);
    await store.closePosition(undefined, 'TCS');
    expect(useWorkbenchStore.getState().positions.length).toBe(0);

    // Place 2 positions then closeAll
    store.setTicketField('symbol', 'INFY');
    await store.placeOrder();
    store.setTicketField('symbol', 'RELIANCE');
    await store.placeOrder();
    expect(useWorkbenchStore.getState().positions.length).toBe(2);

    await store.closeAllPositions();
    expect(useWorkbenchStore.getState().positions.length).toBe(0);
  });

  it('halts trading and prevents order placement', async () => {
    const store = useWorkbenchStore.getState();
    await store.setTradingState(undefined, 'halted', 'Emergency stop');
    expect(useWorkbenchStore.getState().tradingState).toBe('halted');

    await store.placeOrder();
    expect(useWorkbenchStore.getState().error).toContain('HALTED');
    expect(useWorkbenchStore.getState().orders.length).toBe(0);
  });
});
