/**
 * Honba Shared Common Data Layer
 * Single source of truth shared across all Honba Apps:
 * - Screener
 * - WorkBench
 * - AlgoDesigner
 * - Simulator
 * - Researcher
 * - Instrument Detail Pages
 */

import {
  CountryCode,
  Instrument,
  INSTRUMENTS_DATABASE,
  SUPPORTED_MARKETS,
  MarketCountry,
  CandleData,
  AssetType,
} from './market-data';

// Re-export application registry definitions from dedicated apps module
export * from './apps';

export interface DataLayerState {
  currentMarket: CountryCode;
  activeSymbol: string;
  shortlistedSymbols: string[];
  watchlist: string[];
  searchQuery: string;
  activeTab: string;
  isBackendConnected: boolean;
}

export interface PeerComparison {
  symbol: string;
  name: string;
  price: number;
  pe: number;
  marketCap: number;
  changePercent: number;
}

export interface ShareholdingPattern {
  promoter: number;
  fii: number;
  dii: number;
  public: number;
  others: number;
}

export interface QuarterlyFinancial {
  period: string;
  revenue: number; // in Cr INR
  netProfit: number;
  operatingMargin: number; // %
  eps: number;
}

export interface IndexConstituent {
  symbol: string;
  name: string;
  weight: number; // %
  price: number;
  changePercent: number;
  sector: string;
}

export interface MutualFundHolding {
  symbol: string;
  name: string;
  sector: string;
  weight: number; // %
  assetClass: string;
}

export interface IpoDetails {
  status: string; // 'upcoming' | 'open' | 'closed' | 'listed'
  priceBand: string;
  lotSize: number;
  minInvestment: number;
  issueSizeCr: number;
  freshIssueCr: number;
  ofsCr: number;
  openDate: string;
  closeDate: string;
  allotmentDate: string;
  listingDate: string;
  gmpPrice: number;
  gmpPercent: number;
  subscriptionQib: number;
  subscriptionNii: number;
  subscriptionRetail: number;
  subscriptionTotal: number;
  leadManagers: string[];
}

export interface InstrumentDetailResponse {
  instrument: Instrument;
  candles: CandleData[];
  about: string;
  peers: PeerComparison[];
  shareholding?: ShareholdingPattern;
  quarterly: QuarterlyFinancial[];
  constituents?: IndexConstituent[];
  sectorWeights?: Record<string, number>;
  advances?: number;
  declines?: number;
  mfHoldings?: MutualFundHolding[];
  aumCr?: number;
  expenseRatio?: number;
  fundManager?: string;
  categoryAvgReturn1Y?: number;
  cagr3Y?: number;
  cagr5Y?: number;
  ipoDetails?: IpoDetails;
}

const STORAGE_KEY = 'honba_shared_state_v1';

type Listener = (state: DataLayerState) => void;
type TickListener = (tick: { symbol: string; price: number; change: number; changePercent: number; volume?: number; timestamp?: number }) => void;

const WS_BASE_DELAY_MS = 4000;
const WS_MAX_DELAY_MS = 60000;
const WS_MAX_FAILURES = 5;

class CommonDataLayer {
  private instruments: Instrument[] = [...INSTRUMENTS_DATABASE];
  private currentMarket: CountryCode = 'IN';
  private activeSymbol: string = 'RELIANCE';
  private shortlistedSymbols: Set<string> = new Set(['RELIANCE', 'INFY']);
  private watchlist: Set<string> = new Set(['RELIANCE', 'TCS', 'HDFCBANK', 'NVDA']);
  private searchQuery: string = '';
  private activeTab: string = 'overview';
  private isBackendConnected: boolean = false;
  
