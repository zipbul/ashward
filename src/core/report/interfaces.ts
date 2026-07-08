import type { Verdict } from '../contract/enums';
import type { ClauseResult } from '../contract/interfaces';
import type { InconclusiveHandling } from './enums';

export interface ReportPolicy {
  /** The least-severe verdict that fails the build: Verdict.Fail (default) or Verdict.Warn. */
  readonly failOn: Verdict;
  readonly inconclusive: InconclusiveHandling;
}

export interface Report {
  readonly results: readonly ClauseResult[];
  /** ok is a computed view over the results under a policy — never a stored field. */
  ok(policy?: Partial<ReportPolicy>): boolean;
}
