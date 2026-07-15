import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { IF_MODIFIED_SINCE, LAST_MODIFIED } from '../normative/header-names';
import { formatAsctime, formatImfFixdate, formatRfc850 } from '../normative/http-date';
import { ConditionalClauseId } from '../standards/catalog/conditional-request';
import { refsFor } from './kit/clause-refs';
import { defineConditionalRule, headerOf } from './kit/conditional-rule';

function parsedTime(value: string): number | null {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

/** RFC 9110 §5.6.7's own 50-year disambiguation rule, applied against `nowYear`: the recipient
 *  resolves a 2-digit rfc850 year to whichever candidate century keeps it from reading as more than
 *  50 years in `nowYear`'s future — the SAME rule a correct SUT applies against ITS OWN clock when it
 *  parses the RFC 850 probe C8 sends. */
function rfc850ResolvedYear(twoDigitYear: number, nowYear: number): number {
  const century = Math.floor(nowYear / 100) * 100;
  const naive = century + twoDigitYear;
  return naive > nowYear + 50 ? naive - 100 : naive;
}

/** True iff `instant`'s full year round-trips through the rfc850 2-digit-year + 50-year rule at
 *  `now` — i.e. a correct recipient parsing the RFC 850 form C8 sends would resolve it back to the
 *  SAME year `instant` actually carries. An instant old enough to fall outside that window is not
 *  soundly probeable in RFC 850 form: a correct server legitimately resolving to a different century
 *  must never read as "rejected the format" (§1.4's own moving-boundary rule, PLAN §11/§13). */
function rfc850RoundTrips(instant: Date, now: Date): boolean {
  const twoDigitYear = ((instant.getUTCFullYear() % 100) + 100) % 100;
  return rfc850ResolvedYear(twoDigitYear, now.getUTCFullYear()) === instant.getUTCFullYear();
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
    const [baseline] = discovered;
    if (baseline?.status !== 200) {
      return SkipReason.NoValidator;
    }
    const lastModified = headerOf(baseline, LAST_MODIFIED);
    if (lastModified === null) {
      return SkipReason.NoValidator;
    }
    const time = parsedTime(lastModified);
    if (time === null) {
      return SkipReason.NoValidator;
    }
    return rfc850RoundTrips(new Date(time), new Date()) ? null : SkipReason.NotApplicable;
  },
  build(discovered) {
    const lastModified = headerOf(discovered[0], LAST_MODIFIED);
    const time = lastModified === null ? null : parsedTime(lastModified);
    const instant = new Date(time ?? 0);
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
