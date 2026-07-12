import type { ClauseResult } from '../contract/interfaces';
import type { ClauseReason } from '../contract/types';
import type { ReportPolicy } from './interfaces';

import { InconclusiveReason, Verdict } from '../contract/enums';
import { InconclusiveHandling } from './enums';

/** Reasons that mean the gate could not reach/complete the exchange — the server was not tested.
 *  These always block (a conformance gate that ran nothing must not go green), regardless of the
 *  inconclusive policy knob, which governs only the reached-but-undecidable case below. */
const CONNECTIVITY_REASONS = new Set<ClauseReason>([
  InconclusiveReason.Timeout,
  InconclusiveReason.ConnectionRefused,
  InconclusiveReason.DriverError,
]);

/** Blocking severity: Fail outranks Warn; everything else is non-blocking (rank 0). */
function severityRank(verdict: Verdict): number {
  if (verdict === Verdict.Fail) {
    return 2;
  }
  if (verdict === Verdict.Warn) {
    return 1;
  }
  return 0;
}

function blocks(result: ClauseResult, policy: ReportPolicy): boolean {
  if (result.verdict === Verdict.Inconclusive) {
    // "Couldn't reach the server" (or an unreasoned inconclusive) always blocks; "reached the
    // server but the response was undecidable" is governed by the policy (ignored by default).
    if (result.reason === undefined || CONNECTIVITY_REASONS.has(result.reason)) {
      return true;
    }
    return policy.inconclusive === InconclusiveHandling.Fail;
  }
  const rank = severityRank(result.verdict);
  return rank > 0 && rank >= severityRank(policy.failOn);
}

/** The results that block the build under the given policy — the basis for both ok and errors. */
export function selectBlocking(results: readonly ClauseResult[], policy: ReportPolicy): readonly ClauseResult[] {
  return results.filter(result => blocks(result, policy));
}

/** Pure ok view: the run is ok when no result blocks under the given policy. */
export function resolveOk(results: readonly ClauseResult[], policy: ReportPolicy): boolean {
  return selectBlocking(results, policy).length === 0;
}
