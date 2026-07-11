import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { singleFieldValue } from '../http/decode/fields';
import { ACCESS_CONTROL_ALLOW_CREDENTIALS, ACCESS_CONTROL_ALLOW_ORIGIN } from '../normative/header-names';
import { CREDENTIALS_TRUE } from '../normative/literals';
import { FetchClauseId } from '../standards/catalog/fetch';
import { refsFor } from './kit/clause-refs';
import { defineHttpResponseRule } from './kit/http-response-rule';
import { PROBE_ORIGIN } from './kit/probe-fixtures';

/**
 * Security heuristic (CWE-346/942), NOT a Fetch MUST — §2.2 says reflection passes the CORS check.
 * A server that reflects our forged `.invalid` Origin into ACAO trusts an arbitrary origin: with
 * `Access-Control-Allow-Credentials: true` that origin reads the response with the victim's session
 * (Fail); bare reflection is functionally `*` and public-API-shaped (Warn). Not reflected → Pass.
 */
export const originReflection = defineHttpResponseRule({
  id: Rule.OriginReflection,
  tags: { cwe: ['CWE-346', 'CWE-942'] },
  probes: [{ origin: PROBE_ORIGIN }],
  normative: refsFor(FetchClauseId.AllowOriginMatchesRequest),
  judge(heads) {
    const [head] = heads;
    if (head === undefined) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    if (singleFieldValue(head, ACCESS_CONTROL_ALLOW_ORIGIN) !== PROBE_ORIGIN) {
      return { verdict: Verdict.Pass };
    }
    return singleFieldValue(head, ACCESS_CONTROL_ALLOW_CREDENTIALS) === CREDENTIALS_TRUE
      ? { verdict: Verdict.Fail }
      : { verdict: Verdict.Warn };
  },
});
