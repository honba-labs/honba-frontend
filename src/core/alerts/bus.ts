import type { AlertEvent, AlertRule } from './types';

export type AlertListener = (event: AlertEvent) => void;

export interface AlertBusOptions {
  /** Clock used for cooldowns only (epoch ms). */
  now?: () => number;
  /** Rule lookup, injected so the bus does not import the store. */
  getRule?: (ruleId: string) => AlertRule | undefined;
}

export interface AlertBus {
  /** Returns true when the event reached the listeners, false when dropped. */
  publish(event: AlertEvent): boolean;
  subscribe(listener: AlertListener): () => void;
  /** Re-arm a `once` rule and reset its cooldown. */
  rearm(ruleId: string): void;
  /** Drop all listeners and per-rule state. */
  clear(): void;
}

export function createAlertBus(options: AlertBusOptions = {}): AlertBus {
  const now = options.now ?? Date.now;
  const getRule = options.getRule;
  const listeners = new Set<AlertListener>();
  // Last delivery time per rule; presence also marks a `once` rule as spent.
  const lastFired = new Map<string, number>();

  function allowed(event: AlertEvent): boolean {
    const { ruleId } = event;
    if (!ruleId || !getRule) return true;
    const rule = getRule(ruleId);
    if (!rule) return true;
    if (!rule.enabled) return false;
    const last = lastFired.get(ruleId);
    if (last === undefined) return true;
    if (rule.repeat === 'once') return false;
    return now() - last >= rule.cooldownMs;
  }

  return {
    publish(event) {
      if (!allowed(event)) return false;
      if (event.ruleId) lastFired.set(event.ruleId, now());
      for (const listener of [...listeners]) {
        try {
          listener(event);
        } catch (err) {
          console.error('alert listener failed', err);
        }
      }
      return true;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    rearm(ruleId) {
      lastFired.delete(ruleId);
    },
    clear() {
      listeners.clear();
      lastFired.clear();
    },
  };
}
