import { Rule, Verdict } from '../core/contract/enums';
import { singleFieldValue } from '../http/decode/fields';
import { ACCESS_CONTROL_ALLOW_ORIGIN } from '../normative/header-names';
import { FetchClauseId } from '../standards/catalog/fetch';
import { refsFor } from './kit/clause-refs';
import { defineHttpResponseRule } from './kit/http-response-rule';
import { ALT_PROBE_ORIGIN, PROBE_ORIGIN } from './kit/probe-fixtures';
import { varyHasOrigin } from './kit/vary';

/**
 * §7.1 — if `Access-Control-Allow-Origin`'s presence or value depends on the request `Origin`, every
 * response for the resource should carry `Vary: Origin` (else an ACAO-less cached response is reused
 * for a later CORS request). Two probes with different Origins: if ACAO differs (origin-dependent)
 * but a response lacks Vary: Origin → Warn (a SHOULD). Static ACAO → Pass (§7.2's domain).
 */
export const varyOrigin = defineHttpResponseRule({
  id: Rule.VaryOrigin,
  probes: [{ origin: PROBE_ORIGIN }, { origin: ALT_PROBE_ORIGIN }],
  normative: refsFor(FetchClauseId.VaryOriginWhenVarying),
  judge(heads) {
    const [a, b] = heads;
    if (a === undefined || b === undefined) {
      return { verdict: Verdict.Pass };
    }
    const dependsOnOrigin = singleFieldValue(a, ACCESS_CONTROL_ALLOW_ORIGIN) !== singleFieldValue(b, ACCESS_CONTROL_ALLOW_ORIGIN);
    if (!dependsOnOrigin) {
      return { verdict: Verdict.Pass };
    }
    return varyHasOrigin(a) && varyHasOrigin(b) ? { verdict: Verdict.Pass } : { verdict: Verdict.Warn };
  },
});
