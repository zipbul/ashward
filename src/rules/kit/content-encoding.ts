import type { ResponseHead } from '../../http/decode/interfaces';
import type { Judgment, ResponseExchange } from './response-rule';

import { InconclusiveReason, SkipReason, Verdict } from '../../core/contract/enums';
import { fieldValues } from '../../http/decode/fields';
import { splitFieldList } from '../../normative/field-list';
import { CONTENT_ENCODING } from '../../normative/header-names';

/** The last (outermost-applied) content-coding token, or null when `Content-Encoding` is absent. */
function outermostCoding(head: ResponseHead): string | null {
  const tokens = contentEncodingTokens(head);
  return tokens.length === 0 ? null : (tokens[tokens.length - 1] ?? null);
}

/** `Content-Encoding`'s content-coding tokens, in applied order (RFC 9110 §8.4), folded across
 *  repeated field lines (RFC 9110 §5.3) and split on the `#`-list comma (RFC 9110 §5.6.1). Empty
 *  when the field is absent — a rule reading this never has to special-case "no field" itself. */
export function contentEncodingTokens(head: ResponseHead): readonly string[] {
  return fieldValues(head, CONTENT_ENCODING).flatMap(value => splitFieldList(value));
}

/** True when the response carries a real (non-`identity`) content coding — i.e. is actually
 *  compressed, as opposed to merely carrying an empty or `identity`-only `Content-Encoding`. */
export function isCompressed(head: ResponseHead): boolean {
  return contentEncodingTokens(head).some(token => token.toLowerCase() !== 'identity');
}

/** The verdict spine every outermost-coding byte-format rule (gzip/deflate/zstd-window/
 *  zstd-reserved-bits) opens its judge with: Skip(HeaderAbsent) when there is no exchange or no
 *  `Content-Encoding` at all, Skip(StackedCoding) when the outermost (last) token is not one of the
 *  rule's `acceptedCodings` (matched case-insensitively — a stacked coding on top means these bytes
 *  are not that format's member/stream at all), Inconclusive(IncompleteMessage) when the body did
 *  not finish — otherwise the decoded content for the caller's own format predicate, so each rule's
 *  judge is left with just that. */
export function gateOutermostCoding(
  exchanges: readonly ResponseExchange[],
  acceptedCodings: readonly string[],
): { readonly content: Uint8Array } | Judgment {
  const [exchange] = exchanges;
  if (exchange === undefined) {
    return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
  }
  const outermost = outermostCoding(exchange.head);
  if (outermost === null) {
    return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
  }
  if (!acceptedCodings.includes(outermost.toLowerCase())) {
    return { verdict: Verdict.Skip, reason: SkipReason.StackedCoding };
  }
  if (!exchange.complete) {
    return { verdict: Verdict.Inconclusive, reason: InconclusiveReason.IncompleteMessage };
  }
  return { content: exchange.content };
}

/** The `acceptedCodings` every zstd byte-format rule (window-cap, reserved-bits) gates on — shared
 *  so both agree on exactly what counts as "the outermost coding is zstd". */
export const ACCEPTED_ZSTD_CODINGS = ['zstd'];
