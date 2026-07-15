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

/**
 * C8 — §1.3 MUST: a recipient parsing an HTTP-date timestamp accepts all three formats (IMF-fixdate,
 * RFC 850, asctime). Three conditional probes carry the SAME instant (the discovered `Last-Modified`)
 * in each format in turn — probe 0 is the IMF-fixdate baseline (the format every recipient MUST
 * already accept, per RFC 9112's own field grammar), probes 1-2 are the RFC 850 and asctime forms the
 * judge (pass-2) checks elicit the identical 304 outcome.
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
    if (lastModified === null || parsedTime(lastModified) === null) {
      return SkipReason.NoValidator;
    }
    return null;
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
