import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { fieldValues } from '../http/decode/fields';
import {
  ACCESS_CONTROL_ALLOW_HEADERS,
  ACCESS_CONTROL_ALLOW_METHODS,
  ACCESS_CONTROL_ALLOW_ORIGIN,
} from '../normative/header-names';
import { isOkStatus } from '../normative/ok-status';
import { FetchClauseId } from '../standards/catalog/fetch';
import { refsFor } from './kit/clause-refs';
import { defineHttpResponseRule } from './kit/http-response-rule';
import { PROBE_ORIGIN } from './kit/probe-fixtures';

/**
 * §3.1 — a CORS preflight response must carry an ok status (200–299); a non-2xx preflight is a network
 * error before its headers are used. Conditioned on the response actually speaking CORS — carrying an
 * ACAO grant OR an Access-Control-Allow-Methods/Headers listing — so a plain 404/405 to OPTIONS from a
 * server that does no CORS is not flagged (Skip). Any CORS-speaking preflight on a non-2xx status
 * fails, whether or not it happens to include ACAO.
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
    const speaksCors =
      fieldValues(head, ACCESS_CONTROL_ALLOW_ORIGIN).length > 0 ||
      fieldValues(head, ACCESS_CONTROL_ALLOW_METHODS).length > 0 ||
      fieldValues(head, ACCESS_CONTROL_ALLOW_HEADERS).length > 0;
    if (!speaksCors) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    return isOkStatus(head.statusLine.statusCode) ? { verdict: Verdict.Pass } : { verdict: Verdict.Fail };
  },
});
