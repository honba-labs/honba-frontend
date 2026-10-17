/** Shared alert types: the event every trigger family publishes, and the stored rule. */

/** Where an alert comes from. */
export type AlertSourceFamily = 'chart' | 'strategy' | 'engine' | 'feed';

export type AlertSeverity = 'info' | 'warning' | 'critical';

/** Delivery sinks a rule can opt into (the sinks themselves live elsewhere). */
export type DeliveryKind = 'toast' | 'log' | 'notification' | 'sound' | 'webhook' | 'action';

export interface AlertEvent {
  id: string;
  /** Rule that produced the event; events without one are never rate limited. */
  ruleId?: string;
  source: AlertSourceFamily;
  title: string;
  message?: string;
  severity: AlertSeverity;
  /** Epoch ms stamped by the producer; the bus never reads a clock for this. */
  time: number;
  payload?: unknown;
}

export interface AlertRule {
  id: string;
  name: string;
  family: AlertSourceFamily;
  enabled: boolean;
  /** `once` fires a single time until the rule is re-armed. */
  repeat: 'once' | 'everyTime';
  /** Minimum gap between two deliveries for this rule; 0 disables the gap. */
  cooldownMs: number;
  delivery: DeliveryKind[];
  /** Family specific condition, kept opaque here. */
  params: Record<string, unknown>;
  createdAt: number;
}
