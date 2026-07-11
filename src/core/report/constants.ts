import type { ReportPolicy } from './interfaces';

import { Verdict } from '../contract/enums';
import { InconclusiveHandling } from './enums';

/**
 * Fail-closed on connectivity, tolerant of undecidability. A gate that could not reach the server
 * (dead host, wrong URL, refused, timeout) always blocks — that is enforced by reason in ok-policy,
 * not by this knob. This `inconclusive` knob governs only the reached-but-undecidable case (e.g. a
 * live server that answered a framing probe with an odd 1xx): ignored by default so a weird-but-live
 * response does not hard-red the build; set to Fail to make any uncertainty block. Warnings are
 * non-blocking (raise `failOn` to include them).
 */
export const DEFAULT_POLICY: ReportPolicy = {
  failOn: Verdict.Fail,
  inconclusive: InconclusiveHandling.Ignore,
};
