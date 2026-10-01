/**
 * Screener Reactive State Store (Zustand)
 * Unifies market instruments, filter criteria, active selections, column definitions,
 * drawer state, multi-asset configurations, and real-time tick integration.
 */

import { create } from 'zustand';
import { Instrument, CountryCode } from '../market-data';
import { dataLayer } from '../data-layer';
import { ALL_COLUMNS, ColumnDef, TAB_COLUMN_PRESETS } from '../columns';
import { AdvancedFilterState, DEFAULT_ADVANCED_FILTERS } from '../filters';
import { ScreenerType, SCREENER_CONFIG } from '../filter-config';
import { ScreenDefinition, BUILTIN_SCREENS } from '../screen-definitions';

const CUSTOM_SCREENS_STORAGE_KEY = 'honba_custom_screens_v1';

export interface ScreenerState {
  // Market & Instruments
  currentMarket: CountryCode;
  instruments: Instrument[];
  activeSymbol: string;
  shortlistedSymbols: string[];
  searchQuery: string;
  isLive: boolean;

  // Multi-Asset Screener Type & Dynamic Title
  screenerType: ScreenerType; // 'stocks' | 'etf' | 'bonds' | 'mf'
  activeScreenTitle: string; // e.g. "All stocks", "ETF vault", "All bonds", "All mutual funds"
  activeScreenId: string;
  autosave: boolean;
  activeTab: string; // 'overview' | 'performance' | etc.
  quickPreset: string; // 'all' | 'gainers' | 'losers' | 'most_active' | etc.
  advancedFilters: AdvancedFilterState;

  // Screen Library / Catalog
  customScreens: ScreenDefinition[];
  isOpenScreenModalOpen: boolean;

  // Table Configuration & Pagination
  columns: ColumnDef[];
  sortField: string;
  sortOrder: 'asc' | 'desc' | null;
  currentPage: number;
  pageSize: number;

  // Modals & Panels
  detailDrawerOpen: boolean;
  activeDetailTab: 'overview' | 'technicals' | 'financials';
  isFilterModalOpen: boolean;
  isColumnModalOpen: boolean;

  // Actions
  setScreenerType: (screenerType: ScreenerType) => void;
  setAutosave: (autosave: boolean) => void;
  setMarket: (market: CountryCode) => void;
  setActiveSymbol: (symbol: string) => void;
  toggleShortlist: (symbol: string) => void;
  clearShortlist: () => void;
  setSearchQuery: (query: string) => void;
  setActiveTab: (tab: string) => void;
  setQuickPreset: (preset: string) => void;
  setAdvancedFilters: (filters: Partial<AdvancedFilterState>) => void;
  resetFilters: () => void;

  // Screen Catalog Actions
  setOpenScreenModalOpen: (open: boolean) => void;
  selectScreen: (screen: ScreenDefinition) => void;
  saveCurrentAsNewScreen: (name: string, description?: string) => ScreenDefinition;
  deleteCustomScreen: (screenId: string) => void;

  setColumns: (columns: ColumnDef[]) => void;
  setSort: (field: string) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  toggleDetailDrawer: () => void;
  setDetailDrawerOpen: (open: boolean) => void;
  setActiveDetailTab: (tab: 'overview' | 'technicals' | 'financials') => void;
  setFilterModalOpen: (open: boolean) => void;
  setColumnModalOpen: (open: boolean) => void;
  toggleLiveTicks: () => void;
  updateTick: (tick: { symbol: string; price: number; change: number; changePercent: number }) => void;
  refreshFromDataLayer: () => void;
}

const getStoredColumns = (): ColumnDef[] => {
  const columnMap = new Map(ALL_COLUMNS.map((c) => [c.id, c]));
  try {
    const raw = localStorage.getItem('honba_screener_columns_v4') || localStorage.getItem('honba_screener_columns_v3');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const merged: ColumnDef[] = [];
        for (const item of parsed) {
          const base = columnMap.get(item.id);
          if (base) {
            merged.push({
              ...base,
              visible: typeof item.visible === 'boolean' ? item.visible : base.visible,
            });
          }
        }
        // Include any new columns from ALL_COLUMNS
        const seen = new Set(merged.map((c) => c.id));
        for (const col of ALL_COLUMNS) {
          if (!seen.has(col.id)) {
            merged.push(col);
          }
        }
        if (merged.length > 0) return merged;
      }
    }
  } catch {}
  return [...ALL_COLUMNS];
};

