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
