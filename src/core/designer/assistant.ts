import type { ResponseEnvelope } from '../types/generated/domain';
import type { StrategyGraphShape } from '../graph/model';
import type { AssistantDecision, AssistantFinding, AssistantKind, AssistantMessage } from './assistant-types';

/**
 * AI Co-Pilot client helpers (Phase 4, HBD-2026-DES-004).
 *
 * Types mirror the `POST /assistant/propose` contract (§8.1) so the FE can be
 * switched from the offline stub to the backend by feature-detecting the method
 * on the generated client — no hand-written `fetch` and no change to callers.
 * The mapper turns a wire response into the store's `AssistantMessage` shape and
 * enforces the propose-never-execute rule (ADR 0029 S5): a candidate is only
 * actionable when it is not `validation_error` and carries no findings.
 */

export interface AssistantRunSummary {
  run_id: string;
  sharpe?: number;
  max_drawdown_pct?: number;
}

export interface AssistantProposeRequest {
  graph: StrategyGraphShape;
  source: string;
  prompt: string;
  context?: {
    last_run?: AssistantRunSummary;
    /** Trimmed recent turns, to bound the context window (§5.4). */
    messages?: Array<{ kind: AssistantKind; message: string }>;
  };
}

export interface AssistantProposeResponse {
  kind: AssistantKind;
  message: string;
  graph?: StrategyGraphShape;
  diff?: AssistantMessage['diff'];
  findings?: AssistantFinding[];
  decisions?: AssistantDecision[];
}

/** Narrow structural view of the generated client so the seam stays optional. */
export interface AssistantProposeCapable {
  postAssistantPropose?: (
    body: AssistantProposeRequest,
    signal?: AbortSignal,
  ) => Promise<ResponseEnvelope<AssistantProposeResponse>>;
}

/** Prompt accelerators from §5.4. */
export const ASSISTANT_PROMPTS: ReadonlyArray<string> = [
  'Add ATR trailing stop',
  'Add RSI overbought/oversold filter',
  'Optimise MA periods for 15m trend',
  'Enforce 2% max daily drawdown guard',
  'Convert to dual-direction long/short',
];

/**
 * Trimmed conversational context (§5.4 / P4 token budget): the graph, the
 * generated source, the last run summary and the last few turns — never the
 * whole transcript, so a long session cannot blow the context window.
 */
export function assistantContext(input: {
  graph: StrategyGraphShape;
  source: string;
  run?: AssistantRunSummary | null;
  messages?: ReadonlyArray<AssistantMessage>;
  maxMessages?: number;
}): AssistantProposeRequest['context'] {
  const max = input.maxMessages ?? 6;
  const messages = (input.messages ?? []).slice(-max).map((m) => ({ kind: m.kind, message: m.message }));
  return {
    ...(input.run ? { last_run: input.run } : {}),
    ...(messages.length > 0 ? { messages } : {}),
  };
}

/**
 * Summarise a completed run for the co-pilot context. Derived, not authoritative:
 * metrics come straight from the response, never recomputed client-side.
 */
export function runSummary(response: { run_id: string; metrics?: { sharpe?: number; max_drawdown?: number } | null } | null): AssistantRunSummary | null {
  if (!response) return null;
  const summary: AssistantRunSummary = { run_id: response.run_id };
  if (typeof response.metrics?.sharpe === 'number') summary.sharpe = response.metrics.sharpe;
  if (typeof response.metrics?.max_drawdown === 'number') summary.max_drawdown_pct = response.metrics.max_drawdown * 100;
  return summary;
}

export function hasAssistantPropose(client: unknown): client is AssistantProposeCapable {
  return !!client && typeof (client as AssistantProposeCapable).postAssistantPropose === 'function';
}

/**
 * Map a wire response to an `AssistantMessage`.
 *
 * `validation_error` is always blocked regardless of the payload flag; a
 * `candidate` that arrives with findings is also quarantined, so a buggy or
 * compromised backend cannot smuggle a blocked candidate into "apply".
 */
export function toAssistantMessage(response: AssistantProposeResponse): AssistantMessage {
  const findings = response.findings ?? [];
  const blocked = response.kind === 'validation_error' || findings.length > 0;
  return {
    kind: response.kind,
    message: response.message,
    ...(response.graph ? { graph: response.graph } : {}),
    ...(response.diff ? { diff: response.diff } : {}),
    ...(findings.length > 0 ? { findings } : {}),
    ...(response.decisions ? { decisions: response.decisions } : {}),
    blocked,
    timestamp: Date.now(),
  };
}

/** Whether a candidate card may be applied to the canvas. */
export function canApply(message: AssistantMessage): boolean {
  return message.kind === 'candidate' && !!message.graph && !message.blocked;
}
