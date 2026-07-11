import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { singleFieldValue } from '../http/decode/fields';
import { LOCATION } from '../normative/header-names';
import { FetchClauseId } from '../standards/catalog/fetch';
import { refsFor } from './kit/clause-refs';
import { defineHttpResponseRule } from './kit/http-response-rule';
import { PROBE_ORIGIN } from './kit/probe-fixtures';

/** The authority component of an absolute URL (`scheme://<authority>` up to the first /, ?, or #). */
const AUTHORITY = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i;

/** True when an absolute Location URL carries userinfo (`user[:pass]@host`); `@` cannot legally
 *  appear in an authority except as the userinfo delimiter. A relative Location has no authority. */
function locationHasUserinfo(location: string): boolean {
  const match = AUTHORITY.exec(location);
  return match?.[1] !== undefined && match[1].includes('@');
}

function isRedirect(statusCode: number): boolean {
  return statusCode >= 300 && statusCode <= 399;
}

/**
 * §5.1 — a 3xx response to a CORS request must not put credentials (userinfo) in its `Location` URL;
 * such a redirect is a network error. Judged only when the response is a redirect with a Location
 * (Skip otherwise).
 */
export const locationRedirectNoUserinfo = defineHttpResponseRule({
  id: Rule.LocationRedirectNoUserinfo,
  probes: [{ origin: PROBE_ORIGIN }],
  normative: refsFor(FetchClauseId.RedirectLocationNoUserinfo),
  judge(heads) {
    const [head] = heads;
    if (head === undefined) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    if (!isRedirect(head.statusLine.statusCode)) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    const location = singleFieldValue(head, LOCATION);
    if (location === null) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    return locationHasUserinfo(location) ? { verdict: Verdict.Fail } : { verdict: Verdict.Pass };
  },
});
