/**
 * The `application/x-www-form-urlencoded` parser (WHATWG URL §5) and the RFC 3986 §3.4 generic
 * URI query, as pure oracles: split on literal `&` only, skip empty sequences, split each
 * sequence on the FIRST literal `=` only (no `=` → empty-string value), percent-decode with a
 * malformed `%` sequence preserved literally (never consumed), then UTF-8 decode the resulting
 * byte sequence with U+FFFD substitution for invalid sequences (never throws). The two functions
 * differ ONLY in whether `+` is substituted for space — and that substitution happens on the RAW
 * bytes, before percent-decoding, exactly mirroring the WHATWG algorithm's ordering.
 */

const AMPERSAND = 0x26;
const EQUALS = 0x3d;
const PLUS = 0x2b;
const SPACE = 0x20;
const PERCENT = 0x25;

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: false });

function isHexDigit(byte: number): boolean {
  return (byte >= 0x30 && byte <= 0x39) || (byte >= 0x41 && byte <= 0x46) || (byte >= 0x61 && byte <= 0x66);
}

function hexValue(byte: number): number {
  if (byte >= 0x30 && byte <= 0x39) {
    return byte - 0x30;
  }
  if (byte >= 0x41 && byte <= 0x46) {
    return byte - 0x41 + 10;
  }
  return byte - 0x61 + 10;
}

/** Percent-decode a byte sequence: `%XX` with two hex digits becomes the decoded byte; any other
 *  `%` (end of input, or not followed by two hex digits) is kept as a literal `%` byte, and
 *  parsing resumes at the very next byte — the malformed escape is never "eaten". */
function percentDecode(bytes: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < bytes.length) {
    const byte = bytes[i]!;
    if (byte === PERCENT && i + 2 < bytes.length && isHexDigit(bytes[i + 1]!) && isHexDigit(bytes[i + 2]!)) {
      out.push(hexValue(bytes[i + 1]!) * 16 + hexValue(bytes[i + 2]!));
      i += 3;
    } else {
      out.push(byte);
      i += 1;
    }
  }
  return Uint8Array.from(out);
}

/** `+` (0x2B) → space (0x20), byte-for-byte — applied BEFORE percent-decoding. */
function replacePlusWithSpace(bytes: Uint8Array): Uint8Array {
  const out = bytes.slice();
  for (let i = 0; i < out.length; i += 1) {
    if (out[i] === PLUS) {
      out[i] = SPACE;
    }
  }
  return out;
}

function decodeSegment(bytes: Uint8Array, plusAsSpace: boolean): string {
  const substituted = plusAsSpace ? replacePlusWithSpace(bytes) : bytes;
  return decoder.decode(percentDecode(substituted));
}

function parseQuery(rawQuery: string, plusAsSpace: boolean): [string, string][] {
  const bytes = encoder.encode(rawQuery);
  const pairs: [string, string][] = [];
  let start = 0;

  for (let i = 0; i <= bytes.length; i += 1) {
    if (i === bytes.length || bytes[i] === AMPERSAND) {
      if (i > start) {
        const sequence = bytes.subarray(start, i);
        const eqIndex = sequence.indexOf(EQUALS);
        const [nameBytes, valueBytes] =
          eqIndex === -1 ? [sequence, new Uint8Array(0)] : [sequence.subarray(0, eqIndex), sequence.subarray(eqIndex + 1)];
        pairs.push([decodeSegment(nameBytes, plusAsSpace), decodeSegment(valueBytes, plusAsSpace)]);
      }
      start = i + 1;
    }
  }

  return pairs;
}

/** WHATWG `application/x-www-form-urlencoded` parsing: `+` decodes to space. */
export function parseFormUrlencoded(rawQuery: string): [string, string][] {
  return parseQuery(rawQuery, true);
}

/** RFC 3986 §3.4 generic URI query parsing: `+` is a literal character, never a space. */
export function parseUriGenericQuery(rawQuery: string): [string, string][] {
  return parseQuery(rawQuery, false);
}
