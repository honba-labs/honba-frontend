import { create } from 'zustand';

import type { HonbaClient } from '../api/generated/client';
import type { Order, Position, Trade } from '../types/generated/domain';
import { runModeBadge, type RunMode } from './ops';

export interface OpsLogLine {
  ts: number;
  level: 'info' | 'warning' | 'error';
  text: string;
}

export interface AiDecision {
  orderId: string;
  decision: 'approve' | 'veto' | 'size_down';
  rationale: string;
}

interface OpsState {
  mode: RunMode;
  killSwitch: boolean;
  approved: boolean;
  positions: Position[];
  orders: Order[];
  executions: Trade[];
  decisions: AiDecision[];
  log: OpsLogLine[];
  error: string | null;
  setMode: (mode: RunMode) => void;
  setKillSwitch: (on: boolean) => void;
  setApproved: (approved: boolean) => void;
  badge: () => ReturnType<typeof runModeBadge>;
  refresh: (client: HonbaClient) => Promise<void>;
  closePositions: (client: HonbaClient) => Promise<void>;
  cancelOrder: (client: HonbaClient, orderId: string) => Promise<void>;
  logLine: (level: OpsLogLine['level'], text: string) => void;
}

export const useOpsStore = create<OpsState>((set, get) => ({
  mode: 'paper',
  killSwitch: false,
  approved: true,
  positions: [],
  orders: [],
  executions: [],
  decisions: [],
  log: [],
  error: null,

  setMode: (mode) => set({ mode }),
  setKillSwitch: (killSwitch) => set({ killSwitch }),
  setApproved: (approved) => set({ approved }),

  badge: () => runModeBadge(get().mode, { killSwitch: get().killSwitch, approved: get().approved }),

  logLine: (level, text) =>
    set((state) => ({ log: [...state.log, { ts: Date.now(), level, text }].slice(-200) })),

  refresh: async (client) => {
    try {
      const orders = await client.getOrders();
      set({ orders: [...(orders.data?.orders ?? [])], error: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  closePositions: async (client) => {
    try {
      const envelope = await client.postPositionsClose();
      set({ positions: [...(envelope.data?.positions ?? [])], error: null });
      get().logLine('info', 'close-all requested');
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  cancelOrder: async (client, orderId) => {
    try {
      await client.deleteOrdersById(orderId);
      set((state) => ({ orders: state.orders.filter((o) => o.order_id !== orderId), error: null }));
      get().logLine('info', `cancel requested for ${orderId}`);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },
}));
