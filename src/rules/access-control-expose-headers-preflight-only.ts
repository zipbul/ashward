import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { fieldValues, singleFieldValue } from '../http/decode/fields';
import { ACCESS_CONTROL_ALLOW_ORIGIN, ACCESS_CONTROL_EXPOSE_HEADERS } from '../normative/header-names';
import { WILDCARD } from '../normative/literals';
import { FetchClauseId } from '../standards/catalog/fetch';
import { refsFor } from './kit/clause-refs';
import { defineHttpResponseRule } from './kit/http-response-rule';
import { PROBE_ORIGIN } from './kit/probe-fixtures';

/**
 * §4.2 — `Access-Control-Expose-Headers` is honoured on the actual response and ignored on the
 * preflight. Two probes (actual GET, then preflight): ACEH on the actual → Pass. ACEH only on the
 * preflight → misplacement, but concluded a Fail ONLY when the actual response is itself shared to us
 * (echoes our Origin, or `*`): then it genuinely should have carried ACEH. If the actual is not a
 * grant to us (denied origin), ACEH-on-preflight-only reveals only an OPTIONS/GET asymmetry a browser
 * would never observe → Skip.
 */
export const accessControlExposeHeadersPreflightOnly = defineHttpResponseRule({
  id: Rule.AccessControlExposeHeadersPreflightOnly,
  probes: [{ origin: PROBE_ORIGIN }, { kind: 'preflight', origin: PROBE_ORIGIN, requestMethod: 'GET' }],
  normative: refsFor(FetchClauseId.ExposeHeadersOnActual),
  judge(heads) {
    const [actual, preflight] = heads;
    if (actual === undefined || preflight === undefined) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    if (fieldValues(actual, ACCESS_CONTROL_EXPOSE_HEADERS).length > 0) {
      return { verdict: Verdict.Pass };
    }
    if (fieldValues(preflight, ACCESS_CONTROL_EXPOSE_HEADERS).length === 0) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    const acao = singleFieldValue(actual, ACCESS_CONTROL_ALLOW_ORIGIN);
    const actualSharedToUs = acao === PROBE_ORIGIN || acao === WILDCARD;
    return actualSharedToUs
      ? { verdict: Verdict.Fail, evidenceIndex: 1 }
      : { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
  },
});
