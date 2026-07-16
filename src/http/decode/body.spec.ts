import { test, expect } from 'bun:test';

import { TerminationCause } from '../../transport/tcp/enums';
import { decodeBody } from './body';
import { parseResponseHead } from './head-parse';

const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);
const text = (u: Uint8Array): string => new TextDecoder().decode(u);

function decode(raw: string, termination?: TerminationCause): ReturnType<typeof decodeBody> {
  const buffer = bytes(raw);
  const head = parseResponseHead(buffer);
  if (head === null) {
    throw new Error('unparseable head in test fixture');
  }
  return decodeBody(buffer, head, termination);
}

test('de-chunks two chunks terminated by a 0-chunk', () => {
  const result = decode('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n4\r\nWiki\r\n5\r\npedia\r\n0\r\n\r\n');
  expect(text(result.content)).toBe('Wikipedia');
  expect(result.complete).toBe(true);
});

test('ignores a chunk-extension on the chunk-size line', () => {
  const result = decode('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n4;ext=1\r\nWiki\r\n0\r\n\r\n');
  expect(text(result.content)).toBe('Wiki');
  expect(result.complete).toBe(true);
});

test('strips a trailer section after the 0-chunk from content', () => {
  const result = decode('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n4\r\nWiki\r\n0\r\nX-Trailer: 1\r\n\r\n');
  expect(text(result.content)).toBe('Wiki');
  expect(result.complete).toBe(true);
});

test('reports incomplete with partial content when truncated mid-chunk', () => {
  const result = decode('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\na\r\nWiki');
  expect(text(result.content)).toBe('Wiki');
  expect(result.complete).toBe(false);
});

test('reports incomplete when the terminating 0-chunk never arrives', () => {
  const result = decode('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n4\r\nWiki\r\n');
  expect(text(result.content)).toBe('Wiki');
  expect(result.complete).toBe(false);
});

test('Content-Length: reads exactly N bytes as complete', () => {
  const result = decode('HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nhello');
  expect(text(result.content)).toBe('hello');
  expect(result.complete).toBe(true);
});

test('Content-Length: fewer than N bytes available yields the partial content, incomplete', () => {
  const result = decode('HTTP/1.1 200 OK\r\nContent-Length: 10\r\n\r\nhello');
  expect(text(result.content)).toBe('hello');
  expect(result.complete).toBe(false);
});

test('Content-Length: 0 yields empty content, complete', () => {
  const result = decode('HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n');
  expect(result.content.length).toBe(0);
  expect(result.complete).toBe(true);
});

test('close-delimited: neither Transfer-Encoding nor Content-Length reads to EOF, complete', () => {
  const result = decode('HTTP/1.1 200 OK\r\n\r\nwhatever is left over');
  expect(text(result.content)).toBe('whatever is left over');
  expect(result.complete).toBe(true);
});

test('de-chunks when chunked is the last coding in Transfer-Encoding', () => {
  const result = decode('HTTP/1.1 200 OK\r\nTransfer-Encoding: gzip, chunked\r\n\r\n4\r\nWiki\r\n0\r\n\r\n');
  expect(text(result.content)).toBe('Wiki');
  expect(result.complete).toBe(true);
});

test('falls through to close-delimited when chunked is not the last coding', () => {
  const result = decode('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked, gzip\r\n\r\nraw-bytes-not-dechunked');
  expect(text(result.content)).toBe('raw-bytes-not-dechunked');
  expect(result.complete).toBe(true);
});

test('yields empty content, incomplete, when the head never reached a body boundary', () => {
  const buffer = bytes('HTTP/1.1 200 OK\r\nContent-Length: 5');
  const head = parseResponseHead(buffer);
  expect(head?.bodyOffset).toBeUndefined();
  const result = decodeBody(buffer, head!);
  expect(result.content.length).toBe(0);
  expect(result.complete).toBe(false);
});

// RFC 9112 §6.3: Transfer-Encoding present with a non-chunked last coding makes the message
// close-delimited — Content-Length MUST be ignored, not honored.
test('Transfer-Encoding present and non-chunked overrides Content-Length: reads the full close-delimited body', () => {
  const raw = 'HTTP/1.1 200 OK\r\nTransfer-Encoding: gzip\r\nContent-Length: 5\r\n\r\n' + 'x'.repeat(20);
  const result = decode(raw);
  expect(result.content.length).toBe(20);
  expect(result.complete).toBe(true);
});

test('Transfer-Encoding: chunked, gzip (chunked not last) ignores a shorter Content-Length', () => {
  const raw = 'HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked, gzip\r\nContent-Length: 3\r\n\r\nraw-bytes-not-dechunked';
  const result = decode(raw);
  expect(text(result.content)).toBe('raw-bytes-not-dechunked');
  expect(result.complete).toBe(true);
});

// A close-delimited body's completeness must reflect how the transport ended, not be assumed true.
test('close-delimited body is incomplete when the peer reset instead of a clean FIN', () => {
  const result = decode('HTTP/1.1 200 OK\r\n\r\nsome bytes', TerminationCause.Rst);
  expect(text(result.content)).toBe('some bytes');
  expect(result.complete).toBe(false);
});

test('close-delimited body is complete on a clean FIN', () => {
  const result = decode('HTTP/1.1 200 OK\r\n\r\nsome bytes', TerminationCause.Fin);
  expect(text(result.content)).toBe('some bytes');
  expect(result.complete).toBe(true);
});

test('close-delimited body defaults to complete when no termination is given', () => {
  const result = decode('HTTP/1.1 200 OK\r\n\r\nsome bytes');
  expect(result.complete).toBe(true);
});

