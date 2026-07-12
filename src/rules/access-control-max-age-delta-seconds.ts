import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { singleFieldValue } from '../http/decode/fields';
import { isDeltaSeconds } from '../normative/delta-seconds';
import { ACCESS_CONTROL_MAX_AGE } from '../normative/header-names';
import { FetchClauseId } from '../standards/catalog/fetch';
import { refsFor } from './kit/clause-refs';
import { defineHttpResponseRule } from './kit/http-response-rule';
import { PROBE_ORIGIN } from './kit/probe-fixtures';

/**
 * §1.6 — `Access-Control-Max-Age` is generated as `delta-seconds = 1*DIGIT` (no sign, fraction, or
 * units). A malformed value is dropped by the UA to a 5-second default rather than failing the
 * preflight, but it is still a §1.6 violation. Absent → Skip.
 */
export const accessControlMaxAgeDeltaSeconds = defineHttpResponseRule({
  id: Rule.AccessControlMaxAgeDeltaSeconds,
  probes: [{ kind: 'preflight', origin: PROBE_ORIGIN, requestMethod: 'DELETE' }],
  normative: refsFor(FetchClauseId.MaxAgeDeltaSeconds),
  judge(heads) {
    const [head] = heads;
    if (head === undefined) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    const value = singleFieldValue(head, ACCESS_CONTROL_MAX_AGE);
    if (value === null) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    return isDeltaSeconds(value) ? { verdict: Verdict.Pass } : { verdict: Verdict.Fail };
  },
});
