import { INSTRUMENTS_DATABASE } from './market-data';
import { MARKET_INDICES } from './indices';
import { BHAVCOPY_SYMBOL_POOL } from './bhavcopy-pool';
import { dataLayer } from './data-layer';
import { isPlainSymbol, parseExpression } from 'openalgo-charts/transform';

export type SymbolCategory = 'ALL' | 'Index' | 'Cash' | 'F&O' | 'Commodity' | 'Crypto';

export interface SearchResultItem {
  symbol: string;
  name: string;
  exchange: string;
  category: SymbolCategory;
  type: string; // 'INDEX' | 'EQ' | 'SME' | 'FUT' | 'CE' | 'PE' | 'COMM' | 'CRYPTO' | 'ETF' | 'MF' | 'BOND' | 'REIT' | 'INVIT' | 'EXPR' | 'CUSTOM';
  price: number;
  change?: number;
  changePercent?: number;
  isExpression?: boolean;
  isCustom?: boolean;
}

interface PoolEntry {
  symbol: string;
  symbolUpper: string;
  name: string;
  nameUpper: string;
  exchange: string;
  exchangeUpper: string;
  category: SymbolCategory;
  type: string;
  price: number;
  change: number;
  changePercent: number;
  isPriority: boolean;
  rankOrder: number;
}

const INDEX_EXCHANGE_BY_COUNTRY: Record<string, string> = {
  IN: 'NSE_INDEX',
  US: 'US_INDEX',
  JP: 'TSE_INDEX',
  UK: 'LSE_INDEX',
};

const KNOWN_INDEX_PRICES: Record<string, number> = {
  NIFTY: 24850.0,
  SENSEX: 81650.0,
  BANKNIFTY: 51800.0,
  FINNIFTY: 23600.0,
  MIDCPNIFTY: 12950.0,
  INDIAVIX: 13.5,
  CNXFINANCE: 23600.0,
  CNX500: 22940.0,
  NIFTYJR: 73420.0,
  CNXAUTO: 25840.0,
  CNXPHARMA: 22910.0,
  CNXPSUBANK: 6780.0,
  CNXIT: 42150.0,
  CNXMETAL: 9640.0,
  CNXFMCG: 61820.0,
  CNXREALTY: 1045.0,
  NIFTYFINSRV25_50: 24890.0,
  SPX: 5840.0,
  NDX: 20350.0,
  DJI: 43050.0,
  RUT: 2245.0,
  SOX: 5280.0,
  XLK: 232.0,
  XLF: 47.2,
  XLE: 91.5,
  XLV: 152.8,
  N225: 39600.0,
  TOPIX: 2735.0,
  JPX400: 24850.0,
  FTSE100: 8290.0,
  FTSE250: 20980.0,
  FTSEALL: 4520.0,
};

const ALL_INDEX_CODES = new Set<string>(
  Object.values(MARKET_INDICES)
    .flat()
    .map((idx) => idx.code.toUpperCase())
);

/**
 * Maps an exchange or symbol context to its segment category
 */
export function getCategoryOf(exchange: string, symbol = ''): SymbolCategory {
  const ex = exchange.toUpperCase();
  const sym = symbol.toUpperCase();

  if (
    ex.endsWith('_INDEX') ||
    ex === 'INDEX' ||
    sym === 'NIFTY' ||
    sym === 'BANKNIFTY' ||
    sym === 'SENSEX' ||
    sym === 'FINNIFTY' ||
    sym === 'MIDCPNIFTY' ||
    sym === 'INDIAVIX' ||
    ALL_INDEX_CODES.has(sym)
  ) {
    return 'Index';
  }
  if (
    ex === 'NFO' ||
    ex === 'BFO' ||
    sym.endsWith('FUT') ||
    /\d+(CE|PE)$/.test(sym)
  ) {
    return 'F&O';
  }
  if (
    ex === 'MCX' ||
    ex === 'NCDEX' ||
    sym === 'GOLD' ||
    sym === 'GOLDM' ||
    sym === 'SILVER' ||
    sym === 'SILVERM' ||
    sym === 'CRUDEOIL' ||
    sym === 'NATURALGAS' ||
    sym === 'COPPER' ||
    sym === 'ZINC' ||
    sym === 'ALUMINIUM' ||
    sym === 'LEAD'
  ) {
    return 'Commodity';
  }
  if (
    ex === 'CRYPTO' ||
    sym.endsWith('USDT') ||
    sym === 'BTCUSD' ||
    sym === 'ETHUSD' ||
    sym === 'SOLUSD' ||
    sym === 'BTC' ||
    sym === 'ETH'
  ) {
    return 'Crypto';
  }
  return 'Cash';
}

