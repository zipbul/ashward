import type { Report, ReportPolicy } from '../report/interfaces';

import { DEFAULT_POLICY } from '../report/constants';
import { selectBlocking } from '../report/ok-policy';
import { AshwardError } from './ashward-error';

/**
 * Runner-agnostic gate: throw an AshwardError (with per-clause detail) when the report blocks under
 * the policy, otherwise return silently. Pairs with `report.ok()` — same policy, but throws instead
 * of returning a boolean. Works in any runner because a thrown error is the one universal failure
 * signal.
 */
export function assertOk(report: Report, policy?: Partial<ReportPolicy>): void {
  const resolved: ReportPolicy = { ...DEFAULT_POLICY, ...policy };
  const blocking = selectBlocking(report.results, resolved);
  if (blocking.length > 0) {
    throw new AshwardError(blocking);
  }
}
