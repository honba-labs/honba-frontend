/**
 * Honba User Preferences & Workspace Persistence Service
 * Enables TradingView-grade user settings persistence:
 * - Screener views (custom columns, visible presets, active tab) per asset class
 * - Watchlists & shortlists
 * - Selected market country & exchange
 * - Theme and workspace layouts
 * 
 * Synchronizes with backend `/api/user/preferences` with local cache fallback.
 */

import { CountryCode, AssetType } from './market-data';
import { ScreenerType } from './filter-config';

export interface ScreenerAssetPreference {
  activeTab: string;
  visibleColumns: string[];
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface UserPreferences {
  version: number;
  userId: string;
  theme: 'dark' | 'light' | 'system';
  currentMarket: CountryCode;
  activeScreenerType: ScreenerType;
  screenerViews: Record<ScreenerType, ScreenerAssetPreference>;
  watchlist: string[];
  shortlist: string[];
  lastUpdated: string;
}

const STORAGE_KEY = 'honba_user_preferences_v1';

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  version: 1,
  userId: 'default_user',
  theme: 'dark',
  currentMarket: 'IN',
  activeScreenerType: 'stocks',
  screenerViews: {
    stocks: {
      activeTab: 'overview',
      visibleColumns: ['symbol', 'price', 'changePercent', 'volume', 'relVol', 'marketCap', 'pe', 'eps', 'epsGrowth', 'dividendYield', 'sector', 'analystRating'],
      sortField: 'marketCap',
      sortOrder: 'desc',
    },
    etf: {
      activeTab: 'overview',
      visibleColumns: ['symbol', 'price', 'changePercent', 'volume', 'aum', 'expenseRatio', 'dividendYield', 'sector', 'technicalRating'],
      sortField: 'aum',
      sortOrder: 'desc',
    },
    bonds: {
      activeTab: 'overview',
      visibleColumns: ['symbol', 'price', 'changePercent', 'ytw', 'coupon', 'creditRating', 'marketCap', 'volume'],
      sortField: 'ytw',
      sortOrder: 'desc',
    },
    mf: {
      activeTab: 'overview',
      visibleColumns: ['symbol', 'price', 'changePercent', 'aum', 'schemeType', 'expenseRatio', 'cagr3y', 'cagr5y', 'sharpeRatio', 'technicalRating'],
      sortField: 'aum',
      sortOrder: 'desc',
    },
  },
  watchlist: ['RELIANCE', 'TCS', 'HDFCBANK', 'NIFTYBEES', 'PPFAS_FLEXI', 'GS2034'],
  shortlist: [],
  lastUpdated: new Date().toISOString(),
};

class UserPreferenceService {
  private preferences: UserPreferences;
  private syncDebounceTimer: number | null = null;

  constructor() {
    this.preferences = this.loadLocal();
    this.fetchRemote();
  }

  private loadLocal(): UserPreferences {
    if (typeof window === 'undefined') return DEFAULT_USER_PREFERENCES;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_USER_PREFERENCES,
          ...parsed,
          screenerViews: {
            ...DEFAULT_USER_PREFERENCES.screenerViews,
            ...(parsed.screenerViews || {}),
          },
        };
      }
    } catch (e) {
      console.warn('Failed to parse local user preferences:', e);
    }
    return DEFAULT_USER_PREFERENCES;
  }

  private saveLocal() {
    if (typeof window === 'undefined') return;
    try {
      this.preferences.lastUpdated = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.preferences));
    } catch (e) {
      console.warn('Failed to write local user preferences:', e);
    }
  }

  /**
   * Fetch user preferences from backend if available
   */
  public async fetchRemote(): Promise<UserPreferences> {
    try {
      const res = await fetch('/api/user/preferences');
      if (res.ok) {
        const remotePrefs = await res.json();
        if (remotePrefs && typeof remotePrefs === 'object') {
          this.preferences = {
            ...this.preferences,
            ...remotePrefs,
          };
          this.saveLocal();
        }
      }
    } catch {
      // Backend offline or running standalone client, keep local cache
    }
    return this.preferences;
  }

  /**
   * Queue sync to backend with debounce
   */
  private queueRemoteSync() {
    this.saveLocal();
    if (typeof window === 'undefined') return;

    if (this.syncDebounceTimer) {
      window.clearTimeout(this.syncDebounceTimer);
    }

    this.syncDebounceTimer = window.setTimeout(async () => {
      this.syncDebounceTimer = null;
      try {
        await fetch('/api/user/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.preferences),
        });
      } catch {
        // Backend offline, cached locally
      }
    }, 1200);
  }

  public getPreferences(): UserPreferences {
    return this.preferences;
  }

  public getScreenerPreference(screenerType: ScreenerType): ScreenerAssetPreference {
    return this.preferences.screenerViews[screenerType] || DEFAULT_USER_PREFERENCES.screenerViews[screenerType];
  }

  public updateScreenerView(
    screenerType: ScreenerType,
    update: Partial<ScreenerAssetPreference>
  ) {
    const current = this.getScreenerPreference(screenerType);
    this.preferences.screenerViews[screenerType] = {
      ...current,
      ...update,
    };
    this.queueRemoteSync();
  }

  public updateActiveScreenerType(type: ScreenerType) {
    this.preferences.activeScreenerType = type;
    this.queueRemoteSync();
  }

  public updateMarket(country: CountryCode) {
    this.preferences.currentMarket = country;
    this.queueRemoteSync();
  }

  public updateWatchlist(watchlist: string[]) {
    this.preferences.watchlist = watchlist;
    this.queueRemoteSync();
  }

  public updateShortlist(shortlist: string[]) {
    this.preferences.shortlist = shortlist;
    this.queueRemoteSync();
  }
}

export const userPreferencesService = new UserPreferenceService();
