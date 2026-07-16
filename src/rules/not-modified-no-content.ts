import { InconclusiveReason, Rule, SkipReason, Verdict } from '../core/contract/enums';
import { ETAG, IF_NONE_MATCH } from '../normative/header-names';
import { ConditionalClauseId } from '../standards/catalog/conditional-request';
import { refsFor } from './kit/clause-refs';
import { defineConditionalRule, headerOf } from './kit/conditional-rule';

/**
 * C12 — §6.1.4 Unmarked: a 304 response terminates at the header section — it MUST NOT carry
 * content. Elicit a 304 via the discovered `ETag`; an Unmarked clause never Fails (PLAN §0.1), so a
 * 304 that does carry content bytes is a Warn, not a Fail. A truncated body under a 304 must never
 * read as a false Pass, so the judge (pass-2) treats `!complete` as `Inconclusive(IncompleteMessage)`.
 */
export const notModifiedNoContent = defineConditionalRule({
  id: Rule.NotModifiedNoContent,
  normative: refsFor(ConditionalClauseId.NotModifiedNoContent),
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
    return [{ headers: [{ name: IF_NONE_MATCH, value: headerOf(discovered[0], ETAG)! }] }];
  },
  judge(_discovered, probed) {
    const notModified = probed[0];
    if (notModified?.status !== 304) {
      return { verdict: Verdict.Skip, reason: SkipReason.NotApplicable };
    }
    if (!notModified.complete) {
      return { verdict: Verdict.Inconclusive, reason: InconclusiveReason.IncompleteMessage };
    }
    return { verdict: notModified.content.length > 0 ? Verdict.Warn : Verdict.Pass };
  },
});
