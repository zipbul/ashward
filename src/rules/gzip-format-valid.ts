import { InconclusiveReason, Rule, SkipReason, Verdict } from '../core/contract/enums';
import { isWellFormedGzipHeader } from '../normative/gzip';
import { ACCEPT_ENCODING } from '../normative/header-names';
import { CompressionClauseId } from '../standards/catalog/compression';
import { refsFor } from './kit/clause-refs';
import { outermostCoding } from './kit/content-encoding';
import { defineResponseRule } from './kit/response-rule';

/**
 * §5.1 — `gzip`/`x-gzip` is the RFC 1952 gzip file format: a correct member header is
 * `ID1=0x1f ID2=0x8b CM=0x08` with the FLG reserved bits (5–7) zero. Judged only when `gzip`/
 * `x-gzip` is the OUTERMOST (last) `Content-Encoding` token — a stacked coding applied on top
 * (e.g. `gzip, br`) means these bytes are not a gzip member at all, so the format check does not
 * apply to them.
 */
export const gzipFormatValid = defineResponseRule({
  id: Rule.GzipFormatValid,
  probes: [{ headers: [{ name: ACCEPT_ENCODING, value: 'gzip' }] }],
  normative: refsFor(CompressionClauseId.GzipFormatValid),
  judge(exchanges) {
    const [exchange] = exchanges;
    if (exchange === undefined) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    const outermost = outermostCoding(exchange.head);
    if (outermost === null) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    const lower = outermost.toLowerCase();
    if (lower !== 'gzip' && lower !== 'x-gzip') {
      return { verdict: Verdict.Skip, reason: SkipReason.StackedCoding };
    }
    if (!exchange.complete) {
      return { verdict: Verdict.Inconclusive, reason: InconclusiveReason.IncompleteMessage };
    }
    return isWellFormedGzipHeader(exchange.content) ? { verdict: Verdict.Pass } : { verdict: Verdict.Warn };
  },
});
