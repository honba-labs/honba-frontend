import { describe, it, expect, vi } from 'vitest';
import { createAlertBus } from './bus';
import type { AlertEvent, AlertRule } from './types';

const ev = (over: Partial<AlertEvent> = {}): AlertEvent => ({
  id: 'e1',
  source: 'chart',
  title: 't',
  severity: 'info',
  time: 0,
  ...over,
});

const rule = (over: Partial<AlertRule> = {}): AlertRule => ({
  id: 'r1',
  name: 'rule',
  family: 'chart',
  enabled: true,
  repeat: 'everyTime',
  cooldownMs: 1000,
  delivery: ['toast'],
  params: {},
  createdAt: 0,
  ...over,
});

function setup(r: AlertRule) {
  let t = 10_000;
  const bus = createAlertBus({ now: () => t, getRule: (id) => (id === r.id ? r : undefined) });
  return { bus, tick: (ms: number) => (t += ms) };
}

describe('createAlertBus', () => {
  it('publishes, unsubscribes and clears', () => {
    const bus = createAlertBus();
    const a = vi.fn();
    const b = vi.fn();
    const off = bus.subscribe(a);
    bus.subscribe(b);
    bus.publish(ev());
    off();
    bus.publish(ev({ id: 'e2' }));
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
    bus.clear();
    bus.publish(ev());
    expect(b).toHaveBeenCalledTimes(2);
  });

  it('isolates a throwing listener', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bus = createAlertBus();
    const ok = vi.fn();
    bus.subscribe(() => {
      throw new Error('boom');
    });
    bus.subscribe(ok);
    expect(() => bus.publish(ev())).not.toThrow();
    expect(ok).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('applies cooldown per rule with an injected clock', () => {
    const { bus, tick } = setup(rule());
    const fn = vi.fn();
    bus.subscribe(fn);
    expect(bus.publish(ev({ ruleId: 'r1' }))).toBe(true);
    tick(999);
    expect(bus.publish(ev({ ruleId: 'r1' }))).toBe(false);
    tick(1);
    expect(bus.publish(ev({ ruleId: 'r1' }))).toBe(true);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('fires a once rule a single time until re-armed', () => {
    const { bus, tick } = setup(rule({ repeat: 'once', cooldownMs: 0 }));
    expect(bus.publish(ev({ ruleId: 'r1' }))).toBe(true);
    tick(60_000);
    expect(bus.publish(ev({ ruleId: 'r1' }))).toBe(false);
    bus.rearm('r1');
    expect(bus.publish(ev({ ruleId: 'r1' }))).toBe(true);
  });

  it('always passes events without a rule or with an unknown rule, drops disabled rules', () => {
    const { bus } = setup(rule({ enabled: false }));
    expect(bus.publish(ev())).toBe(true);
    expect(bus.publish(ev())).toBe(true);
    expect(bus.publish(ev({ ruleId: 'missing' }))).toBe(true);
    expect(bus.publish(ev({ ruleId: 'r1' }))).toBe(false);
  });
});
