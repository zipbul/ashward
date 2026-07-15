import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { ETAG, IF_NONE_MATCH } from '../normative/header-names';
import { ConditionalClauseId } from '../standards/catalog/conditional-request';
import { refsFor } from './kit/clause-refs';
import { defineConditionalRule, headerOf } from './kit/conditional-rule';

/**
 * C1 — §5.2.4 MUST: on a GET whose `If-None-Match` names the discovered `ETag`, the request MUST be
 * answered 304 (Not Modified) rather than performed. A second, differential probe carries a literal
 * never-matching tag (`"no-match"`) — the STANDARD's own contrast case (a genuinely non-matching
 * condition legitimately evaluates true, so the method IS performed, 200) — so the judge (pass-2) can
 * tell "the server ignores If-None-Match entirely" (both probes 200) apart from "the server correctly
 * matches" (probe 0 → 304, probe 1 → 200). Discover a safe GET baseline; Skip(NoValidator) when it is
 * not a 200 with an `ETag`.
 */
export const ifNoneMatchNotModified = defineConditionalRule({
  id: Rule.IfNoneMatchNotModified,
  normative: refsFor(ConditionalClauseId.IfNoneMatchFalseResponse),
  guard: 'validator',
  validatorHeaders: [ETAG],
  gate(discovered) {
    const [baseline] = discovered;
    if (baseline?.status !== 200) {
      return SkipReason.NoValidator;
    }
    return headerOf(baseline, ETAG) === null ? SkipReason.NoValidator : null;
  },
  build(discovered) {
    const etag = headerOf(discovered[0], ETAG) ?? '';
    return [{ headers: [{ name: IF_NONE_MATCH, value: etag }] }, { headers: [{ name: IF_NONE_MATCH, value: '"no-match"' }] }];
  },
  judge(_discovered, probed) {
    const real = probed[0];
    return { verdict: real?.status === 304 ? Verdict.Pass : Verdict.Fail };
  },
});
