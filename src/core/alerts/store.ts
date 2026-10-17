import { create } from 'zustand';
import { parseAlertsDocument, type AlertsDocument } from 'openalgo-charts';
import { createAlertBus } from './bus';
import type { AlertEvent, AlertRule } from './types';

export const ALERT_STORAGE_KEY = 'honba_alerts_v1';
export const ALERT_HISTORY_CAP = 500;

export interface AlertHistoryEntry {
  event: AlertEvent;
  acked: boolean;
}

export interface AlertState {
  rules: AlertRule[];
  /** Newest first, capped at ALERT_HISTORY_CAP. Not persisted. */
  history: AlertHistoryEntry[];
  chartAlerts: AlertsDocument | undefined;

  addRule: (rule: AlertRule) => void;
  updateRule: (id: string, patch: Partial<Omit<AlertRule, 'id'>>) => void;
  removeRule: (id: string) => void;
  setEnabled: (id: string, enabled: boolean) => void;
  /** Let a spent `once` rule fire again. */
  rearm: (id: string) => void;

  record: (event: AlertEvent) => void;
  ack: (id: string) => void;
  clearHistory: () => void;

  /** Returns false and keeps the old document when parsing fails. */
  setChartAlerts: (doc: unknown) => boolean;
}

interface PersistedAlerts {
  rules: AlertRule[];
  chartAlerts?: AlertsDocument;
}

function loadPersisted(): PersistedAlerts {
  try {
    const raw = localStorage.getItem(ALERT_STORAGE_KEY);
    if (!raw) return { rules: [] };
    const data = JSON.parse(raw) as Partial<PersistedAlerts>;
    const rules = Array.isArray(data.rules) ? data.rules : [];
    let chartAlerts: AlertsDocument | undefined;
    if (data.chartAlerts !== undefined) {
      try {
        chartAlerts = parseAlertsDocument(data.chartAlerts);
      } catch {
        chartAlerts = undefined;
      }
    }
    return { rules, chartAlerts };
  } catch {
    return { rules: [] };
  }
}

function savePersisted(state: Pick<AlertState, 'rules' | 'chartAlerts'>): void {
  try {
    const data: PersistedAlerts = { rules: state.rules, chartAlerts: state.chartAlerts };
    localStorage.setItem(ALERT_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage may be unavailable or full; alerts keep working in memory.
  }
}

const initial = loadPersisted();

export const useAlertStore = create<AlertState>((set) => ({
  rules: initial.rules,
  history: [],
  chartAlerts: initial.chartAlerts,

  addRule: (rule) => set((s) => ({ rules: [...s.rules, rule] })),
  updateRule: (id, patch) =>
    set((s) => ({ rules: s.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
  removeRule: (id) => {
    bus.rearm(id);
    set((s) => ({ rules: s.rules.filter((r) => r.id !== id) }));
  },
  setEnabled: (id, enabled) =>
    set((s) => ({ rules: s.rules.map((r) => (r.id === id ? { ...r, enabled } : r)) })),
  rearm: (id) => bus.rearm(id),

  record: (event) =>
    set((s) => ({ history: [{ event, acked: false }, ...s.history].slice(0, ALERT_HISTORY_CAP) })),
  ack: (id) =>
    set((s) => ({
      history: s.history.map((h) => (h.event.id === id ? { ...h, acked: true } : h)),
    })),
  clearHistory: () => set({ history: [] }),

  setChartAlerts: (doc) => {
    try {
      const parsed = parseAlertsDocument(doc);
      set({ chartAlerts: parsed });
      return true;
    } catch {
      return false;
    }
  },
}));

// Persist rules and chart alerts only; history changes do not touch storage.
useAlertStore.subscribe((state, prev) => {
  if (state.rules !== prev.rules || state.chartAlerts !== prev.chartAlerts) savePersisted(state);
});

/** Singleton bus: rule lookups come from the store, every delivered event is recorded. */
export const bus = createAlertBus({
  getRule: (id) => useAlertStore.getState().rules.find((r) => r.id === id),
});
bus.subscribe((event) => useAlertStore.getState().record(event));
