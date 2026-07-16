import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { isStrongEtag } from '../normative/etag';
import { ETAG, IF_NONE_MATCH } from '../normative/header-names';
import { ConditionalClauseId } from '../standards/catalog/conditional-request';
import { refsFor } from './kit/clause-refs';
import { defineConditionalRule, headerOf } from './kit/conditional-rule';

/**
 * C3 — §2.4 MUST: `If-None-Match` comparison uses WEAK comparison, so a weak version of the
 * discovered strong `ETag` still matches. Needs a discovered STRONG `ETag` — a weak discovered ETag
 * makes "send a weak form of it" ill-posed for this rule, so it Skips(NotApplicable) rather than
 * Skip(NoValidator) (the validator exists, it's just already weak).
 */
export const ifNoneMatchWeakComparison = defineConditionalRule({
  id: Rule.IfNoneMatchWeakComparison,
  normative: refsFor(ConditionalClauseId.IfNoneMatchWeakComparison),
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
    const etag = headerOf(discovered[0], ETAG)!;
    return [{ headers: [{ name: IF_NONE_MATCH, value: `W/${etag}` }] }];
  },
  judge(_discovered, probed) {
    return { verdict: probed[0]?.status === 304 ? Verdict.Pass : Verdict.Fail };
  },
});
