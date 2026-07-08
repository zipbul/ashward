import type { NormativeRef, Taxonomy } from '../../standards/interfaces';
import type { TerminationCause } from '../driver/enums';
import type { Rule, Verdict, InconclusiveReason } from './enums';
import type { ProbeFn } from './types';

/** The exact bytes a rule sent and what came back — carried on every result for the report. */
export interface Evidence {
  readonly request: Uint8Array;
  readonly response: Uint8Array;
  readonly termination: TerminationCause;
}

export interface ClauseResult {
  readonly ruleId: Rule;
  readonly verdict: Verdict;
  readonly reason?: InconclusiveReason;
  readonly evidence?: Evidence;
}

/** Everything a rule is given to do its work — for now, just the target-bound probe. */
export interface RuleContext {
  readonly probe: ProbeFn;
}

export interface RuleDef {
  readonly id: Rule;
  /** The normative sources this rule enforces — a set (one rule cites many). */
  readonly normative: readonly NormativeRef[];
  /** Classification tags (CWE, …) — many-valued, distinct from the normative definition. */
  readonly tags?: Taxonomy;
  run(context: RuleContext): Promise<ClauseResult>;
}
