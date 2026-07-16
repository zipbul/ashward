import { Rule, Verdict } from '../core/contract/enums';
import { IF_MODIFIED_SINCE, LAST_MODIFIED } from '../normative/header-names';
import { formatImfFixdate } from '../normative/http-date';
import { ConditionalClauseId } from '../standards/catalog/conditional-request';
import { refsFor } from './kit/clause-refs';
import { defineConditionalRule, differentialJudge, headerOf, lastModifiedValidatorGate } from './kit/conditional-rule';

/** Epoch — unambiguously far enough in the past that any real `Last-Modified` is later than it. */
const FAR_PAST = new Date(0);

/**
 * C7 — §5.3.7 SHOULD: on a GET whose `If-Modified-Since` equals the discovered `Last-Modified`
 * verbatim, the origin SHOULD respond 304 (the date is not later than the resource's own
 * modification date, so the condition evaluates false). Probe 1 sends a far-past date — the
 * STANDARD's own contrast case: the resource's modification date IS later than a far-past field date,
 * so §5.3.6 evaluates true and the method IS performed (200), never a false Warn on an obviously-
 * modified-since instant. The judge (pass-2) actually CONSULTS both outcomes: it Passes only when
 * `IMS == L` elicits 304 AND the far-past date elicits 2xx. A server that answers 304 unconditionally
 * (ignoring the field's value entirely) would otherwise false-Pass on probe 0 alone — that shape now
 * Warns. SHOULD → the rule's own disqualifying severity is Warn, never Fail (PLAN §0.1). Like C6/C8,
 * the discovered `Last-Modified` must itself parse as a valid HTTP-date — a malformed value never
 * qualifies as a validator (Skip(NoValidator)), matching §1.3/§1.4's own parse requirement.
 */
export const ifModifiedSinceNotModified = defineConditionalRule({
  id: Rule.IfModifiedSinceNotModified,
  normative: refsFor(ConditionalClauseId.IfModifiedSinceNotModified),
  guard: 'validator',
  validatorHeaders: [LAST_MODIFIED],
  gate: lastModifiedValidatorGate,
  build(discovered) {
    const lastModified = headerOf(discovered[0], LAST_MODIFIED)!;
    return [
      { headers: [{ name: IF_MODIFIED_SINCE, value: lastModified }] },
      { headers: [{ name: IF_MODIFIED_SINCE, value: formatImfFixdate(FAR_PAST) }] },
    ];
  },
  judge: (_discovered, probed) => differentialJudge({ trigger: 304, disqualify: Verdict.Warn }, probed),
});