const getStoredCustomScreens = (): ScreenDefinition[] => {
  try {
    const raw = localStorage.getItem(CUSTOM_SCREENS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
};

export const useScreenerStore = create<ScreenerState>((set, get) => {
  const initialDataLayerState = dataLayer.getState();
  const initialInstruments = dataLayer.getInstruments(initialDataLayerState.currentMarket, 'stocks');
  const initialConfig = SCREENER_CONFIG.stocks;

  return {
    currentMarket: initialDataLayerState.currentMarket,
    instruments: initialInstruments,
    activeSymbol: initialDataLayerState.activeSymbol,
    shortlistedSymbols: initialDataLayerState.shortlistedSymbols,
    searchQuery: initialDataLayerState.searchQuery || '',
    isLive: dataLayer.isLiveSimulationActive(),

    screenerType: 'stocks',
    activeScreenTitle: initialConfig.defaultTitle, // "All stocks"
    activeScreenId: 'stock_all',
    autosave: true,
    activeTab: 'overview',
    quickPreset: 'all',
    advancedFilters: { ...DEFAULT_ADVANCED_FILTERS },

    customScreens: getStoredCustomScreens(),
    isOpenScreenModalOpen: false,

    columns: getStoredColumns(),
    sortField: 'marketCap',
    sortOrder: 'desc',
    currentPage: 1,
    pageSize: 100,

    detailDrawerOpen: false,
    activeDetailTab: 'overview',
    isFilterModalOpen: false,
    isColumnModalOpen: false,

    setScreenerType: (type: ScreenerType) => {
      const config = SCREENER_CONFIG[type] || SCREENER_CONFIG.stocks;
      const currentMarket = get().currentMarket;
      const instruments = dataLayer.getInstruments(currentMarket, type);
      const active = instruments[0]?.symbol || '';
      if (active) dataLayer.setActiveSymbol(active);

      // Reset filters and active title to the default for this asset class
      set({
        screenerType: type,
        activeScreenTitle: config.defaultTitle,
        activeScreenId: `${type}_all`,
        instruments,
        activeSymbol: active,
        activeTab: config.tabs[0]?.id || 'overview',
        quickPreset: 'all',
        advancedFilters: { ...DEFAULT_ADVANCED_FILTERS },
        sortField: config.defaultSort.field,
        sortOrder: config.defaultSort.direction,
        currentPage: 1,
      });
    },

    setAutosave: (autosave: boolean) => {
      set({ autosave });
    },

    setMarket: (market: CountryCode) => {
      dataLayer.setMarket(market);
      const screenerType = get().screenerType || 'stocks';
      const instruments = dataLayer.getInstruments(market, screenerType);
      const active = instruments[0]?.symbol || '';
      if (active) dataLayer.setActiveSymbol(active);
      set({
        currentMarket: market,
        instruments,
        activeSymbol: active,
        currentPage: 1,
      });
    },

    setActiveSymbol: (symbol: string) => {
      dataLayer.setActiveSymbol(symbol);
      set({ activeSymbol: symbol });
    },

    toggleShortlist: (symbol: string) => {
      dataLayer.toggleShortlist(symbol);
      set({ shortlistedSymbols: dataLayer.getState().shortlistedSymbols });
    },

    clearShortlist: () => {
      const current = get().shortlistedSymbols;
      current.forEach((s) => dataLayer.toggleShortlist(s));
      set({ shortlistedSymbols: [] });
    },

    setSearchQuery: (searchQuery: string) => {
      dataLayer.setSearchQuery(searchQuery);
      set({ searchQuery, currentPage: 1 });
    },

    setActiveTab: (activeTab: string) => {
      const preset = TAB_COLUMN_PRESETS[activeTab];
      if (preset) {
        const updated = ALL_COLUMNS.map((c) => ({
          ...c,
          visible: preset.includes(c.id),
        }));
        set({ activeTab, columns: updated, currentPage: 1 });
      } else {
        set({ activeTab });
      }
    },

    setQuickPreset: (quickPreset: string) => {
      // Find if there is a builtin screen matching this quick preset
      const screenerType = get().screenerType;
      const matchingScreen = BUILTIN_SCREENS.find(
        (s) => s.screenerType === screenerType && s.quickPreset === quickPreset
      );
      if (matchingScreen) {
        set({
          quickPreset,
          activeScreenTitle: matchingScreen.name,
          activeScreenId: matchingScreen.id,
          currentPage: 1,
        });
      } else {
        set({ quickPreset, currentPage: 1 });
      }
    },

    setAdvancedFilters: (filters: Partial<AdvancedFilterState>) => {
      set((state) => ({
        advancedFilters: { ...state.advancedFilters, ...filters },
        currentPage: 1,
      }));
    },

    resetFilters: () => {
      const config = SCREENER_CONFIG[get().screenerType] || SCREENER_CONFIG.stocks;
      set({
        quickPreset: 'all',
        activeScreenTitle: config.defaultTitle,
        searchQuery: '',
        advancedFilters: { ...DEFAULT_ADVANCED_FILTERS },
        currentPage: 1,
      });
      dataLayer.setSearchQuery('');
    },

    // Screen Library Actions
    setOpenScreenModalOpen: (open: boolean) => {
      set({ isOpenScreenModalOpen: open });
    },

    selectScreen: (screen: ScreenDefinition) => {
      const currentFilters = { ...DEFAULT_ADVANCED_FILTERS, ...(screen.filters || {}) };
      set({
        screenerType: screen.screenerType,
        activeScreenTitle: screen.name,
        activeScreenId: screen.id,
        quickPreset: screen.quickPreset || 'all',
        advancedFilters: currentFilters,
        sortField: screen.sortField || get().sortField,
        sortOrder: screen.sortDirection || get().sortOrder,
        isOpenScreenModalOpen: false,
        currentPage: 1,
      });
    },

    saveCurrentAsNewScreen: (name: string, description: string = 'User customized screen'): ScreenDefinition => {
      const state = get();
      const newScreen: ScreenDefinition = {
        id: `custom_${Date.now()}`,
        name: name.trim() || 'Untitled Screen',
        screenerType: state.screenerType,
        category: 'custom',
        description,
        isBuiltin: false,
        filters: { ...state.advancedFilters },
        quickPreset: state.quickPreset,
        sortField: state.sortField,
        sortDirection: state.sortOrder || 'desc',
      };

      const updatedCustom = [newScreen, ...state.customScreens];
      try {
        localStorage.setItem(CUSTOM_SCREENS_STORAGE_KEY, JSON.stringify(updatedCustom));
      } catch {}

      set({
        customScreens: updatedCustom,
        activeScreenTitle: newScreen.name,
        activeScreenId: newScreen.id,
      });
      return newScreen;
    },

    deleteCustomScreen: (screenId: string) => {
      const updatedCustom = get().customScreens.filter((s) => s.id !== screenId);
      try {
        localStorage.setItem(CUSTOM_SCREENS_STORAGE_KEY, JSON.stringify(updatedCustom));
      } catch {}

      const state = get();
      const nextTitle = state.activeScreenId === screenId
        ? SCREENER_CONFIG[state.screenerType]?.defaultTitle || 'All stocks'
        : state.activeScreenTitle;

      set({
        customScreens: updatedCustom,
        activeScreenTitle: nextTitle,
      });
    },

    setColumns: (columns: ColumnDef[]) => {
      try {
        const toStore = columns.map(({ id, visible }) => ({ id, visible }));
        localStorage.setItem('honba_screener_columns_v4', JSON.stringify(toStore));
      } catch {}
      set({ columns });
    },

    setSort: (field: string) => {
      const { sortField, sortOrder } = get();
      if (sortField === field) {
        if (sortOrder === 'desc') set({ sortOrder: 'asc' });
        else if (sortOrder === 'asc') set({ sortOrder: null, sortField: '' });
        else set({ sortOrder: 'desc' });
      } else {
        set({ sortField: field, sortOrder: 'desc' });
      }
    },

    setPage: (currentPage: number) => set({ currentPage }),
    setPageSize: (pageSize: number) => set({ pageSize, currentPage: 1 }),

    toggleDetailDrawer: () => set((state) => ({ detailDrawerOpen: !state.detailDrawerOpen })),
    setDetailDrawerOpen: (detailDrawerOpen: boolean) => set({ detailDrawerOpen }),
    setActiveDetailTab: (activeDetailTab) => set({ activeDetailTab }),

    setFilterModalOpen: (isFilterModalOpen: boolean) => set({ isFilterModalOpen }),
    setColumnModalOpen: (isColumnModalOpen: boolean) => set({ isColumnModalOpen }),

    toggleLiveTicks: () => {
      if (dataLayer.isLiveSimulationActive()) {
        dataLayer.stopLiveTickSimulation();
      } else {
        dataLayer.startLiveTickSimulation();
      }
      set({ isLive: dataLayer.isLiveSimulationActive() });
    },

    updateTick: (tick) => {
      set((state) => {
        const next = state.instruments.map((inst) => {
          if (inst.symbol === tick.symbol) {
            return {
              ...inst,
              price: tick.price,
              change: tick.change,
              changePercent: tick.changePercent,
            };
          }
          return inst;
        });
        return { instruments: next };
      });
    },

    refreshFromDataLayer: () => {
      const state = dataLayer.getState();
      const screenerType = get().screenerType || 'stocks';
      const instruments = dataLayer.getInstruments(state.currentMarket, screenerType);
      set({
        currentMarket: state.currentMarket,
        instruments,
        activeSymbol: state.activeSymbol,
        shortlistedSymbols: state.shortlistedSymbols,
        isLive: dataLayer.isLiveSimulationActive(),
      });
    },
  };
});

// Setup continuous synchronization with dataLayer pub/sub and live tick events
dataLayer.subscribe(() => {
  useScreenerStore.getState().refreshFromDataLayer();
});

dataLayer.onTick((tick) => {
  useScreenerStore.getState().updateTick(tick);
});
