import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { CACHE_CONTROL, CONTENT_LOCATION, ETAG, EXPIRES, IF_NONE_MATCH, VARY } from '../normative/header-names';
import { ConditionalClauseId } from '../standards/catalog/conditional-request';
import { refsFor } from './kit/clause-refs';
import { defineConditionalRule, headerOf } from './kit/conditional-rule';

/** The §6.1.2 field set a 304 MUST carry whenever the discovered 200 sent it — `Date` is
 *  deliberately excluded (its own untestable clause, `not-modified-date-header`, PLAN §5). */
const REQUIRED_HEADERS: readonly string[] = [ETAG, CACHE_CONTROL, VARY, EXPIRES, CONTENT_LOCATION];

/**
 * C11 — §6.1.2 MUST: a 304 generated for a request that elicits one carries each of
 * `ETag`/`Cache-Control`/`Vary`/`Expires`/`Content-Location` that the discovered 200 sent. Couldn't
 * elicit a 304 at all → Skip(NotApplicable), not a false Fail on an unrelated non-304 outcome.
 */
export const notModifiedRequiredHeaders = defineConditionalRule({
  id: Rule.NotModifiedRequiredHeaders,
  normative: refsFor(ConditionalClauseId.NotModifiedRequiredHeaders),
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
    return [{ headers: [{ name: IF_NONE_MATCH, value: headerOf(discovered[0], ETAG) ?? '' }] }];
  },
  judge(discovered, probed) {
    const notModified = probed[0];
    if (notModified?.status !== 304) {
      return { verdict: Verdict.Skip, reason: SkipReason.NotApplicable };
    }
    const baseline = discovered[0];
    const missing = REQUIRED_HEADERS.some(name => headerOf(baseline, name) !== null && headerOf(notModified, name) === null);
    return { verdict: missing ? Verdict.Fail : Verdict.Pass };
  },
});

export { REQUIRED_HEADERS };
