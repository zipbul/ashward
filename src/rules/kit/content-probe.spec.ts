import { test, expect } from 'bun:test';

import type { HttpTarget } from '../../http/context';

import { craftContentProbe } from './content-probe';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/resource', timeoutMs: 500 };
const craft = (target: HttpTarget, headers: Parameters<typeof craftContentProbe>[1]['headers']): string =>
  new TextDecoder().decode(craftContentProbe(target, { headers }));

test('aims the request line at the target path with a safe GET', () => {
  expect(craft(TARGET, []).startsWith('GET /resource HTTP/1.1\r\n')).toBe(true);
});

test('sets the Host header to the bare host on the default port', () => {
  expect(craft(TARGET, [])).toContain('Host: origin.test\r\n');
});

test('includes the port in the Host authority for a non-default port', () => {
  expect(craft({ ...TARGET, port: 3000 }, [])).toContain('Host: origin.test:3000\r\n');
});

test('brackets an IPv6 host in the Host authority', () => {
  expect(craft({ ...TARGET, host: '::1', port: 3000 }, [])).toContain('Host: [::1]:3000\r\n');
});

test('carries the given request headers', () => {
  const sent = craft(TARGET, [
    { name: 'Accept-Encoding', value: 'gzip' },
    { name: 'Range', value: 'bytes=0-10' },
  ]);
  expect(sent).toContain('Accept-Encoding: gzip\r\n');
  expect(sent).toContain('Range: bytes=0-10\r\n');
});

test('never sends an Origin header — not a CORS probe', () => {
  expect(craft(TARGET, [])).not.toContain('Origin:');
});

test('always sends Connection: close so the probe is not held open', () => {
  expect(craft(TARGET, [])).toContain('Connection: close\r\n');
});

test('rejects a header value that tries to inject a second header via CRLF', () => {
  expect(() => craftContentProbe(TARGET, { headers: [{ name: 'If-None-Match', value: '"a"\r\nCookie: x=y' }] })).toThrow('CR/LF');
});
