import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { singleFieldValue } from '../http/decode/fields';
import { ACCESS_CONTROL_ALLOW_ORIGIN } from '../normative/header-names';
import { FetchClauseId } from '../standards/catalog/fetch';
import { refsFor } from './kit/clause-refs';
import { defineHttpResponseRule } from './kit/http-response-rule';
import { ALT_PROBE_ORIGIN, PROBE_ORIGIN } from './kit/probe-fixtures';
import { varyHasOrigin } from './kit/vary';

/**
 * §7.2 — a static ACAO (`*` or a fixed single origin, the same for every request Origin) should be
 * sent on every response and NOT paired with `Vary: Origin` (which needlessly fragments the cache).
 * Two probes with different Origins: if ACAO is identical for both (static) yet a response carries
 * Vary: Origin → Warn (a SHOULD, not a hard failure). Differing ACAO is §7.1's domain (Pass here).
 */
export const accessControlAllowOriginStaticNoVary = defineHttpResponseRule({
  id: Rule.AccessControlAllowOriginStaticNoVary,
  probes: [{ origin: PROBE_ORIGIN }, { origin: ALT_PROBE_ORIGIN }],
  normative: refsFor(FetchClauseId.StaticOriginNoVary),
  judge(heads) {
    const [a, b] = heads;
    if (a === undefined || b === undefined) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    const acaoA = singleFieldValue(a, ACCESS_CONTROL_ALLOW_ORIGIN);
    const acaoB = singleFieldValue(b, ACCESS_CONTROL_ALLOW_ORIGIN);
    if (acaoA === null || acaoB === null) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    if (acaoA !== acaoB) {
      return { verdict: Verdict.Pass };
    }
    return varyHasOrigin(a) || varyHasOrigin(b) ? { verdict: Verdict.Warn } : { verdict: Verdict.Pass };
  },
});
