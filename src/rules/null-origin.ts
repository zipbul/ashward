import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { singleFieldValue } from '../http/decode/fields';
import { ACCESS_CONTROL_ALLOW_CREDENTIALS, ACCESS_CONTROL_ALLOW_ORIGIN } from '../normative/header-names';
import { CREDENTIALS_TRUE, NULL_ORIGIN } from '../normative/literals';
import { FetchClauseId } from '../standards/catalog/fetch';
import { refsFor } from './kit/clause-refs';
import { defineHttpResponseRule } from './kit/http-response-rule';

/**
 * Security heuristic (CWE-942), NOT a Fetch MUST. `Origin: null` is producible by any sandboxed /
 * `data:` / cross-origin-redirected context, so a grant to it admits the whole web: with
 * `Access-Control-Allow-Credentials: true` it is credentialed to everyone (Fail); a bare null grant
 * is functionally `*` (Warn). Not granted → Pass. The probe sends `Origin: null`.
 */
export const nullOrigin = defineHttpResponseRule({
  id: Rule.NullOrigin,
  tags: { cwe: ['CWE-942'] },
  probes: [{ origin: NULL_ORIGIN }],
  normative: refsFor(FetchClauseId.AllowOriginMatchesRequest),
  judge(heads) {
    const [head] = heads;
    if (head === undefined) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    if (singleFieldValue(head, ACCESS_CONTROL_ALLOW_ORIGIN) !== NULL_ORIGIN) {
      return { verdict: Verdict.Pass };
    }
    return singleFieldValue(head, ACCESS_CONTROL_ALLOW_CREDENTIALS) === CREDENTIALS_TRUE
      ? { verdict: Verdict.Fail }
      : { verdict: Verdict.Warn };
  },
});
