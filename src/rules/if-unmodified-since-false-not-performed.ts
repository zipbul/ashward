import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { IF_UNMODIFIED_SINCE, LAST_MODIFIED } from '../normative/header-names';
import { addDays, formatImfFixdate } from '../normative/http-date';
import { ConditionalClauseId } from '../standards/catalog/conditional-request';
import { refsFor } from './kit/clause-refs';
import { defineConditionalRule, headerOf } from './kit/conditional-rule';

function parsedTime(value: string): number | null {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * C6 — §5.4.7 MUST NOT: on a GET whose `If-Unmodified-Since` is strictly earlier than the discovered
 * `Last-Modified`, the method MUST NOT be performed. Probe 0 subtracts one day (unambiguously
 * earlier) — the disqualifying case. Probe 1 sends the discovered date itself (`IUS == L`) — the
 * STANDARD's own contrast case: §5.4.6 evaluates "earlier or equal" as TRUE, so the method IS
 * performed (200), never a false Fail on the boundary-equal instant.
 */
export const ifUnmodifiedSinceFalseNotPerformed = defineConditionalRule({
  id: Rule.IfUnmodifiedSinceFalseNotPerformed,
  normative: refsFor(ConditionalClauseId.IfUnmodifiedSinceFalseNotPerformed),
  guard: 'validator',
  validatorHeaders: [LAST_MODIFIED],
  gate(discovered) {
    const [baseline] = discovered;
    if (baseline?.status !== 200) {
      return SkipReason.NoValidator;
    }
    const lastModified = headerOf(baseline, LAST_MODIFIED);
    if (lastModified === null || parsedTime(lastModified) === null) {
      return SkipReason.NoValidator;
    }
    return null;
  },
  build(discovered) {
    const lastModified = headerOf(discovered[0], LAST_MODIFIED);
    const time = lastModified === null ? null : parsedTime(lastModified);
    const instant = new Date(time ?? 0);
    const earlier = formatImfFixdate(addDays(instant, -1));
    const equal = formatImfFixdate(instant);
    return [
      { headers: [{ name: IF_UNMODIFIED_SINCE, value: earlier }] },
      { headers: [{ name: IF_UNMODIFIED_SINCE, value: equal }] },
    ];
  },
  judge(_discovered, probed) {
    return { verdict: probed[0]?.status === 412 ? Verdict.Pass : Verdict.Fail };
  },
});
