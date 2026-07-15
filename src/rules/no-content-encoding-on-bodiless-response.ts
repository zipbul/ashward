import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { CompressionClauseId } from '../standards/catalog/compression';
import { refsFor } from './kit/clause-refs';
import { contentEncodingTokens } from './kit/content-encoding';
import { defineResponseRule } from './kit/response-rule';

/**
 * §3.1 — 204/205 responses carry no content, so a `Content-Encoding` on one is a self-contradiction
 * (there is nothing to have coded). A safe GET, judged by status: 204/205 with a real coding token
 * → Warn; 204/205 with none → Pass; 304/200/206 → Skip(NotApplicable) — the clause only speaks to
 * the bodiless statuses.
 */
export const noContentEncodingOnBodilessResponse = defineResponseRule({
  id: Rule.NoContentEncodingOnBodilessResponse,
  probes: [{ headers: [] }],
  normative: refsFor(CompressionClauseId.NoContentOnBodilessResponse),
  judge(exchanges) {
    const [exchange] = exchanges;
    if (exchange === undefined) {
      return { verdict: Verdict.Skip, reason: SkipReason.NotApplicable };
    }
    const { statusCode } = exchange.head.statusLine;
    if (statusCode !== 204 && statusCode !== 205) {
      return { verdict: Verdict.Skip, reason: SkipReason.NotApplicable };
    }
    const tokens = contentEncodingTokens(exchange.head);
    return tokens.length > 0 ? { verdict: Verdict.Warn } : { verdict: Verdict.Pass };
  },
});
