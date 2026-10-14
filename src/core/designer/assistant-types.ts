import type { StrategyGraphShape } from '../graph/model';

export type AssistantKind = 'discussion' | 'candidate' | 'validation_error';

export const ASSISTANT_KINDS: ReadonlyArray<AssistantKind> = ['discussion', 'candidate', 'validation_error'] as const;

export interface AssistantMessage {
  kind: AssistantKind;
  message: string;
  graph?: StrategyGraphShape;
  source?: string;
  diff?: Record<string, string[]>;
  findings?: Array<{ code: string; message: string; lineno?: number }>;
  blocked: boolean;
}

export interface AssistantProposal {
  message: string;
  graph?: StrategyGraphShape;
  source?: string;
}
