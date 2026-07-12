import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { fieldValues } from '../http/decode/fields';
import { ACCESS_CONTROL_ALLOW_CREDENTIALS } from '../normative/header-names';
import { CREDENTIALS_TRUE } from '../normative/literals';
import { FetchClauseId } from '../standards/catalog/fetch';
import { refsFor } from './kit/clause-refs';
import { defineHttpResponseRule } from './kit/http-response-rule';
import { PROBE_ORIGIN } from './kit/probe-fixtures';

/**
 * STANDARDS §1.4 — `Access-Control-Allow-Credentials` MUST be generated as the exact bytes `true`.
 * The CORS check reads it as bytes, so `True`, `TRUE`, `1`, `yes` — and `false`, which Fetch does
 * not define either — are all §1.4 violations: the server emitted something other than the one
 * legal value. All fail (a MUST); only absence is exempt, since §1.4 governs the value when it is
 * generated, not whether it is (Skip). Two field lines combine (0x2C 0x20) and also fail (§2.4).
 */
export const accessControlAllowCredentialsExactTrue = defineHttpResponseRule({
  id: Rule.AccessControlAllowCredentialsExactTrue,
  probes: [{ origin: PROBE_ORIGIN }],
  normative: refsFor(FetchClauseId.AllowCredentialsExactTrue, FetchClauseId.AllowOriginAndCredentialsOnce),

  judge(heads) {
    const [head] = heads;
    if (head === undefined) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }

    const values = fieldValues(head, ACCESS_CONTROL_ALLOW_CREDENTIALS);
    if (values.length === 0) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    if (values.length > 1) {
      return { verdict: Verdict.Fail };
    }

    const [only = ''] = values;
    return only === CREDENTIALS_TRUE ? { verdict: Verdict.Pass } : { verdict: Verdict.Fail };
  },
});
