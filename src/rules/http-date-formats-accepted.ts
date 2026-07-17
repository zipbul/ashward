import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { IF_MODIFIED_SINCE, LAST_MODIFIED } from '../normative/header-names';
import { formatAsctime, formatImfFixdate, formatRfc850, parseHttpDate, resolveRfc850Year } from '../normative/http-date';
import { ConditionalClauseId } from '../standards/catalog/conditional-request';
import { refsFor } from './kit/clause-refs';
import { defineConditionalRule, headerOf, lastModifiedValidatorGate } from './kit/conditional-rule';

/** True iff `instant`'s full year round-trips through RFC 9110 §5.6.7's rfc850 2-digit-year +
 *  50-year rule at `now` (via `resolveRfc850Year`, which compares the FULL candidate instant to
 *  `now + 50 years`, never year-only arithmetic) — i.e. a correct recipient parsing the RFC 850
 *  form C8 sends would resolve it back to the SAME year `instant` actually carries. An instant old
 *  enough to fall outside that window is not soundly probeable in RFC 850 form: a correct server
 *  legitimately resolving to a different century must never read as "rejected the format" (§1.4's
 *  own moving-boundary rule, PLAN §11/§13). */
function rfc850RoundTrips(instant: Date, now: Date): boolean {
  const twoDigitYear = ((instant.getUTCFullYear() % 100) + 100) % 100;
  const resolvedYear = resolveRfc850Year(
    twoDigitYear,
    instant.getUTCMonth(),
    instant.getUTCDate(),
    instant.getUTCHours(),
    instant.getUTCMinutes(),
    instant.getUTCSeconds(),
    now,
  );
  return resolvedYear === instant.getUTCFullYear();
}

/**
 * C8 — §1.3 MUST: a recipient parsing an HTTP-date timestamp accepts all three formats (IMF-fixdate,
 * RFC 850, asctime). Three conditional probes carry the SAME instant (the discovered `Last-Modified`)
 * in each format in turn — probe 0 is the IMF-fixdate baseline (the format every recipient MUST
 * already accept, per RFC 9112's own field grammar), probes 1-2 are the RFC 850 and asctime forms the
 * judge (pass-2) checks elicit the identical 304 outcome. The discovered instant must itself
 * round-trip through the RFC 850 2-digit-year + 50-year rule (see `rfc850RoundTrips`) — an instant
 * too old for that never soundly probes the RFC 850 limb, so it Skips(NotApplicable) rather than
 * false-Failing a server that correctly applies §5.6.7's own disambiguation.
 */
export const httpDateFormatsAccepted = defineConditionalRule({
  id: Rule.HttpDateFormatsAccepted,
  normative: refsFor(ConditionalClauseId.HttpDateFormatsAccepted),
  guard: 'validator',
  validatorHeaders: [LAST_MODIFIED],
  gate(discovered) {
    const shared = lastModifiedValidatorGate(discovered);
    if (shared !== null) {
      return shared;
    }
    // lastModifiedValidatorGate already confirmed a 200 baseline with a parseable Last-Modified.
    const lastModified = headerOf(discovered[0], LAST_MODIFIED)!;
    const time = parseHttpDate(lastModified)!;
    return rfc850RoundTrips(new Date(time), new Date()) ? null : SkipReason.NotApplicable;
  },
  build(discovered) {
    const lastModified = headerOf(discovered[0], LAST_MODIFIED);
    const time = lastModified === null ? null : parseHttpDate(lastModified);
    const instant = new Date(time!);
    return [
      { headers: [{ name: IF_MODIFIED_SINCE, value: formatImfFixdate(instant) }] },
      { headers: [{ name: IF_MODIFIED_SINCE, value: formatRfc850(instant) }] },
      { headers: [{ name: IF_MODIFIED_SINCE, value: formatAsctime(instant) }] },
    ];
  },
  judge(_discovered, probed) {
    const [imf, rfc850, asctime] = probed;
    if (imf?.status !== 304) {
      return { verdict: Verdict.Skip, reason: SkipReason.NotApplicable };
    }
    return { verdict: rfc850?.status === 304 && asctime?.status === 304 ? Verdict.Pass : Verdict.Fail };
  },
});
