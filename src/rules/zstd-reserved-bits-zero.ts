import { InconclusiveReason, Rule, SkipReason, Verdict } from '../core/contract/enums';
import { ACCEPT_ENCODING } from '../normative/header-names';
import { zstdReservedBitsZero as parseZstdReservedBitsZero } from '../normative/zstd';
import { CompressionClauseId } from '../standards/catalog/compression';
import { refsFor } from './kit/clause-refs';
import { outermostCoding } from './kit/content-encoding';
import { defineResponseRule } from './kit/response-rule';

/**
 * §5.4 — a zstd Frame_Header_Descriptor's Unused bit and Reserved bit (RFC 8878
 * §3.1.1.1.1.3/§3.1.1.1.1.4) must be zero. Judged only when `zstd` is the OUTERMOST (last)
 * `Content-Encoding` token; a distinct clause id from the window MUST NOT rule (`zstd-window-
 * within-http-cap`) — this is the §5.4 Unmarked reserved-bits limb.
 */
export const zstdReservedBitsZero = defineResponseRule({
  id: Rule.ZstdReservedBitsZero,
  probes: [{ headers: [{ name: ACCEPT_ENCODING, value: 'zstd' }] }],
  normative: refsFor(CompressionClauseId.ZstdReservedBitsZero),
  judge(exchanges) {
    const [exchange] = exchanges;
    if (exchange === undefined) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    const outermost = outermostCoding(exchange.head);
    if (outermost === null) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    if (outermost.toLowerCase() !== 'zstd') {
      return { verdict: Verdict.Skip, reason: SkipReason.StackedCoding };
    }
    if (!exchange.complete) {
      return { verdict: Verdict.Inconclusive, reason: InconclusiveReason.IncompleteMessage };
    }
    const reservedZero = parseZstdReservedBitsZero(exchange.content);
    if (reservedZero === null) {
      return { verdict: Verdict.Skip, reason: SkipReason.OutOfScope };
    }
    return reservedZero ? { verdict: Verdict.Pass } : { verdict: Verdict.Warn };
  },
});
