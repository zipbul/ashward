import { Rule, Verdict } from '../core/contract/enums';
import { IF_UNMODIFIED_SINCE, LAST_MODIFIED } from '../normative/header-names';
import { addDays, formatImfFixdate, parseHttpDate } from '../normative/http-date';
import { ConditionalClauseId } from '../standards/catalog/conditional-request';
import { refsFor } from './kit/clause-refs';
import { defineConditionalRule, differentialJudge, headerOf, lastModifiedValidatorGate } from './kit/conditional-rule';

/**
 * C6 — §5.4.7 MUST NOT: on a GET whose `If-Unmodified-Since` is strictly earlier than the discovered
 * `Last-Modified`, the method MUST NOT be performed. Probe 0 subtracts one day (unambiguously
 * earlier) — the disqualifying case. Probe 1 sends the discovered date itself (`IUS == L`) — the
 * STANDARD's own contrast case: §5.4.6 evaluates "earlier or equal" as TRUE, so the method IS
 * performed (200), never a false Fail on the boundary-equal instant. The judge (pass-2) actually
 * CONSULTS both outcomes: it Passes only when the earlier-than-L date elicits 412 AND the equal-to-L
 * date elicits 2xx. A server that answers 412 unconditionally (ignoring the field's value entirely)
 * would otherwise false-Pass on probe 0 alone — that shape now Fails.
 */
export const ifUnmodifiedSinceFalseNotPerformed = defineConditionalRule({
  id: Rule.IfUnmodifiedSinceFalseNotPerformed,
  normative: refsFor(ConditionalClauseId.IfUnmodifiedSinceFalseNotPerformed),
  guard: 'validator',
  validatorHeaders: [LAST_MODIFIED],
  gate: lastModifiedValidatorGate,
  build(discovered) {
    const lastModified = headerOf(discovered[0], LAST_MODIFIED);
    const time = lastModified === null ? null : parseHttpDate(lastModified);
    const instant = new Date(time!);
    const earlier = formatImfFixdate(addDays(instant, -1));
    const equal = formatImfFixdate(instant);
    return [
      { headers: [{ name: IF_UNMODIFIED_SINCE, value: earlier }] },
      { headers: [{ name: IF_UNMODIFIED_SINCE, value: equal }] },
    ];
  },
  judge: (_discovered, probed) => differentialJudge({ trigger: 412, disqualify: Verdict.Fail }, probed),
});
