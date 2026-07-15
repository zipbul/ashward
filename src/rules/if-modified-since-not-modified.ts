import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { IF_MODIFIED_SINCE, LAST_MODIFIED } from '../normative/header-names';
import { formatImfFixdate } from '../normative/http-date';
import { ConditionalClauseId } from '../standards/catalog/conditional-request';
import { refsFor } from './kit/clause-refs';
import { defineConditionalRule, headerOf } from './kit/conditional-rule';

/** Epoch — unambiguously far enough in the past that any real `Last-Modified` is later than it. */
const FAR_PAST = new Date(0);

/**
 * C7 — §5.3.7 SHOULD: on a GET whose `If-Modified-Since` equals the discovered `Last-Modified`
 * verbatim, the origin SHOULD respond 304 (the date is not later than the resource's own
 * modification date, so the condition evaluates false). Probe 1 sends a far-past date — the
 * STANDARD's own contrast case: the resource's modification date IS later than a far-past field date,
 * so §5.3.6 evaluates true and the method IS performed (200), never a false Warn on an obviously-
 * modified-since instant. SHOULD → the rule's own severity is Warn, never Fail (PLAN §0.1).
 */
export const ifModifiedSinceNotModified = defineConditionalRule({
  id: Rule.IfModifiedSinceNotModified,
  normative: refsFor(ConditionalClauseId.IfModifiedSinceNotModified),
  guard: 'validator',
  validatorHeaders: [LAST_MODIFIED],
  gate(discovered) {
    const [baseline] = discovered;
    if (baseline?.status !== 200) {
      return SkipReason.NoValidator;
    }
    return headerOf(baseline, LAST_MODIFIED) === null ? SkipReason.NoValidator : null;
  },
  build(discovered) {
    const lastModified = headerOf(discovered[0], LAST_MODIFIED) ?? '';
    return [
      { headers: [{ name: IF_MODIFIED_SINCE, value: lastModified }] },
      { headers: [{ name: IF_MODIFIED_SINCE, value: formatImfFixdate(FAR_PAST) }] },
    ];
  },
  judge(_discovered, probed) {
    return { verdict: probed[0]?.status === 304 ? Verdict.Pass : Verdict.Warn };
  },
});
