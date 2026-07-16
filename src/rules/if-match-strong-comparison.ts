import { Rule, Verdict } from '../core/contract/enums';
import { ETAG, IF_MATCH } from '../normative/header-names';
import { ConditionalClauseId } from '../standards/catalog/conditional-request';
import { refsFor } from './kit/clause-refs';
import { defineConditionalRule, headerOf, strongEtagValidatorGate } from './kit/conditional-rule';

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
  gate: strongEtagValidatorGate,
  build(discovered) {
    const etag = headerOf(discovered[0], ETAG)!;
    return [{ headers: [{ name: IF_MATCH, value: `W/${etag}` }] }];
  },
  judge(_discovered, probed) {
    return { verdict: probed[0]?.status === 412 ? Verdict.Pass : Verdict.Fail };
  },
});
