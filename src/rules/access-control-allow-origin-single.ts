import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { fieldValues } from '../http/decode/fields';
import { ACCESS_CONTROL_ALLOW_ORIGIN } from '../normative/header-names';
import { FetchClauseId } from '../standards/catalog/fetch';
import { refsFor } from './kit/clause-refs';
import { defineHttpResponseRule } from './kit/http-response-rule';
import { PROBE_ORIGIN } from './kit/probe-fixtures';

/**
 * §2.4 — `Access-Control-Allow-Origin` is generated at most once. Two field lines are read joined by
 * 0x2C 0x20 (`https://a, https://a`), which fails the byte match, so a repeated ACAO is a violation.
 * Absent → Skip; one → Pass; two or more → Fail.
 */
export const accessControlAllowOriginSingle = defineHttpResponseRule({
  id: Rule.AccessControlAllowOriginSingle,
  probes: [{ origin: PROBE_ORIGIN }],
  normative: refsFor(FetchClauseId.AllowOriginAndCredentialsOnce),
  judge(heads) {
    const [head] = heads;
    if (head === undefined) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    const count = fieldValues(head, ACCESS_CONTROL_ALLOW_ORIGIN).length;
    if (count === 0) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    return count > 1 ? { verdict: Verdict.Fail } : { verdict: Verdict.Pass };
  },
});
