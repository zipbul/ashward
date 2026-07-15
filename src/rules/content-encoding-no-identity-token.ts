import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { CompressionClauseId } from '../standards/catalog/compression';
import { refsFor } from './kit/clause-refs';
import { contentEncodingTokens } from './kit/content-encoding';
import { defineResponseRule } from './kit/response-rule';

/**
 * §2.1 — `identity` is reserved for `Accept-Encoding` negotiation and SHOULD NOT be generated in a
 * `Content-Encoding` response header. A safe GET, judged on the response's Content-Encoding tokens
 * (folded across repeated field lines, RFC 9110 §5.3): an `identity` token → Warn; absent → Skip.
 */
export const contentEncodingNoIdentityToken = defineResponseRule({
  id: Rule.ContentEncodingNoIdentityToken,
  probes: [{ headers: [] }],
  normative: refsFor(CompressionClauseId.IdentityTokenExcluded),
  judge(exchanges) {
    const [exchange] = exchanges;
    if (exchange === undefined) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    const tokens = contentEncodingTokens(exchange.head);
    if (tokens.length === 0) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    const hasIdentity = tokens.some(token => token.toLowerCase() === 'identity');
    return hasIdentity ? { verdict: Verdict.Warn } : { verdict: Verdict.Pass };
  },
});
