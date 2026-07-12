import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { singleFieldValue } from '../http/decode/fields';
import { ACCESS_CONTROL_ALLOW_CREDENTIALS, ACCESS_CONTROL_ALLOW_ORIGIN } from '../normative/header-names';
import { CREDENTIALS_TRUE } from '../normative/literals';
import { FetchClauseId } from '../standards/catalog/fetch';
import { refsFor } from './kit/clause-refs';
import { defineHttpResponseRule } from './kit/http-response-rule';
import { PROBE_ORIGIN } from './kit/probe-fixtures';

/**
 * §3.8 — a preflight's CORS check runs on the ACTUAL request's credentials mode, but a preflight
 * never carries credentials, so credential support must also be signalled on the preflight response.
 * Two probes (preflight, then actual GET). This is only soundly concludable when BOTH: (a) the actual
 * is a credentialed grant to us (ACAC:true + echoed origin — the only cookie-free way to see
 * credentialed intent), AND (b) the preflight itself already speaks CORS to us (echoes our origin) —
 * so it is a preflight a browser would consult. Then a preflight that omits ACAC:true is the §3.8 gap
 * (Fail). If the actual is not a credentialed grant, or the preflight does not speak CORS to us (the
 * server does not preflight our requests), nothing can be concluded → Skip; never a false Fail on a
 * server that simply serves credentialed simple requests without a CORS preflight.
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
    const actualCredentialedToUs =
      singleFieldValue(actual, ACCESS_CONTROL_ALLOW_CREDENTIALS) === CREDENTIALS_TRUE &&
      singleFieldValue(actual, ACCESS_CONTROL_ALLOW_ORIGIN) === PROBE_ORIGIN;
    if (!actualCredentialedToUs) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    if (singleFieldValue(preflight, ACCESS_CONTROL_ALLOW_ORIGIN) !== PROBE_ORIGIN) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    return singleFieldValue(preflight, ACCESS_CONTROL_ALLOW_CREDENTIALS) === CREDENTIALS_TRUE
      ? { verdict: Verdict.Pass }
      : { verdict: Verdict.Fail };
  },
});
