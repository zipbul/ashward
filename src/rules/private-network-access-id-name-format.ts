import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { singleFieldValue } from '../http/decode/fields';
import { PRIVATE_NETWORK_ACCESS_ID, PRIVATE_NETWORK_ACCESS_NAME } from '../normative/header-names';
import { isPnaId, isPnaName } from '../normative/pna-format';
import { FetchClauseId } from '../standards/catalog/fetch';
import { refsFor } from './kit/clause-refs';
import { defineHttpResponseRule } from './kit/http-response-rule';
import { PROBE_ORIGIN } from './kit/probe-fixtures';

/**
 * §6.2 (WICG PNA, draft) — when a response carries BOTH `Private-Network-Access-ID` and `-Name`, the
 * ID is six colon-separated hex bytes and the Name matches `/^[a-z0-9_\-.]+$/` (≤248 code units); a
 * format violation is a network error. Judged only when both are present — either absent/blank and
 * the UA treats it as an ephemeral grant with no format check (Skip).
 */
export const privateNetworkAccessIdNameFormat = defineHttpResponseRule({
  id: Rule.PrivateNetworkAccessIdNameFormat,
  probes: [{ origin: PROBE_ORIGIN }],
  normative: refsFor(FetchClauseId.PrivateNetworkIdNameFormat),
  judge(heads) {
    const [head] = heads;
    if (head === undefined) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    const id = singleFieldValue(head, PRIVATE_NETWORK_ACCESS_ID);
    const name = singleFieldValue(head, PRIVATE_NETWORK_ACCESS_NAME);
    if (id === null || name === null) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    return isPnaId(id) && isPnaName(name) ? { verdict: Verdict.Pass } : { verdict: Verdict.Fail };
  },
});
