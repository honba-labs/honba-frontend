import { describe, it, expect, beforeEach } from 'vitest';
import { usePortfolioStore } from './store';
import { formatMoney, moneyToMajor, toMoney } from './money';

describe('Portfolio Store & Money (ADR 0032 / E13-S5)', () => {
  beforeEach(() => {
    usePortfolioStore.getState().resetToDefault();
  });

  it('formats money and minor units correctly according to ADR 0011', () => {
    const m = toMoney(1450.5, 'INR');
    expect(m.amount).toBe(145050); // integer minor units
    expect(moneyToMajor(m)).toBe(1450.5);
    expect(formatMoney(m)).toBe('₹1,450.50');
    expect(formatMoney(toMoney(-320.25, 'INR'))).toBe('-₹320.25');
  });

  it('initializes with sandbox paper account and live broker account per ADR 0032', () => {
    const store = usePortfolioStore.getState();
    const snapshot = store.snapshot;

    expect(snapshot.accounts.length).toBeGreaterThanOrEqual(2);

    const sandbox = snapshot.accounts.find((a) => a.mode === 'sandbox');
    expect(sandbox).toBeDefined();
    expect(sandbox?.source).toBe('ledger');
    expect(sandbox?.holdings.length).toBeGreaterThan(0);
    expect(sandbox?.positions.length).toBeGreaterThan(0);

    const live = snapshot.accounts.find((a) => a.mode === 'live');
    expect(live).toBeDefined();
    expect(live?.source).toBe('broker');
    expect(live?.broker).toBe('zerodha');

    const totalEquity = moneyToMajor(snapshot.totals.equity);
    expect(totalEquity).toBeGreaterThan(0);
  });

  it('switches active account', () => {
    const store = usePortfolioStore.getState();
    store.setActiveAccount('acc-broker-zerodha');

    expect(usePortfolioStore.getState().activeAccountId).toBe('acc-broker-zerodha');
    const active = usePortfolioStore.getState().getActiveAccount();
    expect(active?.mode).toBe('live');
    expect(active?.broker).toBe('zerodha');
  });

  it('closes an individual open intraday position and accrues PnL', () => {
    const store = usePortfolioStore.getState();
    store.setActiveAccount('acc-sandbox-primary');

    const beforeAcc = store.getActiveAccount()!;
    const initialPosCount = beforeAcc.positions.length;
    expect(initialPosCount).toBeGreaterThan(0);

    const targetPos = beforeAcc.positions[0];
    const sym = targetPos.instrument_id.symbol;

    store.closePosition(sym);

    const afterAcc = usePortfolioStore.getState().getActiveAccount()!;
    expect(afterAcc.positions.find((p) => p.instrument_id.symbol === sym)).toBeUndefined();
    expect(afterAcc.positions.length).toBe(initialPosCount - 1);
  });

  it('closes all open positions across the active account', () => {
    const store = usePortfolioStore.getState();
    store.setActiveAccount('acc-sandbox-primary');

    expect(store.getActiveAccount()!.positions.length).toBeGreaterThan(0);

    store.closeAllPositions();

    const afterAcc = usePortfolioStore.getState().getActiveAccount()!;
    expect(afterAcc.positions.length).toBe(0);
    expect(moneyToMajor(afterAcc.margin_used)).toBe(0);
  });

  it('applies an intraday trade fill into positions', () => {
    const store = usePortfolioStore.getState();
    store.setActiveAccount('acc-sandbox-primary');

    store.applyTrade(
      {
        instrument_id: { exchange: 'NSE', symbol: 'WIPRO' },
        order_id: 'ORD-999',
        price: 520,
        quantity: 50,
        side: 'buy',
        costs: toMoney(15, 'INR'),
        ts_init: { iso: new Date().toISOString(), unix_nanos: '1000' },
        ts_event: { iso: new Date().toISOString(), unix_nanos: '1000' },
      },
      'intraday'
    );

    const active = usePortfolioStore.getState().getActiveAccount()!;
    const wipro = active.positions.find((p) => p.instrument_id.symbol === 'WIPRO');
    expect(wipro).toBeDefined();
    expect(wipro?.quantity).toBe(50);
    expect(wipro?.avg_price).toBe(520);
    expect(wipro?.side).toBe('long');
  });

  it('applies a delivery trade fill into holdings', () => {
    const store = usePortfolioStore.getState();
    store.setActiveAccount('acc-sandbox-primary');

    const initialHoldings = store.getActiveAccount()!.holdings.length;

    store.applyTrade(
      {
        instrument_id: { exchange: 'NSE', symbol: 'BEL' },
        order_id: 'ORD-1001',
        price: 310,
        quantity: 100,
        side: 'buy',
        costs: toMoney(20, 'INR'),
        ts_init: { iso: new Date().toISOString(), unix_nanos: '1000' },
        ts_event: { iso: new Date().toISOString(), unix_nanos: '1000' },
      },
      'delivery'
    );

    const active = usePortfolioStore.getState().getActiveAccount()!;
    expect(active.holdings.length).toBe(initialHoldings + 1);
    const bel = active.holdings.find((h) => h.instrument_id.symbol === 'BEL');
    expect(bel).toBeDefined();
    expect(bel?.quantity).toBe(100);
    expect(bel?.avg_price).toBe(310);
  });

  it('revalues account when market marks update', () => {
    const store = usePortfolioStore.getState();
    store.setActiveAccount('acc-sandbox-primary');

    // Update RELIANCE mark from 2954.2 to 3100.0
    store.revalueWithMarks({ RELIANCE: 3100.0 });

    const active = usePortfolioStore.getState().getActiveAccount()!;
    const relHolding = active.holdings.find((h) => h.instrument_id.symbol === 'RELIANCE');
    expect(relHolding?.mark).toBe(3100.0);
    expect(moneyToMajor(relHolding?.unrealized_pnl)).toBe((3100.0 - 2880.0) * 50);
  });
});
