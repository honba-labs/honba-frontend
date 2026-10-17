import { usePortfolioStore } from '../../portfolio/store';
import { toMoney } from '../../portfolio/money';
import type { Trade } from '../../types/generated/domain';
import type { ActivePosition } from './types';

/**
 * Sandboxed Portfolio Adapter.
 *
 * Hooks the client-side simulator directly to `usePortfolioStore`:
 * - Dispatches simulated trades to the selected sandbox account
 * - Updates real-time mark prices on every tick/bar
 * - Tracks active simulated positions and P&L
 * - Keeps P&L and positions persistent until explicitly cleared
 */

export function getSandboxAccounts() {
  const store = usePortfolioStore.getState();
  const accounts = store.snapshot.accounts.filter(
    (a) => a.mode === 'sandbox' || a.id.includes('sandbox'),
  );
  if (accounts.length === 0) {
    return store.snapshot.accounts;
  }
  return accounts;
}

export function executeSimulatedTrade(
  symbol: string,
  exchange: string,
  side: 'buy' | 'sell',
  quantity: number,
  price: number,
  timestampSec: number,
) {
  const instrumentId = `${symbol}.${exchange}`;
  const nanos = `${BigInt(Math.floor(timestampSec)) * 1000000000n}`;

  const trade: any = {
    instrument_id: { symbol, exchange },
    order_id: `ord-sim-${timestampSec}-${Math.random().toString(36).slice(2, 7)}`,
    price,
    quantity,
    side,
    ts_event: nanos,
    ts_init: nanos,
    costs: toMoney(10.0, 'INR'),
  };

  usePortfolioStore.getState().applyTrade(trade, 'intraday');
}

export function updatePortfolioMarkPrice(symbol: string, exchange: string, price: number) {
  const instrumentId = `${symbol}.${exchange}`;
  usePortfolioStore.getState().revalueWithMarks({
    [instrumentId]: price,
    [symbol]: price,
  });
}

export function clearSandboxPortfolio(accountId?: string) {
  const store = usePortfolioStore.getState();
  const targetId = accountId ?? store.activeAccountId;

  // Clear positions and trades for the account
  store.closeAllPositions();
  
  // Re-value to refresh totals
  store.revalueWithMarks({});
}

export function calculatePositionPnL(
  position: ActivePosition | null,
  currentPrice: number,
): { unrealizedPnl: number; returnPct: number } {
  if (!position || position.quantity === 0) {
    return { unrealizedPnl: 0, returnPct: 0 };
  }

  const mult = position.side === 'long' ? 1 : -1;
  const unrealizedPnl = (currentPrice - position.entryPrice) * position.quantity * mult;
  const returnPct = position.entryPrice > 0 ? ((currentPrice - position.entryPrice) / position.entryPrice) * mult : 0;

  return { unrealizedPnl, returnPct };
}