/**
 * Returns a short instrument type badge
 */
export function getTypeBadge(item: { symbol: string; exchange: string; assetType?: string; badgeType?: string }): string {
  const sym = item.symbol.toUpperCase();
  const ex = item.exchange.toUpperCase();

  if (
    ex.endsWith('_INDEX') ||
    sym === 'NIFTY' ||
    sym === 'BANKNIFTY' ||
    sym === 'SENSEX' ||
    sym === 'FINNIFTY' ||
    sym === 'MIDCPNIFTY' ||
    sym === 'INDIAVIX' ||
    ALL_INDEX_CODES.has(sym) ||
    item.assetType === 'index'
  ) {
    return 'INDEX';
  }
  if (item.badgeType) return item.badgeType;
  if (ex === 'NFO' || ex === 'BFO') {
    if (sym.endsWith('CE')) return 'CE';
    if (sym.endsWith('PE')) return 'PE';
    if (sym.endsWith('FUT')) return 'FUT';
  }
  if (/\d+CE$/.test(sym)) return 'CE';
  if (/\d+PE$/.test(sym)) return 'PE';
  if (sym.endsWith('FUT')) return 'FUT';
  if (ex === 'CRYPTO') return 'CRYPTO';
  if (ex === 'MCX' || ex === 'NCDEX') return 'COMM';
  if (item.assetType === 'etf') return 'ETF';
  if (item.assetType === 'mf' || ex === 'AMFI') return 'MF';
  if (item.assetType === 'bonds') return 'BOND';
  return 'EQ';
}

/**
 * Detects if a text string is an arithmetic expression over symbols (e.g. NIFTY/BANKNIFTY)
 */
export function isArithmeticExpression(text: string): boolean {
  const q = text.trim();
  if (!q || isPlainSymbol(q)) return false;
  try {
    parseExpression(q);
    return true;
  } catch {
    return /[+\-*/^]/.test(q);
  }
}

let cachedPool: PoolEntry[] | null = null;
let cachedPoolBySymbol: Map<string, PoolEntry> | null = null;
let lastDataLayerLength = -1;

function ensureSymbolPool(): { list: PoolEntry[]; bySymbol: Map<string, PoolEntry> } {
  const liveInstruments = dataLayer?.getAllInstruments?.() ?? INSTRUMENTS_DATABASE;
  if (cachedPool && cachedPoolBySymbol && lastDataLayerLength === liveInstruments.length) {
    return { list: cachedPool, bySymbol: cachedPoolBySymbol };
  }

  const bySymbol = new Map<string, PoolEntry>();
  let order = 0;

  // 1. Add all MARKET_INDICES across IN, US, JP, UK
  for (const [country, indices] of Object.entries(MARKET_INDICES)) {
    for (const idx of indices) {
      const sym = idx.code.trim().toUpperCase();
      const ex = sym === 'SENSEX' ? 'BSE_INDEX' : (INDEX_EXCHANGE_BY_COUNTRY[country] || 'NSE_INDEX');
      const price = KNOWN_INDEX_PRICES[sym] ?? 20000.0;
      const change = Number((price * 0.0042).toFixed(2));
      bySymbol.set(sym, {
        symbol: idx.code,
        symbolUpper: sym,
        name: idx.name,
        nameUpper: idx.name.toUpperCase(),
        exchange: ex,
        exchangeUpper: ex,
        category: 'Index',
        type: 'INDEX',
        price,
        change,
        changePercent: 0.42,
        isPriority: true,
        rankOrder: order++,
      });
    }
  }

  // 2. Merge rich instruments from dataLayer / INSTRUMENTS_DATABASE
  const sourceInstruments = liveInstruments.length > 0 ? liveInstruments : INSTRUMENTS_DATABASE;
  for (const inst of sourceInstruments) {
    const sym = inst.symbol.trim().toUpperCase();
    if (!sym) continue;
    const cat = getCategoryOf(inst.exchange, sym);
    const type = getTypeBadge(inst);
    const isPriority = cat === 'Index' || inst.marketCapTier === 'mega' || inst.marketCapTier === 'large';
    bySymbol.set(sym, {
      symbol: inst.symbol,
      symbolUpper: sym,
      name: inst.name || inst.symbol,
      nameUpper: (inst.name || inst.symbol).toUpperCase(),
      exchange: inst.exchange,
      exchangeUpper: inst.exchange.toUpperCase(),
      category: cat,
      type,
      price: inst.price,
      change: inst.change ?? 0,
      changePercent: inst.changePercent ?? 0,
      isPriority,
      rankOrder: bySymbol.has(sym) ? bySymbol.get(sym)!.rankOrder : order++,
    });
  }

  // 3. Merge full available symbol pool from Honba Data (3,701 NSE bhavcopy + DuckDB + F&O + MCX + Crypto)
  for (let i = 0; i < BHAVCOPY_SYMBOL_POOL.length; i++) {
    const [sym, name, ex, badgeType, price, change, changePercent] = BHAVCOPY_SYMBOL_POOL[i];
    const symUpper = sym.toUpperCase();
    const existing = bySymbol.get(symUpper);
    if (existing) {
      // Keep the rich entry, but fill in missing name or latest price if needed
      if ((!existing.name || existing.name === existing.symbol) && name) {
        existing.name = name;
        existing.nameUpper = name.toUpperCase();
      }
      if (existing.price <= 0 && price > 0) {
        existing.price = price;
        existing.change = change;
        existing.changePercent = changePercent;
      }
      continue;
    }

    const category = getCategoryOf(ex, symUpper);
    const type = getTypeBadge({ symbol: symUpper, exchange: ex, badgeType });
    bySymbol.set(symUpper, {
      symbol: sym,
      symbolUpper: symUpper,
      name,
      nameUpper: name.toUpperCase(),
      exchange: ex,
      exchangeUpper: ex.toUpperCase(),
      category,
      type,
      price,
      change,
      changePercent,
      isPriority: i < 120 || category !== 'Cash',
      rankOrder: order++,
    });
  }

  cachedPool = Array.from(bySymbol.values());
  cachedPoolBySymbol = bySymbol;
  lastDataLayerLength = liveInstruments.length;

  return { list: cachedPool, bySymbol: cachedPoolBySymbol };
}