// MAJOR 3 — RFC 9112 §2.2's "a recipient MAY ignore at least one empty line preceding the next
// message" is a close-delimited-FRAMING tolerance for what comes BEFORE a message on the wire, not
// a license to delete body octets that already belong to a message the head-parser found. A
// close-delimited body whose real first bytes happen to be CRLF (or a bare LF) is real content and
// must survive decoding intact.
test('close-delimited body starting with CRLF is not stripped — the leading CRLF is real content', () => {
  const result = decode('HTTP/1.1 200 OK\r\n\r\n\r\nhello');
  expect(text(result.content)).toBe('\r\nhello');
  expect(result.complete).toBe(true);
});

test('close-delimited body starting with a bare LF is not stripped — the leading LF is real content', () => {
  const result = decode('HTTP/1.1 200 OK\r\n\r\n\nhello');
  expect(text(result.content)).toBe('\nhello');
  expect(result.complete).toBe(true);
});

// RFC 9112 §6.3: repeated Content-Length is only safe when every value agrees.
test('duplicate identical Content-Length fields are used', () => {
  const result = decode('HTTP/1.1 200 OK\r\nContent-Length: 5\r\nContent-Length: 5\r\n\r\nhello');
  expect(text(result.content)).toBe('hello');
  expect(result.complete).toBe(true);
});

test('conflicting Content-Length fields make the message ambiguous, not close-delimited', () => {
  const result = decode('HTTP/1.1 200 OK\r\nContent-Length: 5\r\nContent-Length: 10\r\n\r\nhello-world-extra');
  expect(result.complete).toBe(false);
});

// MAJOR 4 — RFC 9112 §6.3 lets Content-Length repeat either as separate field LINES or as one
// comma-coalesced list within a single field value; both must agree the same way. A comma-list
// value like "5, 5" used to fail the `^\d+$` check outright (treated as absent -> close-delimited,
// i.e. over-reading past the true content boundary), and a genuinely conflicting list like "5, 10"
// was silently absent instead of ambiguous.
test('a comma-coalesced Content-Length list of identical members is accepted — reads exactly the declared length, not the whole close-delimited tail', () => {
  // If "5, 5" were (wrongly) treated as absent, this would fall through to close-delimited
  // framing and read the WHOLE remaining buffer ('hello WORLD', 11 bytes) instead of exactly the
  // 5 bytes Content-Length actually declares — a longer body than 5 bytes is what tells apart a
  // correct "value: 5" parse from a coincidental absent/close-delimited pass.
  const result = decode('HTTP/1.1 200 OK\r\nContent-Length: 5, 5\r\n\r\nhello WORLD');
  expect(text(result.content)).toBe('hello');
  expect(result.complete).toBe(true);
});

test('a comma-coalesced Content-Length list with differing members is ambiguous, not absent', () => {
  const result = decode('HTTP/1.1 200 OK\r\nContent-Length: 5, 10\r\n\r\nhello-world-extra');
  expect(result.complete).toBe(false);
});

// Content-Length is a singleton `1*DIGIT` (RFC 9112 §6.2), NOT an ABNF #list — RFC 9110 §5.6.1's
// "empty list elements are tolerated and skipped" rule does not apply to it. RFC 9112 §6.3 permits
// recovery only when the field is a comma-joined set of VALID, non-empty, IDENTICAL integers (the
// sender-coalesced-duplicates case); an empty member makes the value invalid -> unrecoverable
// framing -> ambiguous. Silently accepting `5,,5` as `5` is a request-smuggling parser-differential:
// it must never fall through to close-delimited over-read OR to a lenient accepted value.
test('a comma-coalesced Content-Length list with an EMPTY interior member is ambiguous, not a recoverable value', () => {
  const result = decode('HTTP/1.1 200 OK\r\nContent-Length: 5,,5\r\n\r\nhello WORLD');
  expect(result.complete).toBe(false);
  expect(result.content.length).toBe(0);
});

test('a comma-coalesced Content-Length list with a TRAILING empty member is ambiguous, not a recoverable value', () => {
  const result = decode('HTTP/1.1 200 OK\r\nContent-Length: 5,\r\n\r\nhello WORLD');
  expect(result.complete).toBe(false);
  expect(result.content.length).toBe(0);
});

test('a comma-coalesced Content-Length list with a LEADING empty member is ambiguous, not a recoverable value', () => {
  const result = decode('HTTP/1.1 200 OK\r\nContent-Length: ,5\r\n\r\nhello WORLD');
  expect(result.complete).toBe(false);
  expect(result.content.length).toBe(0);
});

test('a Content-Length value of only commas (all-empty members) is ambiguous, not a recoverable value', () => {
  const result = decode('HTTP/1.1 200 OK\r\nContent-Length: ,,\r\n\r\nhello WORLD');
  expect(result.complete).toBe(false);
  expect(result.content.length).toBe(0);
});

// An INVALID non-empty member (not a decimal-digit run) must make the message ambiguous — never
// silently bucketed as "absent", which would fall through to close-delimited framing and over-read
// past the boundary the (partially valid) Content-Length was trying to declare.
test('a comma-coalesced Content-Length list with a non-numeric member is ambiguous, not absent (no close-delimited over-read)', () => {
  const result = decode('HTTP/1.1 200 OK\r\nContent-Length: 5,abc\r\n\r\nhello WORLD');
  expect(result.complete).toBe(false);
  expect(result.content.length).toBe(0);
});

test('a Content-Length member containing internal whitespace ("5 5") is ambiguous, not absent', () => {
  const result = decode('HTTP/1.1 200 OK\r\nContent-Length: 5 5\r\n\r\nhello WORLD');
  expect(result.complete).toBe(false);
  expect(result.content.length).toBe(0);
});
