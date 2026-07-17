import { Rule, Verdict } from '../core/contract/enums';
import { ETAG, IF_NONE_MATCH } from '../normative/header-names';
import { ConditionalClauseId } from '../standards/catalog/conditional-request';
import { refsFor } from './kit/clause-refs';
import { defineConditionalRule, differentialJudge, etagValidatorGate, headerOf } from './kit/conditional-rule';

/**
 * C1 — §5.2.4 MUST: on a GET whose `If-None-Match` names the discovered `ETag`, the request MUST be
 * answered 304 (Not Modified) rather than performed. A second, differential probe carries a literal
 * never-matching tag (`"no-match"`) — the STANDARD's own contrast case (a genuinely non-matching
 * condition legitimately evaluates true, so the method IS performed, 200) — so the judge (pass-2)
 * actually CONSULTS both outcomes: it Passes only when the matching tag elicits 304 AND the
 * non-matching tag elicits 2xx. A server that answers 304 unconditionally (ignoring the tag's value
 * entirely) would otherwise false-Pass on probe 0 alone — that shape now Fails. Discover a safe GET
 * baseline; Skip(NoValidator) when it is not a 200 with an `ETag`.
 */
export const ifNoneMatchNotModified = defineConditionalRule({
  id: Rule.IfNoneMatchNotModified,
  normative: refsFor(ConditionalClauseId.IfNoneMatchFalseResponse),
  guard: 'validator',
  validatorHeaders: [ETAG],
  gate: etagValidatorGate,
  build(discovered) {
    const etag = headerOf(discovered[0], ETAG)!;
    return [{ headers: [{ name: IF_NONE_MATCH, value: etag }] }, { headers: [{ name: IF_NONE_MATCH, value: '"no-match"' }] }];
  },
  judge: (_discovered, probed) => differentialJudge({ trigger: 304, disqualify: Verdict.Fail }, probed),
});
