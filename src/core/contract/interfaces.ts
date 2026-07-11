import type { NormativeRef, Taxonomy } from '../../standards/interfaces';
import type { TerminationCause } from '../driver/enums';
import type { Target } from '../engine/interfaces';
import type { Rule, Verdict } from './enums';
import type { ClauseReason, ProbeFn } from './types';

/** The exact bytes a rule sent and what came back — carried on every result for the report. */
export interface Evidence {
  readonly request: Uint8Array;
  readonly response: Uint8Array;
  readonly termination: TerminationCause;
}

export interface ClauseResult {
  readonly ruleId: Rule;
  readonly verdict: Verdict;
  readonly reason?: ClauseReason;
  readonly evidence?: Evidence;
}

/** Everything a rule is given to do its work: the target-bound probe (send bytes, get the wire
 *  result) and the resolved Target, so a rule can craft requests aimed at the caller's host/path
 *  with the real Host header rather than a hardcoded one. */
export interface RuleContext {
  readonly probe: ProbeFn;
  readonly target: Target;
}

export interface RuleDef {
  readonly id: Rule;
  /** The normative sources this rule enforces — a set (one rule cites many). */
  readonly normative: readonly NormativeRef[];
  /** Classification tags (CWE, …) — many-valued, distinct from the normative definition. */
  readonly tags?: Taxonomy;
  run(context: RuleContext): Promise<ClauseResult>;
}
