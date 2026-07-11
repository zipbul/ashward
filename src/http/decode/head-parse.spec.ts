import { test, expect } from 'bun:test';

import { parseResponseHead } from './head-parse';

const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);

test('returns null when there is no parseable status-line', () => {
  expect(parseResponseHead(bytes('not http at all\r\n\r\n'))).toBeNull();
});

test('parses the status-line and every field line', () => {
  const head = parseResponseHead(bytes('HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nX-A: 1\r\n\r\n'));
  expect(head?.statusLine.statusCode).toBe(200);
  expect(head?.fields).toEqual([
    { name: 'Content-Type', value: 'text/plain' },
    { name: 'X-A', value: '1' },
  ]);
});

test('preserves field name case and duplicate lines in order', () => {
  const head = parseResponseHead(bytes('HTTP/1.1 200 OK\r\nVary: Origin\r\nvary: Accept\r\n\r\n'));
  expect(head?.fields).toEqual([
    { name: 'Vary', value: 'Origin' },
    { name: 'vary', value: 'Accept' },
  ]);
});

test('strips optional whitespace around a field value', () => {
  const head = parseResponseHead(bytes('HTTP/1.1 200 OK\r\nX-A:   spaced   \r\n\r\n'));
  expect(head?.fields[0]?.value).toBe('spaced');
});

test('stops at the head/body boundary and ignores the body', () => {
  const head = parseResponseHead(bytes('HTTP/1.1 200 OK\r\nX-A: 1\r\n\r\nX-B: body-not-a-header\r\n'));
  expect(head?.fields).toEqual([{ name: 'X-A', value: '1' }]);
});

test('tolerates a bare-LF line terminator', () => {
  const head = parseResponseHead(bytes('HTTP/1.1 204 No Content\nX-A: 1\n\n'));
  expect(head?.fields).toEqual([{ name: 'X-A', value: '1' }]);
});

test('skips a line with no field name', () => {
  const head = parseResponseHead(bytes('HTTP/1.1 200 OK\r\n: orphan\r\nX-A: 1\r\n\r\n'));
  expect(head?.fields).toEqual([{ name: 'X-A', value: '1' }]);
});

test('parses a head with no field lines', () => {
  const head = parseResponseHead(bytes('HTTP/1.1 204 No Content\r\n\r\n'));
  expect(head?.fields).toEqual([]);
});
