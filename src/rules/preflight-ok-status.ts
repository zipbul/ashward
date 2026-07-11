import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { singleFieldValue } from '../http/decode/fields';
import { ACCESS_CONTROL_ALLOW_ORIGIN } from '../normative/header-names';
import { isOkStatus } from '../normative/ok-status';
import { FetchClauseId } from '../standards/catalog/fetch';
import { refsFor } from './kit/clause-refs';
import { defineHttpResponseRule } from './kit/http-response-rule';
import { PROBE_ORIGIN } from './kit/probe-fixtures';

/**
 * §3.1 — a CORS preflight response must carry an ok status (200–299); Fetch reads its headers only
 * then. Conditioned on the response actually speaking CORS (an ACAO grant is present): a grant on a
 * non-2xx preflight would be a network error → Fail. No grant → the server is not sharing (Skip).
 */
export const preflightOkStatus = defineHttpResponseRule({
  id: Rule.PreflightOkStatus,
  probes: [{ kind: 'preflight', origin: PROBE_ORIGIN, requestMethod: 'DELETE' }],
  normative: refsFor(FetchClauseId.PreflightOkStatus),
  judge(heads) {
    const [head] = heads;
    if (head === undefined) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    if (singleFieldValue(head, ACCESS_CONTROL_ALLOW_ORIGIN) === null) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    return isOkStatus(head.statusLine.statusCode) ? { verdict: Verdict.Pass } : { verdict: Verdict.Fail };
  },
});
