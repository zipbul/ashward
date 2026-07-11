import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { singleFieldValue } from '../http/decode/fields';
import { ACCESS_CONTROL_ALLOW_CREDENTIALS, ACCESS_CONTROL_ALLOW_ORIGIN } from '../normative/header-names';
import { CREDENTIALS_TRUE } from '../normative/literals';
import { FetchClauseId } from '../standards/catalog/fetch';
import { refsFor } from './kit/clause-refs';
import { defineHttpResponseRule } from './kit/http-response-rule';
import { PROBE_ORIGIN } from './kit/probe-fixtures';

/** Does this response echo our origin AND grant credentials — a credentialed grant to us? */
function isCredentialedGrant(acao: string | null, acac: string | null): boolean {
  return acac === CREDENTIALS_TRUE && acao === PROBE_ORIGIN;
}

/**
 * §3.8 — a preflight's CORS check runs on the ACTUAL request's credentials mode, but a preflight
 * never carries credentials, so support must be signalled on the preflight response too. Two probes
 * (preflight, then actual GET): if the actual response is a credentialed grant to our origin
 * (ACAC:true + echoed origin) but the preflight is not, a browser's preflight fails and the actual
 * never runs → Fail. If the actual reveals no credentialed intent → Skip.
 */
export const preflightCredentialedGrant = defineHttpResponseRule({
  id: Rule.PreflightCredentialedGrant,
  probes: [{ kind: 'preflight', origin: PROBE_ORIGIN, requestMethod: 'GET' }, { origin: PROBE_ORIGIN }],
  normative: refsFor(FetchClauseId.PreflightCredentialedGrant),
  judge(heads) {
    const [preflight, actual] = heads;
    if (preflight === undefined || actual === undefined) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    const actualGrants = isCredentialedGrant(
      singleFieldValue(actual, ACCESS_CONTROL_ALLOW_ORIGIN),
      singleFieldValue(actual, ACCESS_CONTROL_ALLOW_CREDENTIALS),
    );
    if (!actualGrants) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    const preflightGrants = isCredentialedGrant(
      singleFieldValue(preflight, ACCESS_CONTROL_ALLOW_ORIGIN),
      singleFieldValue(preflight, ACCESS_CONTROL_ALLOW_CREDENTIALS),
    );
    return preflightGrants ? { verdict: Verdict.Pass } : { verdict: Verdict.Fail };
  },
});