/**
 * Returns the total number of instruments in the unified symbol pool.
 */
export function getAvailableSymbolPoolSize(category: SymbolCategory = 'ALL'): number {
  const { list } = ensureSymbolPool();
  if (category === 'ALL') return list.length;
  let count = 0;
  for (let i = 0; i < list.length; i++) {
    if (list[i].category === category) count++;
  }
  return count;
}

/**
 * Estimates or resolves a deterministic, realistic base price for ANY symbol,
 * whether in the unified symbol pool or an arbitrary user-entered ticker.
 */
export function resolveSymbolPrice(symbol: string): number {
  const norm = symbol.trim().toUpperCase();
  const cleanSym = norm.includes(':') ? norm.split(':')[1] : norm;

  // 1. Direct match in unified symbol pool (3,700+ symbols)
  const { bySymbol } = ensureSymbolPool();
  const poolMatch = bySymbol.get(cleanSym);
  if (poolMatch && poolMatch.price > 0) return poolMatch.price;

  // 2. Known benchmark index price ranges
  if (KNOWN_INDEX_PRICES[cleanSym]) return KNOWN_INDEX_PRICES[cleanSym];
  if (cleanSym === 'NIFTY 50' || cleanSym.startsWith('NIFTY50')) return 24850.0;
  if (cleanSym.startsWith('BANKNIFTY')) return 51800.0;

  // 3. Known Crypto & Commodity price ranges
  if (cleanSym.startsWith('BTC')) return 67400.0;
  if (cleanSym.startsWith('ETH')) return 3480.0;
  if (cleanSym.startsWith('SOL')) return 168.0;
  if (cleanSym === 'GOLD') return 76850.0;
  if (cleanSym === 'SILVER') return 91800.0;
  if (cleanSym === 'CRUDEOIL') return 6180.0;

  // 4. Options premium ranges
  if (/\d+(CE|PE)$/.test(cleanSym)) {
    let hash = 0;
    for (let i = 0; i < cleanSym.length; i++) hash = (hash << 5) - hash + cleanSym.charCodeAt(i);
    const prem = 45 + Math.abs(hash % 280);
    return Number(prem.toFixed(2));
  }

  // 5. Deterministic hash-based realistic stock price for ANY custom ticker
  let hash = 0;
  for (let i = 0; i < cleanSym.length; i++) {
    hash = (hash << 5) - hash + cleanSym.charCodeAt(i);
    hash |= 0;
  }
  const base = 120 + Math.abs(hash % 2400);
  return Number(base.toFixed(2));
}

/**
 * Resolves metadata for an arbitrary symbol from the unified pool or fallback synthesis
 */
