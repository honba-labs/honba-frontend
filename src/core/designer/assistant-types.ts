import type { StrategyGraphShape } from '../graph/model';

export type AssistantKind = 'discussion' | 'candidate' | 'validation_error';

export const ASSISTANT_KINDS: ReadonlyArray<AssistantKind> = ['discussion', 'candidate', 'validation_error'] as const;

export interface GraphDiffSummary {
  added_nodes: string[];
  modified_nodes: string[];
  removed_nodes: string[];
  param_changes?: Record<string, unknown>;
}

export interface AssistantDecision {
  orderId: string;
  decision: 'approve' | 'veto' | 'size_down';
  rationale: string;
}

export interface AssistantFinding {
  code: string;
  message: string;
  lineno?: number;
}

export interface AssistantMessage {
  kind: AssistantKind;
  message: string;
  graph?: StrategyGraphShape;
  source?: string;
  diff?: GraphDiffSummary | Record<string, string[]>;
  findings?: AssistantFinding[];
  decisions?: AssistantDecision[];
  blocked: boolean;
  timestamp?: number;
}

export interface AssistantProposal {
  message: string;
  graph?: StrategyGraphShape;
  source?: string;
  decisions?: AssistantDecision[];
}
