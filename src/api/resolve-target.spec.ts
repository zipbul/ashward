import { test, expect } from 'bun:test';

import { resolveTarget } from './resolve-target';

test('extracts host and explicit port from an http URL', () => {
  expect(resolveTarget('http://example.test:8080/api')).toEqual({
    host: 'example.test',
    port: 8080,
    path: '/api',
    timeoutMs: 5000,
  });
});

test('defaults to port 80 for http without an explicit port', () => {
  expect(resolveTarget('http://example.test').port).toBe(80);
});

test('preserves an IPv4 host', () => {
  expect(resolveTarget('http://127.0.0.1:3000').host).toBe('127.0.0.1');
});

test('throws on an unparseable URL', () => {
  expect(() => resolveTarget('not a url')).toThrow();
});

test('throws on a non-http protocol', () => {
  expect(() => resolveTarget('ftp://example.test')).toThrow('unsupported protocol');
});

test('throws on https because the driver has no TLS — silent https would false-red every probe', () => {
  expect(() => resolveTarget('https://example.test')).toThrow('https');
});
