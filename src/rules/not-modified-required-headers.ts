import type { ConditionalExchange } from './kit/conditional-rule';

import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { fieldValues } from '../http/decode/fields';
import { CACHE_CONTROL, CONTENT_LOCATION, DATE, ETAG, EXPIRES, IF_NONE_MATCH, VARY } from '../normative/header-names';
import { ConditionalClauseId } from '../standards/catalog/conditional-request';
import { refsFor } from './kit/clause-refs';
import { defineConditionalRule, headerOf } from './kit/conditional-rule';

/** The §6.1.2 field set a 304 MUST carry whenever the discovered 200 sent it. `Date` is included
 *  (moved out of its former untestable residue, PLAN §2f round-8/round-9): its presence on a 304 is
 *  judged only when the discovered 200 itself sent it — an origin that never sends Date may simply
 *  be clockless (§6.6.1), which is not itself a fault. */
const REQUIRED_HEADERS: readonly string[] = [ETAG, CACHE_CONTROL, VARY, EXPIRES, CONTENT_LOCATION, DATE];

/** Whether `name` was sent at all on `exchange`'s head — REPEATED-field-aware (unlike `headerOf`/
 *  `singleFieldValue`, which collapses a repeated field to "absent"). A multi-line `Cache-Control`/
 *  `Vary` the discovered 200 sent must still count as "sent" for the required-header check; only
 *  `fieldValues`'s length tells presence apart from `singleFieldValue`'s ambiguous null. */
function wasSent(exchange: ConditionalExchange | undefined, name: string): boolean {
  return exchange !== undefined && fieldValues(exchange.head, name).length > 0;
}

/**
 * C11 — §6.1.2 MUST: a 304 generated for a request that elicits one carries each of
 * `ETag`/`Cache-Control`/`Vary`/`Expires`/`Content-Location`/`Date` that the discovered 200 sent.
 * Couldn't elicit a 304 at all → Skip(NotApplicable), not a false Fail on an unrelated non-304
 * outcome. Before this Fail stands, the kit's validator-guard RE-DISCOVER (keyed on `ETag`) confirms
 * the resource identity itself hasn't drifted underneath the probe.
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
    const missing = REQUIRED_HEADERS.some(name => wasSent(baseline, name) && !wasSent(notModified, name));
    return { verdict: missing ? Verdict.Fail : Verdict.Pass };
  },
});

export { REQUIRED_HEADERS };
