import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { ETAG, IF_MODIFIED_SINCE, IF_NONE_MATCH, LAST_MODIFIED } from '../normative/header-names';
import { ConditionalClauseId } from '../standards/catalog/conditional-request';
import { refsFor } from './kit/clause-refs';
import { defineConditionalRule, headerOf } from './kit/conditional-rule';

/**
 * C9 — §4.2 MUST: `If-Modified-Since` is ignored when `If-None-Match` is present. The probe pairs a
 * never-matching `If-None-Match` (which alone would 200) with the discovered `If-Modified-Since`
 * value (which alone would 304) — a 304 outcome would mean the origin evaluated the ignored field.
 * Needs both a discovered `ETag` and `Last-Modified`.
 */
export const precedenceIfNoneMatchOverIfModifiedSince = defineConditionalRule({
  id: Rule.PrecedenceIfNoneMatchOverIfModifiedSince,
  normative: refsFor(ConditionalClauseId.PrecedenceIfNoneMatchOverIfModifiedSince),
  guard: 'validator',
  validatorHeaders: [ETAG, LAST_MODIFIED],
  gate(discovered) {
    const [baseline] = discovered;
    if (baseline?.status !== 200) {
      return SkipReason.NoValidator;
    }
    if (headerOf(baseline, ETAG) === null || headerOf(baseline, LAST_MODIFIED) === null) {
      return SkipReason.NoValidator;
    }
    return null;
  },
  build(discovered) {
    return [
      {
        headers: [
          { name: IF_NONE_MATCH, value: '"no-match"' },
          { name: IF_MODIFIED_SINCE, value: headerOf(discovered[0], LAST_MODIFIED)! },
        ],
      },
    ];
  },
  judge(_discovered, probed) {
    return { verdict: probed[0]?.status === 200 ? Verdict.Pass : Verdict.Fail };
  },
});
