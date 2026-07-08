import { DEFAULT_POLICY } from '../report/constants';
import { selectBlocking } from '../report/ok-policy';
import { AshwardError } from './ashward-error';
import type { Report, ReportPolicy } from '../report/interfaces';

/**
 * Runner-agnostic gate: throw an AshwardError (with per-clause detail) when the report
 * blocks under the policy, otherwise return silently. Works in any runner because a thrown
 * error is the one universal failure signal.
 */
export function assertConformance(report: Report, policy?: Partial<ReportPolicy>): void {
  const resolved: ReportPolicy = { ...DEFAULT_POLICY, ...policy };
  const blocking = selectBlocking(report.results, resolved);
  if (blocking.length > 0) throw new AshwardError(blocking);
}
