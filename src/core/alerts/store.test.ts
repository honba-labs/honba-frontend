import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ALERT_HISTORY_CAP, ALERT_STORAGE_KEY, bus, useAlertStore } from './store';
import type { AlertEvent, AlertRule } from './types';

const rule = (over: Partial<AlertRule> = {}): AlertRule => ({
  id: 'r1',
  name: 'rule',
  family: 'engine',
  enabled: true,
  repeat: 'everyTime',
  cooldownMs: 0,
  delivery: ['log'],
  params: {},
  createdAt: 1,
  ...over,
});

const ev = (id: string, over: Partial<AlertEvent> = {}): AlertEvent => ({
  id,
  source: 'engine',
  title: id,
  severity: 'info',
  time: 1,
  ...over,
});

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe('useAlertStore', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', fakeStorage());
    useAlertStore.setState({ rules: [], history: [], chartAlerts: undefined });
    bus.rearm('r1');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('manages rules', () => {
    const s = useAlertStore.getState();
    s.addRule(rule());
    s.updateRule('r1', { name: 'renamed' });
    s.setEnabled('r1', false);
    expect(useAlertStore.getState().rules[0]).toMatchObject({ name: 'renamed', enabled: false });
    s.removeRule('r1');
    expect(useAlertStore.getState().rules).toEqual([]);
  });

  it('records bus events newest first, caps history and acks', () => {
    for (let i = 0; i < ALERT_HISTORY_CAP + 5; i++) bus.publish(ev(`e${i}`));
    const { history } = useAlertStore.getState();
    expect(history).toHaveLength(ALERT_HISTORY_CAP);
    expect(history[0].event.id).toBe(`e${ALERT_HISTORY_CAP + 4}`);
    useAlertStore.getState().ack(history[0].event.id);
    expect(useAlertStore.getState().history[0].acked).toBe(true);
    expect(useAlertStore.getState().history[1].acked).toBe(false);
    useAlertStore.getState().clearHistory();
    expect(useAlertStore.getState().history).toEqual([]);
  });

  it('rearm lets a once rule fire again through the bus', () => {
    useAlertStore.getState().addRule(rule({ repeat: 'once' }));
    expect(bus.publish(ev('a', { ruleId: 'r1' }))).toBe(true);
    expect(bus.publish(ev('b', { ruleId: 'r1' }))).toBe(false);
    useAlertStore.getState().rearm('r1');
    expect(bus.publish(ev('c', { ruleId: 'r1' }))).toBe(true);
  });

  it('accepts a valid chart document and rejects garbage keeping the old one', () => {
    const doc = { version: 1, alerts: [] };
    expect(useAlertStore.getState().setChartAlerts(doc)).toBe(true);
    const kept = useAlertStore.getState().chartAlerts;
    expect(kept).toEqual(doc);
    expect(useAlertStore.getState().setChartAlerts({ version: 99, alerts: 'nope' })).toBe(false);
    expect(useAlertStore.getState().setChartAlerts(42)).toBe(false);
    expect(useAlertStore.getState().chartAlerts).toBe(kept);
  });

  it('persists rules and chart alerts but not history', () => {
    const s = useAlertStore.getState();
    s.addRule(rule());
    s.setChartAlerts({ version: 1, alerts: [] });
    bus.publish(ev('x'));
    const raw = (localStorage as unknown as ReturnType<typeof fakeStorage>).data.get(ALERT_STORAGE_KEY);
    const saved = JSON.parse(raw!);
    expect(saved.rules).toHaveLength(1);
    expect(saved.chartAlerts).toEqual({ version: 1, alerts: [] });
    expect(saved.history).toBeUndefined();
  });

  it('restores persisted state on a fresh module load', async () => {
    const storage = fakeStorage();
    storage.setItem(
      ALERT_STORAGE_KEY,
      JSON.stringify({ rules: [rule()], chartAlerts: { version: 1, alerts: [] } }),
    );
    vi.stubGlobal('localStorage', storage);
    vi.resetModules();
    const fresh = await import('./store');
    expect(fresh.useAlertStore.getState().rules).toHaveLength(1);
    expect(fresh.useAlertStore.getState().chartAlerts).toEqual({ version: 1, alerts: [] });
  });

  it('keeps working when localStorage throws', async () => {
    const boom = () => {
      throw new Error('denied');
    };
    vi.stubGlobal('localStorage', { getItem: boom, setItem: boom, removeItem: boom });
    vi.resetModules();
    const fresh = await import('./store');
    expect(fresh.useAlertStore.getState().rules).toEqual([]);
    expect(() => fresh.useAlertStore.getState().addRule(rule())).not.toThrow();
    expect(fresh.useAlertStore.getState().rules).toHaveLength(1);
  });
});
