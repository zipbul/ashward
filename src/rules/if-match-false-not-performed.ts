import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { ETAG, IF_MATCH } from '../normative/header-names';
import { WILDCARD } from '../normative/literals';
import { ConditionalClauseId } from '../standards/catalog/conditional-request';
import { refsFor } from './kit/clause-refs';
import { defineConditionalRule, headerOf } from './kit/conditional-rule';

/**
 * C4 — §5.1.3 MUST NOT: on a GET whose `If-Match` names an entity-tag that cannot match the
 * discovered `ETag`, the method MUST NOT be performed. A literal, never-matching tag (`"no-match"`)
 * is the disqualifying probe; a second, differential probe carries `If-Match: *` — the STANDARD's own
 * contrast case (a current representation exists, so the wildcard legitimately evaluates true and the
 * method IS performed, 200) — so the judge (pass-2) can tell a server that ignores If-Match outright
 * apart from one that evaluates it correctly.
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
    const status = probed[0]?.status;
    if (status === 412) {
      return { verdict: Verdict.Pass };
    }
    if (status !== undefined && status >= 200 && status <= 299) {
      return { verdict: Verdict.Fail };
    }
    return { verdict: Verdict.Skip, reason: SkipReason.EndpointUnstable };
  },
});
