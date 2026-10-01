/**
 * Screener Reactive State Store (Zustand)
 * Unifies market instruments, filter criteria, active selections, column definitions,
 * drawer state, multi-asset configurations, and real-time tick integration.
 */

import { create } from 'zustand';
import { Instrument, CountryCode } from '../market-data';
import { dataLayer } from '../data-layer';
import { ALL_COLUMNS, ColumnDef, TAB_COLUMN_PRESETS, getPresetForScreenerTab } from '../columns';
import { AdvancedFilterState, DEFAULT_ADVANCED_FILTERS } from '../filters';
import { ScreenerType, SCREENER_CONFIG } from '../filter-config';
import { ScreenDefinition, BUILTIN_SCREENS } from '../screen-definitions';

import { userPreferencesService } from '../user-preferences';

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

const getColumnsForAssetAndTab = (screenerType: ScreenerType, tabId: string): ColumnDef[] => {
  const userPref = userPreferencesService.getScreenerPreference(screenerType);
  const visiblePreset = userPref?.visibleColumns?.length
    ? userPref.visibleColumns
    : getPresetForScreenerTab(screenerType, tabId);

  return ALL_COLUMNS.map((c) => ({
    ...c,
    visible: visiblePreset.includes(c.id),
  }));
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
  const userPrefs = userPreferencesService.getPreferences();
  const initialScreenerType = userPrefs.activeScreenerType || 'stocks';
  const initialDataLayerState = dataLayer.getState();
  const initialInstruments = dataLayer.getInstruments(initialDataLayerState.currentMarket, initialScreenerType);
  const initialConfig = SCREENER_CONFIG[initialScreenerType] || SCREENER_CONFIG.stocks;
  const initialAssetPref = userPreferencesService.getScreenerPreference(initialScreenerType);
  const initialTab = initialAssetPref?.activeTab || initialConfig.tabs[0]?.id || 'overview';

  return {
    currentMarket: initialDataLayerState.currentMarket,
    instruments: initialInstruments,
    activeSymbol: initialDataLayerState.activeSymbol,
    shortlistedSymbols: initialDataLayerState.shortlistedSymbols,
    searchQuery: initialDataLayerState.searchQuery || '',
    isLive: dataLayer.isLiveSimulationActive(),

    screenerType: initialScreenerType,
    activeScreenTitle: initialConfig.defaultTitle,
    activeScreenId: `${initialScreenerType}_all`,
    autosave: true,
    activeTab: initialTab,
    quickPreset: 'all',
    advancedFilters: { ...DEFAULT_ADVANCED_FILTERS },

    customScreens: getStoredCustomScreens(),
    isOpenScreenModalOpen: false,

    columns: getColumnsForAssetAndTab(initialScreenerType, initialTab),
    sortField: initialAssetPref?.sortField || initialConfig.defaultSort.field,
    sortOrder: (initialAssetPref?.sortOrder as 'asc' | 'desc') || initialConfig.defaultSort.direction,
    currentPage: 1,
    pageSize: 100,

    detailDrawerOpen: false,
    activeDetailTab: 'overview',
    isFilterModalOpen: false,
    isColumnModalOpen: false,

    setScreenerType: (type: ScreenerType) => {
      userPreferencesService.updateActiveScreenerType(type);
      const config = SCREENER_CONFIG[type] || SCREENER_CONFIG.stocks;
      const currentMarket = get().currentMarket;
      const instruments = dataLayer.getInstruments(currentMarket, type);
      const active = instruments[0]?.symbol || '';
      if (active) dataLayer.setActiveSymbol(active);

      const userPref = userPreferencesService.getScreenerPreference(type);
      const initialTab = userPref?.activeTab || config.tabs[0]?.id || 'overview';
      const visiblePreset = userPref?.visibleColumns?.length
        ? userPref.visibleColumns
        : getPresetForScreenerTab(type, initialTab);

      const updatedColumns = ALL_COLUMNS.map((c) => ({
        ...c,
        visible: visiblePreset.includes(c.id),
      }));

      // Reset filters and active title to the default for this asset class
      set({
        screenerType: type,
        activeScreenTitle: config.defaultTitle,
        activeScreenId: `${type}_all`,
        instruments,
        activeSymbol: active,
        activeTab: initialTab,
        columns: updatedColumns,
        quickPreset: 'all',
        advancedFilters: { ...DEFAULT_ADVANCED_FILTERS },
        sortField: userPref?.sortField || config.defaultSort.field,
        sortOrder: (userPref?.sortOrder as 'asc' | 'desc') || config.defaultSort.direction,
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
      const screenerType = get().screenerType || 'stocks';
      const preset = getPresetForScreenerTab(screenerType, activeTab);
      if (preset && preset.length > 0) {
        const updated = ALL_COLUMNS.map((c) => ({
          ...c,
          visible: preset.includes(c.id),
        }));
        set({ activeTab, columns: updated, currentPage: 1 });
        userPreferencesService.updateScreenerView(screenerType, {
          activeTab,
          visibleColumns: preset,
        });
      } else {
        set({ activeTab });
        userPreferencesService.updateScreenerView(screenerType, { activeTab });
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
      const screenerType = get().screenerType || 'stocks';
      const visibleIds = columns.filter((c) => c.visible).map((c) => c.id);
      userPreferencesService.updateScreenerView(screenerType, {
        visibleColumns: visibleIds,
      });
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

if (typeof window !== 'undefined') {
  (window as any).__screenerStore = useScreenerStore;
}
