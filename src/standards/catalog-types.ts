import type { Rule } from '../core/contract/enums';
import type { Severity, TestabilityBasis } from './disposition-enums';
import type { ReqLevel } from './enums';
import type { NormativeRef } from './interfaces';
import type { CweId } from './types';

/** One normative requirement of a standard, as a citable unit. `id` is a neutral kebab string; each
 *  catalog module defines its own id enum (so a new standard never edits a shared global enum), and
 *  the composition edge checks the ids are globally unique. */
export interface Clause {
  readonly id: string;
  readonly reqLevel: ReqLevel;
  readonly normative: readonly NormativeRef[];
  readonly summary: string;
}

/** One rule covering (part of) a clause, with the basis by which it reaches a sound verdict and the
 *  blocking severity mapped from the clause's requirement level. */
export interface RuleMapping {
  readonly ruleId: Rule;
  readonly basis: TestabilityBasis;
  readonly severity: Severity;
  /** Required when a MUST/MUST NOT clause maps to a non-Fail severity — justifies the downgrade. */
  readonly severityNote?: string;
}

/** How one clause is accounted for: the rules that test it, and/or the part that is untestable
 *  blackbox (with a reason). Never silently dropped. */
export interface Disposition {
  readonly clause: string;
  readonly rules: readonly RuleMapping[];
  readonly untestable?: string;
}

/** A security-heuristic rule that is NOT a standard MUST, keyed by the CWE it guards against, with
 *  the clause it relates to as context only — it never claims clause-coverage credit. */
export interface Heuristic {
  readonly ruleId: Rule;
  readonly cwe: readonly CweId[];
  readonly relatesTo: string;
  readonly rationale: string;
}

/** One standard's self-contained account: its clauses, how each is dispositioned, its security
 *  heuristics, and its OWN hardcoded snapshot of clause ids. Adding a standard is adding one of
 *  these and composing it — never editing a shared global enum, table, or snapshot. */
export interface Catalog {
  readonly name: string;
  readonly clauses: readonly Clause[];
  readonly dispositions: readonly Disposition[];
  readonly heuristics: readonly Heuristic[];
  readonly snapshot: readonly string[];
}
