import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { ETAG, IF_MATCH } from '../normative/header-names';
import { ConditionalClauseId } from '../standards/catalog/conditional-request';
import { refsFor } from './kit/clause-refs';
import { defineConditionalRule, headerOf } from './kit/conditional-rule';

/** True for a strong (non-`W/`-prefixed) entity-tag value. */
function isStrongEtag(value: string): boolean {
  return !value.startsWith('W/');
}

/**
 * C5 — §2.3 MUST: `If-Match` comparison uses STRONG comparison, so a weak version of the discovered
 * `ETag` never matches even though it shares the same opaque-tag. Needs a discovered STRONG `ETag` —
 * a weak discovered ETag Skips(NotApplicable), same reasoning as C3.
 */
export const ifMatchStrongComparison = defineConditionalRule({
  id: Rule.IfMatchStrongComparison,
  normative: refsFor(ConditionalClauseId.IfMatchStrongComparison),
  guard: 'validator',
  validatorHeaders: [ETAG],
  gate(discovered) {
    const [baseline] = discovered;
    if (baseline?.status !== 200) {
      return SkipReason.NoValidator;
    }
    const etag = headerOf(baseline, ETAG);
    if (etag === null) {
      return SkipReason.NoValidator;
    }
    return isStrongEtag(etag) ? null : SkipReason.NotApplicable;
  },
  build(discovered) {
    const etag = headerOf(discovered[0], ETAG) ?? '""';
    return [{ headers: [{ name: IF_MATCH, value: `W/${etag}` }] }];
  },
  judge(_discovered, probed) {
    return { verdict: probed[0]?.status === 412 ? Verdict.Pass : Verdict.Fail };
  },
});
