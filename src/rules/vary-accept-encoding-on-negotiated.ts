import type { ResponseHead } from '../http/decode/interfaces';

import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { fieldValues } from '../http/decode/fields';
import { ACCEPT_ENCODING, CACHE_CONTROL, VARY } from '../normative/header-names';
import { WILDCARD } from '../normative/literals';
import { CompressionClauseId } from '../standards/catalog/compression';
import { refsFor } from './kit/clause-refs';
import { isCompressed } from './kit/content-encoding';
import { defineResponseRule } from './kit/response-rule';

/** True when the response's Vary field names Accept-Encoding (case-insensitive) or `*`. */
function varyHasAcceptEncoding(head: ResponseHead): boolean {
  for (const value of fieldValues(head, VARY)) {
    for (const element of value.split(',')) {
      const token = element.trim().toLowerCase();
      if (token === 'accept-encoding' || token === WILDCARD) {
        return true;
      }
    }
  }
  return false;
}

/** True when the response carries a `Cache-Control: no-store` directive (case-insensitive). */
function hasNoStore(head: ResponseHead): boolean {
  return fieldValues(head, CACHE_CONTROL).some(value =>
    value.split(',').some(element => element.trim().toLowerCase() === 'no-store'),
  );
}

function isServerError(head: ResponseHead): boolean {
  return head.statusLine.statusCode >= 500 && head.statusLine.statusCode <= 599;
}

/**
 * §4.1 — a resource negotiated by `Accept-Encoding` SHOULD carry `Vary: Accept-Encoding` on a
 * cacheable response, including its identity (uncompressed) choice — else a shared cache reuses
 * the wrong representation for a later request. Two probes at the same path: A `Accept-Encoding:
 * gzip`, B `Accept-Encoding: identity`. Real negotiation is confirmed by A being compressed and B
 * NOT being compressed; only then is the missing-Vary Warn judged.
 */
export const varyAcceptEncodingOnNegotiated = defineResponseRule({
  id: Rule.VaryAcceptEncodingOnNegotiated,
  probes: [{ headers: [{ name: ACCEPT_ENCODING, value: 'gzip' }] }, { headers: [{ name: ACCEPT_ENCODING, value: 'identity' }] }],
  normative: refsFor(CompressionClauseId.VaryAcceptEncodingOnNegotiated),
  judge(exchanges) {
    const [a, b] = exchanges;
    if (a === undefined || b === undefined) {
      return { verdict: Verdict.Skip, reason: SkipReason.NotNegotiated };
    }
    if (isServerError(b.head)) {
      return { verdict: Verdict.Skip, reason: SkipReason.EndpointUnstable };
    }
    if (hasNoStore(a.head) || hasNoStore(b.head)) {
      return { verdict: Verdict.Skip, reason: SkipReason.NotCacheable };
    }
    const aCompressed = isCompressed(a.head);
    const bCompressed = isCompressed(b.head);
    if (!aCompressed && !bCompressed) {
      return { verdict: Verdict.Skip, reason: SkipReason.NotNegotiated };
    }
    if (bCompressed) {
      return { verdict: Verdict.Skip, reason: SkipReason.NotNegotiated };
    }
    const missingVary = !varyHasAcceptEncoding(a.head) || !varyHasAcceptEncoding(b.head);
    return missingVary ? { verdict: Verdict.Warn } : { verdict: Verdict.Pass };
  },
});
