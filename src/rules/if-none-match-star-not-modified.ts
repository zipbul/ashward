import { Rule, Verdict } from '../core/contract/enums';
import { IF_NONE_MATCH } from '../normative/header-names';
import { WILDCARD } from '../normative/literals';
import { ConditionalClauseId } from '../standards/catalog/conditional-request';
import { refsFor } from './kit/clause-refs';
import { defineConditionalRule } from './kit/conditional-rule';

/**
 * C2 — §5.2.4 MUST (existence guard): on a GET carrying `If-None-Match: *`, when the origin has a
 * current representation the request MUST be answered 304. The existence guard takes two safe GET
 * baselines that must agree on a stable present-200 status before proceeding (PLAN §2f) — a resource
 * that isn't stably present-200 makes "the origin has a current representation" itself unconfirmed.
 */
export const ifNoneMatchStarNotModified = defineConditionalRule({
  id: Rule.IfNoneMatchStarNotModified,
  normative: refsFor(ConditionalClauseId.IfNoneMatchFalseResponse),
  guard: 'existence',
  discoverProbes: [{ headers: [] }, { headers: [] }],
  expectedBaselineStatus: status => status === 200,
  build() {
    return [{ headers: [{ name: IF_NONE_MATCH, value: WILDCARD }] }];
  },
  judge(_discovered, probed) {
    return { verdict: probed[0]?.status === 304 ? Verdict.Pass : Verdict.Fail };
  },
});