export function resolveSymbolMetadata(symbol: string): SearchResultItem {
  const norm = symbol.trim().toUpperCase();
  const cleanSym = norm.includes(':') ? norm.split(':')[1] : norm;
  const { bySymbol } = ensureSymbolPool();
  const match = bySymbol.get(cleanSym);

  if (match) {
    return {
      symbol: match.symbol,
      name: match.name,
      exchange: match.exchange,
      category: match.category,
      type: match.type,
      price: match.price,
      change: match.change,
      changePercent: match.changePercent,
    };
  }

  const exchange = norm.includes(':') ? norm.split(':')[0] : 'NSE';
  const category = getCategoryOf(exchange, cleanSym);
  const type = getTypeBadge({ symbol: cleanSym, exchange });
  const price = resolveSymbolPrice(cleanSym);

  return {
    symbol: cleanSym,
    name: `${cleanSym} (${exchange})`,
    exchange,
    category,
    type: type || 'CUSTOM',
    price,
    change: Number((price * 0.005).toFixed(2)),
    changePercent: 0.5,
    isCustom: true,
  };
}

/**
 * Comprehensive Symbol Search across the full Honba symbol pool (~3,750+ instruments).
 * Supports prefix matching, multi-token company name matching, category filtering,
 * arithmetic expressions, AND dynamic arbitrary symbol entry.
 */
export function searchInstruments(
  query: string,
  category: SymbolCategory = 'ALL',
  limit = 4000
): SearchResultItem[] {
  const rawQuery = query.trim();
  const q = rawQuery.toUpperCase();
  const cleanQ = q.includes(':') ? q.split(':')[1].trim() : q;
  const exFilter = q.includes(':') ? q.split(':')[0].trim() : '';
  const results: SearchResultItem[] = [];

  const { list, bySymbol } = ensureSymbolPool();

  // 1. If it's an arithmetic expression, place expression action at top
  const isExpr = isArithmeticExpression(rawQuery);
  if (isExpr) {
    results.push({
      symbol: rawQuery,
      name: 'Computed Chart Expression',
      exchange: 'EXPR',
      category: 'ALL',
      type: 'EXPR',
      price: 1.0,
      isExpression: true,
    });
  }

  // 2. Search and rank pool items
  const matched: { entry: PoolEntry; score: number }[] = [];
  const tokens = cleanQ.split(/\s+/).filter(Boolean);

  for (let i = 0; i < list.length; i++) {
    const entry = list[i];

    if (category !== 'ALL' && entry.category !== category) {
      continue;
    }
    if (exFilter && !entry.exchangeUpper.startsWith(exFilter)) {
      continue;
    }

    if (!cleanQ) {
      const score = entry.category === 'Index' ? 0 : entry.isPriority ? 1 : 5;
      matched.push({ entry, score });
      continue;
    }

    const sym = entry.symbolUpper;
    const nm = entry.nameUpper;

    if (sym === cleanQ) {
      matched.push({ entry, score: 0 });
    } else if (sym.startsWith(cleanQ)) {
      matched.push({ entry, score: 1 });
    } else if (nm.startsWith(cleanQ)) {
      matched.push({ entry, score: 2 });
    } else if (sym.includes(cleanQ)) {
      matched.push({ entry, score: 3 });
    } else if (nm.includes(cleanQ)) {
      matched.push({ entry, score: 4 });
    } else if (tokens.length > 1 && tokens.every((tk) => sym.includes(tk) || nm.includes(tk))) {
      matched.push({ entry, score: 5 });
    }
  }

  matched.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    if (!cleanQ) {
      return a.entry.rankOrder - b.entry.rankOrder;
    }
    if (a.entry.isPriority !== b.entry.isPriority) {
      return a.entry.isPriority ? -1 : 1;
    }
    return a.entry.symbolUpper.localeCompare(b.entry.symbolUpper);
  });

  // 3. If user typed an arbitrary symbol that doesn't exactly exist in the pool,
  // provide an on-the-fly "Chart {symbol}" option (after exact/prefix matches if any, or at top if none)
  const exactMatchInPool = bySymbol.has(cleanQ);
  const customItem =
    cleanQ.length > 0 && !exactMatchInPool && !isExpr
      ? (() => {
          const item = resolveSymbolMetadata(q);
          item.name = `Chart "${q}" (Custom / Direct Symbol)`;
          item.isCustom = true;
          return item;
        })()
      : null;

  if (customItem && matched.length === 0) {
    results.push(customItem);
  }

  const maxCount = Math.min(limit, matched.length);
  for (let i = 0; i < maxCount; i++) {
    const { entry } = matched[i];
    results.push({
      symbol: entry.symbol,
      name: entry.name,
      exchange: entry.exchange,
      category: entry.category,
      type: entry.type,
      price: entry.price,
      change: entry.change,
      changePercent: entry.changePercent,
    });
  }

  if (customItem && matched.length > 0) {
    results.push(customItem);
  }

  return results;
}
