/** Strip only SP (0x20) and HTAB (0x09) — the RFC 9110 §5.6.3 OWS set — from both ends of `value`.
 *  NOT JS `.trim()`, which also eats VT, FF, CR, LF, NBSP, and other Unicode whitespace: silently
 *  accepting one of those as if it were OWS could hide a byte-exact conformance violation (e.g. a
 *  leading U+00A0 a strict parser must reject) or misrecover a length from framing bytes a strict
 *  parser rejects — a parser-differential (request-smuggling) risk either way. */
export function trimOws(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && (value[start] === ' ' || value[start] === '\t')) {
    start += 1;
  }
  while (end > start && (value[end - 1] === ' ' || value[end - 1] === '\t')) {
    end -= 1;
  }
  return value.slice(start, end);
}