  private listeners: Listener[] = [];
  private tickListeners: TickListener[] = [];
  private tickInterval: number | null = null;
  private pollInterval: number | null = null;
  private ws: WebSocket | null = null;
  private wsReconnectTimer: number | null = null;
  private wsFailures = 0;
  private wsPaused = false;
  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    this.restoreFromStorage();
    this.initBroadcastChannel();
    this.loadLiveInstruments(this.currentMarket);
    this.startPeriodicSync();
    this.initWebSocket();
  }

  public async loadLiveInstruments(country: CountryCode = 'IN') {
    try {
      const res = await fetch('/api/v1/instruments');
      if (res.ok) {
        const payload: any = await res.json();
        const rawList: any[] = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data?.instruments)
          ? payload.data.instruments
          : Array.isArray(payload?.instruments)
          ? payload.instruments
          : [];

        if (rawList.length > 0) {
          this.isBackendConnected = true;
          const bySymbol = new Map<string, Instrument>(
            this.instruments.map((inst) => [inst.symbol.toUpperCase(), inst])
          );

          for (const item of rawList) {
            const sym = String(item.symbol || '').trim().toUpperCase();
            if (!sym) continue;
            const existing = bySymbol.get(sym);
            const rawPrice = Number(item.price || existing?.price || 0);
            if (existing) {
              if (rawPrice > 0) existing.price = rawPrice;
              if (item.name) existing.name = item.name;
              if (item.exchange) existing.exchange = item.exchange;
              if (item.sector) existing.sector = item.sector;
            } else if (rawPrice > 0) {
              const chgPct = Number(item.changePercent || 0);
              bySymbol.set(sym, {
                ...item,
                symbol: sym,
                name: item.name || sym,
                country: (item.country as CountryCode) || country,
                exchange: item.exchange || 'NSE',
                sector: item.sector || 'Equities',
                industry: item.industry || item.sector || 'Equities',
                price: rawPrice,
                change: Number(item.change || 0),
                changePercent: chgPct,
                volume: Number(item.volume || 0),
                avgVolume30d: Number(item.avgVolume30d || item.volume || 0),
                marketCap: Number(item.marketCap || 0),
                marketCapTier: item.marketCapTier || 'mid',
                pe: Number(item.pe || 20),
                forwardPe: Number(item.forwardPe || 18),
                pb: Number(item.pb || 2.5),
                eps: Number(item.eps || 10),
                dividendYield: Number(item.dividendYield || 0.5),
                high52: Number(item.high52 || rawPrice * 1.2),
                low52: Number(item.low52 || rawPrice * 0.8),
                rsi14: Number(item.rsi14 || 50),
                sma20: Number(item.sma20 || rawPrice),
                sma50: Number(item.sma50 || rawPrice),
                sma200: Number(item.sma200 || rawPrice),
                technicalRating: item.technicalRating || 'Neutral',
                perf1W: Number(item.perf1W || 0),
                perf1M: Number(item.perf1M || 0),
                perf3M: Number(item.perf3M || 0),
                perf1Y: Number(item.perf1Y || 0),
                revenueGrowth: Number(item.revenueGrowth || 10),
                netMargin: Number(item.netMargin || 12),
                roce: Number(item.roce || 14),
                roe: Number(item.roe || 14),
                debtToEquity: Number(item.debtToEquity || 0.4),
                sparkline: item.sparkline || [
                  rawPrice * (1 - chgPct * 0.015),
                  rawPrice * (1 - chgPct * 0.008),
                  rawPrice * (1 + chgPct * 0.004),
                  rawPrice,
                ],
                history: item.history || [],
                description: item.description || `${item.name || sym} (${sym}) listed on ${item.exchange || 'NSE'}.`,
              });
            }
          }

          this.instruments = Array.from(bySymbol.values());
          this.notify();
        }
      }
    } catch {
      // Backend offline: silently keep bundled offline instruments
      this.isBackendConnected = false;
    }
  }

  private startPeriodicSync() {
    // Background polling every 18 seconds to ensure latest bhavcopy and quotes sync
    if (typeof window !== 'undefined') {
      this.pollInterval = window.setInterval(() => {
        this.loadLiveInstruments(this.currentMarket);
      }, 18000);
    }
  }

  private initWebSocket() {
    if (typeof window === 'undefined') return;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/market`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.wsFailures = 0;
        this.isBackendConnected = true;
        this.notify();
      };

      this.ws.onmessage = (event) => {
        try {
          const tick = JSON.parse(event.data);
          if (tick.symbol && typeof tick.price === 'number') {
            this.emitTick(tick);
          }
        } catch {}
      };

      this.ws.onerror = () => {
        // Will trigger onclose and attempt reconnect
      };

      this.ws.onclose = () => {
        // Back off exponentially (4s..60s) and give up after repeated failures, so a
        // backend without a /ws/market route (e.g. REST-only `honba serve`) isn't hammered.
        if (this.wsPaused) return;
        this.wsFailures += 1;
        if (this.wsFailures > WS_MAX_FAILURES) return;
        if (!this.wsReconnectTimer) {
          const delay = Math.min(WS_BASE_DELAY_MS * 2 ** (this.wsFailures - 1), WS_MAX_DELAY_MS);
          this.wsReconnectTimer = window.setTimeout(() => {
            this.wsReconnectTimer = null;
            this.initWebSocket();
          }, delay);
        }
      };
    } catch {
      // Fallback to HTTP polling
    }
  }

  /** "Offline" (paused) in the nav pill: drop the socket and cancel any pending retry. */
  private pauseWebSocket() {
    this.wsPaused = true;
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  /** "Live Feed" (resumed): a user click is a fresh start, so reset the give-up counter. */
  private resumeWebSocket() {
    this.wsPaused = false;
    this.wsFailures = 0;
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) this.initWebSocket();
  }

  public async fetchInstrumentDetail(symbol: string): Promise<InstrumentDetailResponse | null> {
    try {
      const res = await fetch(`/api/instruments/${encodeURIComponent(symbol)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {}

    // Fallback: Generate local synthesis from loaded instrument
    const inst = this.getInstrument(symbol);
    if (!inst) return null;

    return {
      instrument: inst,
      candles: inst.history || [],
      about: inst.description || `${inst.name} is a leading security in ${inst.sector}.`,
      peers: [],
      quarterly: [],
    };
  }

  public async fetchInstrumentCandles(symbol: string, timeframe: string = '1M'): Promise<CandleData[]> {
    try {
      const res = await fetch(`/api/instruments/${encodeURIComponent(symbol)}/candles?timeframe=${timeframe}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {}

    const inst = this.getInstrument(symbol);
    return inst?.history || [];
  }

  private initBroadcastChannel() {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.broadcastChannel = new BroadcastChannel('honba_data_sync');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && event.data.type === 'STATE_SYNC') {
            this.applyForeignState(event.data.payload);
          }
        };
      }
    } catch {
      // broadcast channel fallback
    }
  }

  private restoreFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.currentMarket) this.currentMarket = parsed.currentMarket;
        if (parsed.activeSymbol) this.activeSymbol = parsed.activeSymbol;
        if (Array.isArray(parsed.shortlistedSymbols)) {
          this.shortlistedSymbols = new Set(parsed.shortlistedSymbols);
        }
        if (Array.isArray(parsed.watchlist)) {
          this.watchlist = new Set(parsed.watchlist);
        }
      }
    } catch {
      // Ignore
    }
  }

  private saveToStorage() {
    try {
      const state: DataLayerState = {
        currentMarket: this.currentMarket,
        activeSymbol: this.activeSymbol,
        shortlistedSymbols: Array.from(this.shortlistedSymbols),
        watchlist: Array.from(this.watchlist),
        searchQuery: this.searchQuery,
        activeTab: this.activeTab,
        isBackendConnected: this.isBackendConnected,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      this.broadcastChannel?.postMessage({ type: 'STATE_SYNC', payload: state });
    } catch {
      // Ignore
    }
  }

  private applyForeignState(state: DataLayerState) {
    if (state.currentMarket) this.currentMarket = state.currentMarket;
    if (state.activeSymbol) this.activeSymbol = state.activeSymbol;
    if (state.shortlistedSymbols) this.shortlistedSymbols = new Set(state.shortlistedSymbols);
    if (state.watchlist) this.watchlist = new Set(state.watchlist);
    this.notify();
  }

  public getState(): DataLayerState {
    return {
      currentMarket: this.currentMarket,
      activeSymbol: this.activeSymbol,
      shortlistedSymbols: Array.from(this.shortlistedSymbols),
      watchlist: Array.from(this.watchlist),
      searchQuery: this.searchQuery,
      activeTab: this.activeTab,
      isBackendConnected: this.isBackendConnected,
    };
  }

  public getSupportedMarkets(): MarketCountry[] {
    return SUPPORTED_MARKETS;
  }

  public getCurrentMarketInfo(): MarketCountry {
    return SUPPORTED_MARKETS.find((m) => m.code === this.currentMarket) || SUPPORTED_MARKETS[0];
  }

  public setMarket(country: CountryCode) {
    if (this.currentMarket !== country) {
      this.currentMarket = country;
      this.loadLiveInstruments(country);
      const firstInMarket = this.instruments.find((i) => i.country === country);
      if (firstInMarket) {
        this.activeSymbol = firstInMarket.symbol;
      }
      this.saveToStorage();
      this.notify();
    }
  }

  public getInstruments(country?: CountryCode, screenerType: string = 'stocks'): Instrument[] {
    const targetCountry = country || this.currentMarket;
    if (screenerType === 'etf' || screenerType === 'bonds' || screenerType === 'mf' || screenerType === 'index' || screenerType === 'ipo') {
      const match = this.instruments.filter((i) => i.assetType === screenerType && i.country === targetCountry);
      if (match.length > 0) return match;
      return this.instruments.filter((i) => i.assetType === screenerType);
    }
    return this.instruments.filter((i) => (!i.assetType || i.assetType === 'stocks') && i.country === targetCountry);
  }

  public getInstrumentsByAssetType(assetType: AssetType): Instrument[] {
    return this.instruments.filter((i) => i.assetType === assetType);
  }

  public getAllInstruments(): Instrument[] {
    return this.instruments;
  }

  public getInstrument(symbol: string): Instrument | undefined {
    const clean = symbol.toUpperCase().trim();
    return this.instruments.find((i) => i.symbol.toUpperCase() === clean);
  }

  public setActiveSymbol(symbol: string) {
    if (this.activeSymbol !== symbol) {
      this.activeSymbol = symbol;
      const inst = this.getInstrument(symbol);
      if (inst && inst.country !== this.currentMarket) {
        this.currentMarket = inst.country;
      }
      this.saveToStorage();
      this.notify();
    }
  }

  public isShortlisted(symbol: string): boolean {
    return this.shortlistedSymbols.has(symbol);
  }

  public toggleShortlist(symbol: string) {
    if (this.shortlistedSymbols.has(symbol)) {
      this.shortlistedSymbols.delete(symbol);
    } else {
      this.shortlistedSymbols.add(symbol);
    }
    this.saveToStorage();
    this.notify();
  }

  public setAllShortlisted(symbols: string[], select: boolean) {
    symbols.forEach((s) => {
      if (select) {
        this.shortlistedSymbols.add(s);
      } else {
        this.shortlistedSymbols.delete(s);
      }
    });
    this.saveToStorage();
    this.notify();
  }

  public clearShortlist() {
    this.shortlistedSymbols.clear();
    this.saveToStorage();
    this.notify();
  }

  public toggleWatchlist(symbol: string) {
    if (this.watchlist.has(symbol)) {
      this.watchlist.delete(symbol);
    } else {
      this.watchlist.add(symbol);
    }
    this.saveToStorage();
    this.notify();
  }

  public isWatchlisted(symbol: string): boolean {
    return this.watchlist.has(symbol);
  }

  public setSearchQuery(query: string) {
    this.searchQuery = query;
    this.notify();
  }

  public setActiveTab(tab: string) {
    this.activeTab = tab;
    this.notify();
  }

  // Live simulation ticks (started only when user enables live stream)
  public startLiveTickSimulation() {
    this.resumeWebSocket();
    if (this.tickInterval) return;
    this.tickInterval = window.setInterval(() => {
      const marketInstruments = this.getInstruments();
      if (marketInstruments.length === 0) return;
      
      const randomIdx = Math.floor(Math.random() * marketInstruments.length);
      const inst = marketInstruments[randomIdx];
      
      const deltaPercent = (Math.random() - 0.49) * 0.4;
      const oldPrice = inst.price;
      const priceDelta = Number((oldPrice * (deltaPercent / 100)).toFixed(2));
      const newPrice = Number(Math.max(1, oldPrice + priceDelta).toFixed(2));
      
      inst.price = newPrice;
      inst.change = Number((inst.change + priceDelta).toFixed(2));
      inst.changePercent = Number(((inst.change / (inst.price - inst.change)) * 100).toFixed(2));
      inst.volume += Math.floor(100 + Math.random() * 900);
      
      if (inst.sparkline.length > 0) {
        inst.sparkline[inst.sparkline.length - 1] = newPrice;
      }

      this.tickListeners.forEach((cb) => cb({
        symbol: inst.symbol,
        price: inst.price,
        change: inst.change,
        changePercent: inst.changePercent,
      }));
    }, 2500);
  }

  public stopLiveTickSimulation() {
    this.pauseWebSocket();
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  public isLiveSimulationActive(): boolean {
    return this.tickInterval !== null || this.isBackendConnected;
  }

  public emitTick(tick: { symbol: string; price: number; change: number; changePercent: number; volume?: number; timestamp?: number }) {
    const inst = this.getInstrument(tick.symbol);
    if (inst) {
      inst.price = tick.price;
      inst.change = tick.change;
      inst.changePercent = tick.changePercent;
      if (tick.volume !== undefined) inst.volume = tick.volume;
      if (inst.sparkline && inst.sparkline.length > 0) {
        inst.sparkline[inst.sparkline.length - 1] = tick.price;
      }
    }
    this.tickListeners.forEach((cb) => cb(tick));
  }

  public onTick(cb: TickListener): () => void {
    this.tickListeners.push(cb);
    return () => {
      this.tickListeners = this.tickListeners.filter((l) => l !== cb);
    };
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cbListener(listener));
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }
}

function cbListener(target: Listener) {
  return target;
}

export const dataLayer = new CommonDataLayer();
