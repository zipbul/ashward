import { test, expect } from 'bun:test';
import { parseStatusLine } from './head-lex';

const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);

test('parses version, code, and reason from a well-formed status line', () => {
  const result = parseStatusLine(bytes('HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n'));
  expect(result).toEqual({ httpVersion: 'HTTP/1.1', statusCode: 400, reasonPhrase: 'Bad Request' });
});

test('parses a 200 status line', () => {
  const result = parseStatusLine(bytes('HTTP/1.1 200 OK\r\n\r\n'));
  expect(result?.statusCode).toBe(200);
});

test('keeps spaces inside a multi-word reason phrase', () => {
  const result = parseStatusLine(bytes('HTTP/1.1 414 URI Too Long\r\n\r\n'));
  expect(result?.reasonPhrase).toBe('URI Too Long');
});

test('parses a status line with an empty reason phrase', () => {
  const result = parseStatusLine(bytes('HTTP/1.1 204 \r\n\r\n'));
  expect(result).toEqual({ httpVersion: 'HTTP/1.1', statusCode: 204, reasonPhrase: '' });
});

test('returns null for empty input', () => {
  expect(parseStatusLine(new Uint8Array())).toBeNull();
});

test('returns null when the first line is not an HTTP status line', () => {
  expect(parseStatusLine(bytes('garbage without a version\r\n'))).toBeNull();
});

test('returns null when the status code is missing', () => {
  expect(parseStatusLine(bytes('HTTP/1.1\r\n\r\n'))).toBeNull();
});

test('returns null when the status code is not three digits', () => {
  expect(parseStatusLine(bytes('HTTP/1.1 4000 Bad\r\n\r\n'))).toBeNull();
});

test('parses the status line when terminated by a bare LF', () => {
  // Non-normalizing: a peer that uses bare LF is still lexed, not rejected here.
  const result = parseStatusLine(bytes('HTTP/1.1 502 Bad Gateway\n'));
  expect(result?.statusCode).toBe(502);
});

test('returns null when the response starts with an empty first line', () => {
  expect(parseStatusLine(bytes('\r\nHTTP/1.1 200 OK\r\n'))).toBeNull();
});

test('returns null when tokens are tab-separated rather than space-separated', () => {
  expect(parseStatusLine(bytes('HTTP/1.1\t200\tOK\r\n'))).toBeNull();
});

test('returns null on a doubled space before the status code (malformed, not normalized)', () => {
  expect(parseStatusLine(bytes('HTTP/1.1  200 OK\r\n'))).toBeNull();
});

test('parses the status line when the response has no body and no trailing CRLF', () => {
  expect(parseStatusLine(bytes('HTTP/1.1 301 Moved'))?.statusCode).toBe(301);
});
