import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { ETAG, IF_MATCH } from '../normative/header-names';
import { WILDCARD } from '../normative/literals';
import { ConditionalClauseId } from '../standards/catalog/conditional-request';
import { refsFor } from './kit/clause-refs';
import { defineConditionalRule, headerOf } from './kit/conditional-rule';

/** True for a 2xx (success) status. */
function isSuccess(status: number): boolean {
  return status >= 200 && status <= 299;
}

/**
 * C4 — §5.1.3 MUST NOT: on a GET whose `If-Match` names an entity-tag that cannot match the
 * discovered `ETag`, the method MUST NOT be performed. A literal, never-matching tag (`"no-match"`)
 * is the disqualifying probe; a second, differential probe carries `If-Match: *` — the STANDARD's own
 * contrast case (a current representation exists, so the wildcard legitimately evaluates true and the
 * method IS performed, 200) — so the judge (pass-2) actually CONSULTS both outcomes: it Passes only
 * when the never-matching tag elicits 412 AND the wildcard elicits 2xx. A server that answers 412
 * unconditionally (ignoring If-Match's value entirely) would otherwise false-Pass on probe 0 alone —
 * that shape now Fails.
 */
export const ifMatchFalseNotPerformed = defineConditionalRule({
  id: Rule.IfMatchFalseNotPerformed,
  normative: refsFor(ConditionalClauseId.IfMatchFalseNotPerformed),
  guard: 'validator',
  validatorHeaders: [ETAG],
  gate(discovered) {
    const [baseline] = discovered;
    if (baseline?.status !== 200) {
      return SkipReason.NoValidator;
    }
    return headerOf(baseline, ETAG) === null ? SkipReason.NoValidator : null;
  },
  build() {
    return [{ headers: [{ name: IF_MATCH, value: '"no-match"' }] }, { headers: [{ name: IF_MATCH, value: WILDCARD }] }];
  },
  judge(_discovered, probed) {
    const disqualifying = probed[0]?.status;
    const contrast = probed[1]?.status;
    if (disqualifying === 412) {
      if (contrast !== undefined && isSuccess(contrast)) {
        return { verdict: Verdict.Pass };
      }
      if (contrast === 412) {
        return { verdict: Verdict.Fail };
      }
      return { verdict: Verdict.Skip, reason: SkipReason.EndpointUnstable };
    }
    if (disqualifying !== undefined && isSuccess(disqualifying)) {
      return { verdict: Verdict.Fail };
    }
    return { verdict: Verdict.Skip, reason: SkipReason.EndpointUnstable };
  },
});
