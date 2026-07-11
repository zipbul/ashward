import type { NormativeRef, Taxonomy } from '../../standards/interfaces';
import type { Rule, Verdict } from './enums';
import type { ClauseReason } from './types';

/** The exact bytes a rule exchanged and how the exchange ended — carried on every result for the
 *  report. Deliberately transport-agnostic: `request`/`response` are opaque bytes (absent for an
 *  artifact-only rule that never speaks to a peer), and `outcome` is a transport-tagged string (e.g.
 *  a TCP termination cause). Core never interprets these; only the domain that produced them does. */
export interface Evidence {
  readonly request?: Uint8Array;
  readonly response?: Uint8Array;
  readonly outcome?: string;
}

export interface ClauseResult {
  readonly ruleId: Rule;
  readonly verdict: Verdict;
  readonly reason?: ClauseReason;
  readonly evidence?: Evidence;
}

/**
 * A conformance rule. `Ctx` is whatever its domain hands `run` — an HTTP rule gets an HTTP probe +
 * endpoint, a future artifact rule gets the artifact — so core owns the rule shape (id, provenance,
 * a run that yields a typed result) without knowing any transport. The id/normative/verdict spine is
 * domain-neutral; only the context varies.
 */
export interface RuleDef<Ctx> {
  readonly id: Rule;
  /** The normative sources this rule enforces — a set (one rule cites many). */
  readonly normative: readonly NormativeRef[];
  /** Classification tags (CWE, …) — many-valued, distinct from the normative definition. */
  readonly tags?: Taxonomy;
  run(context: Ctx): Promise<ClauseResult>;
}
