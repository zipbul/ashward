import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { IF_MATCH, IF_UNMODIFIED_SINCE, LAST_MODIFIED } from '../normative/header-names';
import { addDays, formatImfFixdate, parseHttpDate } from '../normative/http-date';
import { WILDCARD } from '../normative/literals';
import { ConditionalClauseId } from '../standards/catalog/conditional-request';
import { refsFor } from './kit/clause-refs';
import { defineConditionalRule, headerOf } from './kit/conditional-rule';

/**
 * C10 — §4.3 MUST: `If-Unmodified-Since` is ignored when `If-Match` is present. The probe pairs
 * `If-Match: *` (which alone would 200, since the origin has a current representation) with an
 * `If-Unmodified-Since` one day before the discovered `Last-Modified` (which alone would 412) — a
 * 412 outcome would mean the origin evaluated the ignored field.
 */
export const precedenceIfMatchOverIfUnmodifiedSince = defineConditionalRule({
  id: Rule.PrecedenceIfMatchOverIfUnmodifiedSince,
  normative: refsFor(ConditionalClauseId.PrecedenceIfMatchOverIfUnmodifiedSince),
  guard: 'validator',
  validatorHeaders: [LAST_MODIFIED],
  gate(discovered) {
    const [baseline] = discovered;
    if (baseline?.status !== 200) {
      return SkipReason.NoValidator;
    }
    const lastModified = headerOf(baseline, LAST_MODIFIED);
    if (lastModified === null || parseHttpDate(lastModified) === null) {
      return SkipReason.NoValidator;
    }
    return null;
  },
  build(discovered) {
    const lastModified = headerOf(discovered[0], LAST_MODIFIED);
    const time = lastModified === null ? null : parseHttpDate(lastModified);
    const earlier = formatImfFixdate(addDays(new Date(time ?? 0), -1));
    return [
      {
        headers: [
          { name: IF_MATCH, value: WILDCARD },
          { name: IF_UNMODIFIED_SINCE, value: earlier },
        ],
      },
    ];
  },
  judge(_discovered, probed) {
    return { verdict: probed[0]?.status === 200 ? Verdict.Pass : Verdict.Fail };
  },
});
