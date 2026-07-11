import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { fieldValues } from '../http/decode/fields';
import { ACCESS_CONTROL_EXPOSE_HEADERS } from '../normative/header-names';
import { FetchClauseId } from '../standards/catalog/fetch';
import { refsFor } from './kit/clause-refs';
import { defineHttpResponseRule } from './kit/http-response-rule';
import { PROBE_ORIGIN } from './kit/probe-fixtures';

/**
 * §4.2 — `Access-Control-Expose-Headers` is honoured on the actual response and ignored on the
 * preflight. Two probes (actual GET, then preflight): if the server sends ACEH only on the preflight
 * and not on the actual response, the headers it means to expose are never exposed → Fail. ACEH on
 * the actual → Pass; on neither → Skip.
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
    const onActual = fieldValues(actual, ACCESS_CONTROL_EXPOSE_HEADERS).length > 0;
    const onPreflight = fieldValues(preflight, ACCESS_CONTROL_EXPOSE_HEADERS).length > 0;
    if (onPreflight && !onActual) {
      return { verdict: Verdict.Fail, evidenceIndex: 1 };
    }
    return onActual ? { verdict: Verdict.Pass } : { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
  },
});
