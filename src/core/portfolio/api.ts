import type {
  PortfolioAccount,
  PortfolioHolding,
  PortfolioPosition,
  PortfolioSnapshot,
  PortfolioTotals,
  UnixNanos,
} from './types';
import { toMoney, moneyToMajor } from './money';

const STORAGE_KEY = 'honba_portfolio_snapshot_v1';

function createUnixNanos(date = new Date()): UnixNanos {
  return {
    iso: date.toISOString(),
    unix_nanos: `${date.getTime()}000000`,
  };
}

/**
 * Recalculates mark-to-market totals for a portfolio account according to ADR 0032 §3.
 */
export function revalueAccount(account: PortfolioAccount): PortfolioAccount {
  let holdingsMarketValue = 0;
  let holdingsUnrealized = 0;
  let holdingsRealized = 0;

  const holdings = account.holdings.map((h) => {
    const mktVal = h.quantity * h.mark;
    const unPnl = (h.mark - h.avg_price) * h.quantity;
    const rlPnl = moneyToMajor(h.realized_pnl);

    holdingsMarketValue += mktVal;
    holdingsUnrealized += unPnl;
    holdingsRealized += rlPnl;

    return {
      ...h,
      market_value: toMoney(mktVal, account.currency),
      unrealized_pnl: toMoney(unPnl, account.currency),
    };
  });

  let positionsMarketValue = 0;
  let positionsUnrealized = 0;
  let positionsRealized = 0;
  let marginUsed = 0;

  const positions = account.positions.map((p) => {
    const mktVal = p.quantity * p.mark;
    const sign = p.side === 'long' ? 1 : -1;
    const unPnl = (p.mark - p.avg_price) * sign * p.quantity;
    const rlPnl = moneyToMajor(p.realized_pnl);

    // Intraday margin requirement (e.g. 20% margin for equity, or full)
    const marginReq = p.product === 'intraday' ? mktVal * 0.2 : mktVal;

    positionsMarketValue += mktVal;
    positionsUnrealized += unPnl;
    positionsRealized += rlPnl;
    marginUsed += marginReq;

    return {
      ...p,
      market_value: toMoney(mktVal, account.currency),
      unrealized_pnl: toMoney(unPnl, account.currency),
    };
  });

  const cash = moneyToMajor(account.cash);
  const totalMarketVal = holdingsMarketValue + positionsMarketValue;
  const totalUnrealized = holdingsUnrealized + positionsUnrealized;
  const totalRealized = holdingsRealized + positionsRealized;

  // Equity = Cash + Holdings Market Value + Net Positions PnL
  const equity = cash + holdingsMarketValue + totalUnrealized;
  const marginAvailable = Math.max(0, cash - marginUsed);

  return {
    ...account,
    holdings,
    positions,
    market_value: toMoney(totalMarketVal, account.currency),
    equity: toMoney(equity, account.currency),
    margin_used: toMoney(marginUsed, account.currency),
    margin_available: toMoney(marginAvailable, account.currency),
    realized_pnl: toMoney(totalRealized, account.currency),
    unrealized_pnl: toMoney(totalUnrealized, account.currency),
  };
}

/**
 * Calculates aggregate totals across all accounts in the portfolio.
 */
export function calculateTotals(accounts: PortfolioAccount[]): PortfolioTotals {
  let cash = 0;
  let equity = 0;
  let marketValue = 0;
  let realizedPnl = 0;
  let unrealizedPnl = 0;

  for (const acc of accounts) {
    cash += moneyToMajor(acc.cash);
    equity += moneyToMajor(acc.equity);
    marketValue += moneyToMajor(acc.market_value);
    realizedPnl += moneyToMajor(acc.realized_pnl);
    unrealizedPnl += moneyToMajor(acc.unrealized_pnl);
  }

  const totalPnl = realizedPnl + unrealizedPnl;

  return {
    cash: toMoney(cash, 'INR'),
    equity: toMoney(equity, 'INR'),
    market_value: toMoney(marketValue, 'INR'),
    realized_pnl: toMoney(realizedPnl, 'INR'),
    unrealized_pnl: toMoney(unrealizedPnl, 'INR'),
    total_pnl: toMoney(totalPnl, 'INR'),
  };
}

/**
 * Generates the standard default portfolio snapshot according to ADR 0032.
 */
