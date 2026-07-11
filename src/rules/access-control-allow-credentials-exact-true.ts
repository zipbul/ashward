import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { ACCESS_CONTROL_ALLOW_CREDENTIALS, CREDENTIALS_TRUE } from '../cors/constants';
import { fieldValues } from '../http/decode/fields';
import { WHATWG_FETCH } from '../standards/constants';
import { LocatorKind, ReqLevel } from '../standards/enums';
import { PROBE_ORIGIN } from './_kit/constants';
import { defineCorsRule } from './_kit/define-cors-rule';

/**
 * STANDARDS §1.4 — `Access-Control-Allow-Credentials` MUST be generated as the exact bytes `true`.
 * The CORS check reads it as bytes, so `True`, `TRUE`, `1`, `yes` — and `false`, which Fetch does
 * not define either — are all §1.4 violations: the server emitted something other than the one
 * legal value. All fail (a MUST); only absence is exempt, since §1.4 governs the value when it is
 * generated, not whether it is (Skip).
 */
export const accessControlAllowCredentialsExactTrue = defineCorsRule({
  id: Rule.AccessControlAllowCredentialsExactTrue,
  probes: [{ origin: PROBE_ORIGIN }],
  normative: [
    // §1.4 — the value must be the exact bytes `true`.
    { doc: WHATWG_FETCH, locator: { kind: LocatorKind.Anchor, value: 'http-new-header-syntax' }, req: ReqLevel.Must },
    // §2.4 — ACAC is generated at most once; two field lines combine (0x2C 0x20) and fail the match.
    { doc: WHATWG_FETCH, locator: { kind: LocatorKind.Anchor, value: 'cors-check' }, req: ReqLevel.Must },
    { doc: WHATWG_FETCH, locator: { kind: LocatorKind.Anchor, value: 'terminology-headers' }, req: ReqLevel.Must },
  ],

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
