import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { singleFieldValue } from '../http/decode/fields';
import { ACCESS_CONTROL_ALLOW_PRIVATE_NETWORK } from '../normative/header-names';
import { CREDENTIALS_TRUE } from '../normative/literals';
import { FetchClauseId } from '../standards/catalog/fetch';
import { refsFor } from './kit/clause-refs';
import { defineHttpResponseRule } from './kit/http-response-rule';
import { PROBE_ORIGIN } from './kit/probe-fixtures';

/**
 * §6.1 (WICG PNA, draft) — when a preflight previews `Access-Control-Request-Private-Network: true`
 * and the server grants the access, `Access-Control-Allow-Private-Network` must be the literal bytes
 * `true` (`True`/`TRUE` are a network error). The probe elicits it; absent → Skip. `CREDENTIALS_TRUE`
 * is the shared byte-literal `true` Fetch/PNA compare against, not a credentials concept here.
 */
export const accessControlAllowPrivateNetworkLiteralTrue = defineHttpResponseRule({
  id: Rule.AccessControlAllowPrivateNetworkLiteralTrue,
  probes: [{ kind: 'preflight', origin: PROBE_ORIGIN, requestMethod: 'GET', requestPrivateNetwork: true }],
  normative: refsFor(FetchClauseId.AllowPrivateNetworkLiteralTrue),
  judge(heads) {
    const [head] = heads;
    if (head === undefined) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    const value = singleFieldValue(head, ACCESS_CONTROL_ALLOW_PRIVATE_NETWORK);
    if (value === null) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    return value === CREDENTIALS_TRUE ? { verdict: Verdict.Pass } : { verdict: Verdict.Fail };
  },
});
