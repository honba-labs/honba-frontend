import { create } from 'zustand';
import type {
  PortfolioAccount,
  PortfolioHolding,
  PortfolioMode,
  PortfolioPosition,
  PortfolioSnapshot,
  PortfolioTotals,
  Product,
  Trade,
} from './types';
import {
  calculateTotals,
  fetchPortfolioSnapshot,
  getDefaultPortfolioSnapshot,
  revalueAccount,
  saveCachedSnapshot,
} from './api';
import { moneyToMajor, toMoney } from './money';

export interface PortfolioState {
  snapshot: PortfolioSnapshot;
  activeAccountId: string;
  searchQuery: string;
  modeFilter: 'all' | 'sandbox' | 'live';
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;

  // Actions
  loadPortfolio: () => Promise<void>;
  setActiveAccount: (accountId: string) => void;
  setSearchQuery: (query: string) => void;
  setModeFilter: (filter: 'all' | 'sandbox' | 'live') => void;
  closePosition: (symbol: string) => void;
  closeAllPositions: () => void;
  applyTrade: (trade: Trade, product?: Product) => void;
  revalueWithMarks: (marks: Record<string, number>) => void;
  resetToDefault: () => void;
  getActiveAccount: () => PortfolioAccount | undefined;
}

export const usePortfolioStore = create<PortfolioState>((set, get) => {
  const initial = getDefaultPortfolioSnapshot();

  return {
    snapshot: initial,
    activeAccountId: initial.accounts[0]?.id ?? 'acc-sandbox-primary',
    searchQuery: '',
    modeFilter: 'all',
    isLoading: false,
    isSyncing: false,
    error: null,

    getActiveAccount: () => {
      const { snapshot, activeAccountId } = get();
      return (
        snapshot.accounts.find((a) => a.id === activeAccountId) ??
        snapshot.accounts[0]
      );
    },

    loadPortfolio: async () => {
      set({ isLoading: true, error: null });
      try {
        const snap = await fetchPortfolioSnapshot();
        set((state) => ({
          snapshot: snap,
          isLoading: false,
          activeAccountId:
            snap.accounts.find((a) => a.id === state.activeAccountId)?.id ??
            snap.accounts[0]?.id ??
            state.activeAccountId,
        }));
      } catch (err) {
        set({
          isLoading: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },

    setActiveAccount: (accountId: string) => {
      set({ activeAccountId: accountId });
    },

    setSearchQuery: (searchQuery: string) => {
      set({ searchQuery });
    },

    setModeFilter: (modeFilter: 'all' | 'sandbox' | 'live') => {
      set({ modeFilter });
    },

    closePosition: (symbol: string) => {
      set((state) => {
        const activeAcc =
          state.snapshot.accounts.find((a) => a.id === state.activeAccountId) ??
          state.snapshot.accounts[0];
        if (!activeAcc) return state;

        const targetPos = activeAcc.positions.find(
          (p) => p.instrument_id.symbol.toUpperCase() === symbol.toUpperCase()
        );
        if (!targetPos) return state;

        const sign = targetPos.side === 'long' ? 1 : -1;
        const unPnl = (targetPos.mark - targetPos.avg_price) * sign * targetPos.quantity;
        const prevRealized = moneyToMajor(targetPos.realized_pnl);
        const newRealized = prevRealized + unPnl;

        // Return margin and add realized PnL to cash
        const prevCash = moneyToMajor(activeAcc.cash);
        const newCash = prevCash + unPnl;

        const remainingPositions = activeAcc.positions.filter(
          (p) => p.instrument_id.symbol.toUpperCase() !== symbol.toUpperCase()
        );

        const updatedAccount = revalueAccount({
          ...activeAcc,
          cash: toMoney(newCash, activeAcc.currency),
          positions: remainingPositions,
        });

        const accounts = state.snapshot.accounts.map((a) =>
          a.id === updatedAccount.id ? updatedAccount : a
        );
        const totals = calculateTotals(accounts);
        const updatedSnapshot: PortfolioSnapshot = {
          ...state.snapshot,
          revision: state.snapshot.revision + 1,
          accounts,
          totals,
        };

        saveCachedSnapshot(updatedSnapshot);
        return { snapshot: updatedSnapshot };
      });
    },

    closeAllPositions: () => {
      set((state) => {
        const activeAcc =
          state.snapshot.accounts.find((a) => a.id === state.activeAccountId) ??
          state.snapshot.accounts[0];
        if (!activeAcc || activeAcc.positions.length === 0) return state;

        let totalClosedPnl = 0;
        for (const pos of activeAcc.positions) {
          const sign = pos.side === 'long' ? 1 : -1;
          const unPnl = (pos.mark - pos.avg_price) * sign * pos.quantity;
          totalClosedPnl += unPnl;
        }

        const prevCash = moneyToMajor(activeAcc.cash);
        const newCash = prevCash + totalClosedPnl;

        const updatedAccount = revalueAccount({
          ...activeAcc,
          cash: toMoney(newCash, activeAcc.currency),
          positions: [],
        });

        const accounts = state.snapshot.accounts.map((a) =>
          a.id === updatedAccount.id ? updatedAccount : a
        );
        const totals = calculateTotals(accounts);
        const updatedSnapshot: PortfolioSnapshot = {
          ...state.snapshot,
          revision: state.snapshot.revision + 1,
          accounts,
          totals,
        };

        saveCachedSnapshot(updatedSnapshot);
        return { snapshot: updatedSnapshot };
      });
    },

    applyTrade: (trade: Trade, product: Product = 'intraday') => {
      set((state) => {
        const activeAcc =
          state.snapshot.accounts.find((a) => a.id === state.activeAccountId) ??
          state.snapshot.accounts[0];
        if (!activeAcc) return state;

        const sym = trade.instrument_id.symbol.toUpperCase();
        const price = trade.price;
        const qty = trade.quantity;
        const side = trade.side; // 'buy' | 'sell'
        const tradeCost = moneyToMajor(trade.costs);
        let cash = moneyToMajor(activeAcc.cash) - tradeCost;

        if (product === 'delivery') {
          // Delivery trade affects holdings
          let holdings = [...activeAcc.holdings];
          const existingIdx = holdings.findIndex(
            (h) => h.instrument_id.symbol.toUpperCase() === sym
          );

          if (side === 'buy') {
            cash -= price * qty;
            if (existingIdx >= 0) {
              const current = holdings[existingIdx];
              const totalCost = current.quantity * current.avg_price + qty * price;
              const newQty = current.quantity + qty;
              holdings[existingIdx] = {
                ...current,
                quantity: newQty,
                avg_price: totalCost / newQty,
                mark: price,
              };
            } else {
              holdings.push({
                instrument_id: trade.instrument_id,
                quantity: qty,
                avg_price: price,
                mark: price,
                market_value: toMoney(0, activeAcc.currency),
                realized_pnl: toMoney(0, activeAcc.currency),
                unrealized_pnl: toMoney(0, activeAcc.currency),
              });
            }
          } else {
            // Sell delivery holding
            cash += price * qty;
            if (existingIdx >= 0) {
              const current = holdings[existingIdx];
              const remainingQty = current.quantity - qty;
              const rlPnl = (price - current.avg_price) * Math.min(qty, current.quantity);
              const prevRealized = moneyToMajor(current.realized_pnl);

              if (remainingQty <= 0) {
                holdings = holdings.filter((_, i) => i !== existingIdx);
              } else {
                holdings[existingIdx] = {
                  ...current,
                  quantity: remainingQty,
                  mark: price,
                  realized_pnl: toMoney(prevRealized + rlPnl, activeAcc.currency),
                };
              }
            }
          }

          const updatedAccount = revalueAccount({
            ...activeAcc,
            cash: toMoney(cash, activeAcc.currency),
            holdings,
          });

          const accounts = state.snapshot.accounts.map((a) =>
            a.id === updatedAccount.id ? updatedAccount : a
          );
          const totals = calculateTotals(accounts);
          const updatedSnapshot: PortfolioSnapshot = {
            ...state.snapshot,
            revision: state.snapshot.revision + 1,
            accounts,
            totals,
          };
          saveCachedSnapshot(updatedSnapshot);
          return { snapshot: updatedSnapshot };
        } else {
          // Intraday trade affects positions
          let positions = [...activeAcc.positions];
          const existingIdx = positions.findIndex(
            (p) => p.instrument_id.symbol.toUpperCase() === sym
          );

          if (existingIdx >= 0) {
            const current = positions[existingIdx];
            const isSameSide =
              (current.side === 'long' && side === 'buy') ||
              (current.side === 'short' && side === 'sell');

            if (isSameSide) {
              const totalCost = current.quantity * current.avg_price + qty * price;
              const newQty = current.quantity + qty;
              positions[existingIdx] = {
                ...current,
                quantity: newQty,
                avg_price: totalCost / newQty,
                mark: price,
              };
            } else {
              // Offsetting side
              const closeQty = Math.min(qty, current.quantity);
              const sign = current.side === 'long' ? 1 : -1;
              const rlPnl = (price - current.avg_price) * sign * closeQty;
              cash += rlPnl;
              const prevRealized = moneyToMajor(current.realized_pnl);

              if (qty === current.quantity) {
                // Completely closed
                positions = positions.filter((_, i) => i !== existingIdx);
              } else if (qty < current.quantity) {
                // Partially closed
                positions[existingIdx] = {
                  ...current,
                  quantity: current.quantity - qty,
                  mark: price,
                  realized_pnl: toMoney(prevRealized + rlPnl, activeAcc.currency),
                };
              } else {
                // Reversed position
                const newSide = side === 'buy' ? 'long' : 'short';
                const reversedQty = qty - current.quantity;
                positions[existingIdx] = {
                  ...current,
                  side: newSide,
                  quantity: reversedQty,
                  avg_price: price,
                  mark: price,
                  realized_pnl: toMoney(prevRealized + rlPnl, activeAcc.currency),
                };
              }
            }
          } else {
            // New position
            positions.push({
              instrument_id: trade.instrument_id,
              side: side === 'buy' ? 'long' : 'short',
              product: 'intraday',
              quantity: qty,
              avg_price: price,
              mark: price,
              market_value: toMoney(0, activeAcc.currency),
              realized_pnl: toMoney(0, activeAcc.currency),
              unrealized_pnl: toMoney(0, activeAcc.currency),
            });
          }

          const updatedAccount = revalueAccount({
            ...activeAcc,
            cash: toMoney(cash, activeAcc.currency),
            positions,
          });

          const accounts = state.snapshot.accounts.map((a) =>
            a.id === updatedAccount.id ? updatedAccount : a
          );
          const totals = calculateTotals(accounts);
          const updatedSnapshot: PortfolioSnapshot = {
            ...state.snapshot,
            revision: state.snapshot.revision + 1,
            accounts,
            totals,
          };
          saveCachedSnapshot(updatedSnapshot);
          return { snapshot: updatedSnapshot };
        }
      });
    },

    revalueWithMarks: (marks: Record<string, number>) => {
      set((state) => {
        let changed = false;
        const accounts = state.snapshot.accounts.map((acc) => {
          let accChanged = false;
          const holdings = acc.holdings.map((h) => {
            const sym = h.instrument_id.symbol.toUpperCase();
            if (marks[sym] !== undefined && marks[sym] !== h.mark) {
              accChanged = true;
              return { ...h, mark: marks[sym] };
            }
            return h;
          });

          const positions = acc.positions.map((p) => {
            const sym = p.instrument_id.symbol.toUpperCase();
            if (marks[sym] !== undefined && marks[sym] !== p.mark) {
              accChanged = true;
              return { ...p, mark: marks[sym] };
            }
            return p;
          });

          if (accChanged) {
            changed = true;
            return revalueAccount({ ...acc, holdings, positions });
          }
          return acc;
        });

        if (!changed) return state;

        const totals = calculateTotals(accounts);
        const updatedSnapshot: PortfolioSnapshot = {
          ...state.snapshot,
          accounts,
          totals,
        };
        saveCachedSnapshot(updatedSnapshot);
        return { snapshot: updatedSnapshot };
      });
    },

    resetToDefault: () => {
      const fresh = getDefaultPortfolioSnapshot();
      saveCachedSnapshot(fresh);
      set({
        snapshot: fresh,
        activeAccountId: fresh.accounts[0]?.id ?? 'acc-sandbox-primary',
        searchQuery: '',
        modeFilter: 'all',
        error: null,
      });
    },
  };
});