export function getDefaultPortfolioSnapshot(): PortfolioSnapshot {
  const sandboxAccount: PortfolioAccount = {
    id: 'acc-sandbox-primary',
    name: 'Primary Paper Account',
    mode: 'sandbox',
    source: 'ledger',
    currency: 'INR',
    leverage: 1.0,
    cash: toMoney(1000000, 'INR'), // ₹10,00,000 initial capital
    equity: toMoney(0, 'INR'),
    market_value: toMoney(0, 'INR'),
    margin_used: toMoney(0, 'INR'),
    margin_available: toMoney(0, 'INR'),
    realized_pnl: toMoney(1450, 'INR'),
    unrealized_pnl: toMoney(0, 'INR'),
    holdings: [
      {
        instrument_id: { exchange: 'NSE', symbol: 'RELIANCE' },
        quantity: 50,
        avg_price: 2880.0,
        mark: 2954.2,
        market_value: toMoney(0, 'INR'),
        realized_pnl: toMoney(0, 'INR'),
        unrealized_pnl: toMoney(0, 'INR'),
      },
      {
        instrument_id: { exchange: 'NSE', symbol: 'INFY' },
        quantity: 100,
        avg_price: 1820.0,
        mark: 1895.4,
        market_value: toMoney(0, 'INR'),
        realized_pnl: toMoney(0, 'INR'),
        unrealized_pnl: toMoney(0, 'INR'),
      },
      {
        instrument_id: { exchange: 'NSE', symbol: 'TCS' },
        quantity: 25,
        avg_price: 3850.0,
        mark: 3950.0,
        market_value: toMoney(0, 'INR'),
        realized_pnl: toMoney(0, 'INR'),
        unrealized_pnl: toMoney(0, 'INR'),
      },
      {
        instrument_id: { exchange: 'NSE', symbol: 'HDFCBANK' },
        quantity: 80,
        avg_price: 1690.0,
        mark: 1720.0,
        market_value: toMoney(0, 'INR'),
        realized_pnl: toMoney(0, 'INR'),
        unrealized_pnl: toMoney(0, 'INR'),
      },
    ],
    positions: [
      {
        instrument_id: { exchange: 'NSE', symbol: 'RELIANCE' },
        side: 'long',
        product: 'intraday',
        quantity: 25,
        avg_price: 2920.5,
        mark: 2954.2,
        market_value: toMoney(0, 'INR'),
        realized_pnl: toMoney(1450, 'INR'),
        unrealized_pnl: toMoney(0, 'INR'),
      },
      {
        instrument_id: { exchange: 'NSE', symbol: 'TATAMOTORS' },
        side: 'short',
        product: 'intraday',
        quantity: 100,
        avg_price: 960.0,
        mark: 948.5,
        market_value: toMoney(0, 'INR'),
        realized_pnl: toMoney(0, 'INR'),
        unrealized_pnl: toMoney(0, 'INR'),
      },
    ],
  };

  const liveBrokerAccount: PortfolioAccount = {
    id: 'acc-broker-zerodha',
    name: 'Zerodha Kite',
    mode: 'live',
    source: 'broker',
    broker: 'zerodha',
    currency: 'INR',
    leverage: 1.0,
    cash: toMoney(245000, 'INR'), // ₹2,45,000 live funds
    equity: toMoney(0, 'INR'),
    market_value: toMoney(0, 'INR'),
    margin_used: toMoney(0, 'INR'),
    margin_available: toMoney(0, 'INR'),
    realized_pnl: toMoney(0, 'INR'),
    unrealized_pnl: toMoney(0, 'INR'),
    holdings: [
      {
        instrument_id: { exchange: 'NSE', symbol: 'ITC' },
        quantity: 200,
        avg_price: 490.0,
        mark: 505.2,
        market_value: toMoney(0, 'INR'),
        realized_pnl: toMoney(0, 'INR'),
        unrealized_pnl: toMoney(0, 'INR'),
      },
      {
        instrument_id: { exchange: 'NSE', symbol: 'SBIN' },
        quantity: 120,
        avg_price: 810.0,
        mark: 832.4,
        market_value: toMoney(0, 'INR'),
        realized_pnl: toMoney(0, 'INR'),
        unrealized_pnl: toMoney(0, 'INR'),
      },
    ],
    positions: [],
  };

  const revaluedSandbox = revalueAccount(sandboxAccount);
  const revaluedLive = revalueAccount(liveBrokerAccount);
  const accounts = [revaluedSandbox, revaluedLive];
  const totals = calculateTotals(accounts);

  return {
    owner: 'default',
    revision: 1,
    as_of: createUnixNanos(),
    base_currency: 'INR',
    accounts,
    totals,
  };
}

/**
 * Loads the stored snapshot from localStorage if present, or creates default.
 */
export function loadCachedSnapshot(): PortfolioSnapshot {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage?.getItem(STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as PortfolioSnapshot;
      if (parsed && Array.isArray(parsed.accounts) && parsed.totals) {
        return parsed;
      }
    }
  } catch {
    // ignore parse errors and fallback
  }
  return getDefaultPortfolioSnapshot();
}

/**
 * Persists the snapshot to localStorage.
 */
export function saveCachedSnapshot(snapshot: PortfolioSnapshot): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    }
  } catch {
    // ignore storage errors
  }
}

/**
 * Fetches the portfolio snapshot from the REST backend (ADR 0032 `GET /portfolio`),
 * falling back to local reactive storage if not yet implemented or offline.
 */
export async function fetchPortfolioSnapshot(): Promise<PortfolioSnapshot> {
  try {
    const res = await fetch('/api/v1/portfolio', {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.accounts) {
        saveCachedSnapshot(data);
        return data as PortfolioSnapshot;
      }
    }
  } catch {
    // Backend offline / not yet mounted, fallback
  }

  // Also try direct /portfolio endpoint
  try {
    const res = await fetch('/portfolio', {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.accounts) {
        saveCachedSnapshot(data);
        return data as PortfolioSnapshot;
      }
    }
  } catch {
    // fallback
  }

  return loadCachedSnapshot();
}
