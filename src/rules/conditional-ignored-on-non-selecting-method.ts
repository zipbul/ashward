import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { IF_NONE_MATCH } from '../normative/header-names';
import { WILDCARD } from '../normative/literals';
import { ConditionalClauseId } from '../standards/catalog/conditional-request';
import { refsFor } from './kit/clause-refs';
import { defineConditionalRule } from './kit/conditional-rule';

/** Neither a 304 nor a 412 — the "conditional headers were evaluated" shape this rule watches for. */
function isNotPreconditionShaped(status: number): boolean {
  return status !== 304 && status !== 412;
}

/**
 * C13 — §3.3 MUST: a request with a method that does not select/modify a representation (of
 * ashward's three supported safe methods — GET, HEAD, OPTIONS — OPTIONS is the only example) ignores
 * any conditional header it carries. Custom discover: two bare `OPTIONS` probes must agree on a
 * status that is itself not precondition-shaped (304/412) — that is the existence guard's
 * baseline-agreement check (PLAN §2f). The conditional probe then adds `If-None-Match: *`; the judge
 * (pass-2) tentatively Passes iff the status is unchanged and tentatively Fails on 304/412 — the
 * kit's existence-guard RE-DISCOVER (PLAN §2f step 4) then re-sends both bare `OPTIONS` probes and
 * only lets that Fail stand if the baseline status is re-confirmed; a drift downgrades to
 * `Skip(EndpointUnstable)`.
 */
export const conditionalIgnoredOnNonSelectingMethod = defineConditionalRule({
  id: Rule.ConditionalIgnoredOnNonSelectingMethod,
  normative: refsFor(ConditionalClauseId.ConditionalIgnoredOnNonSelectingMethod),
  guard: 'existence',
  discoverProbes: [
    { method: 'OPTIONS', headers: [] },
    { method: 'OPTIONS', headers: [] },
  ],
  expectedBaselineStatus: isNotPreconditionShaped,
  gate() {
    return null;
  },
  build() {
    return [{ method: 'OPTIONS', headers: [{ name: IF_NONE_MATCH, value: WILDCARD }] }];
  },
  judge(discovered, probed) {
    const baseline = discovered[0]?.status;
    const outcome = probed[0]?.status;
    if (outcome === baseline) {
      return { verdict: Verdict.Pass };
    }
    if (outcome === 304 || outcome === 412) {
      return { verdict: Verdict.Fail };
    }
    return { verdict: Verdict.Skip, reason: SkipReason.EndpointUnstable };
  },
});
