import { test, expect } from 'bun:test';

import type { Target } from '../../core/engine/interfaces';

import { craftProbe } from './craft-probe';

const TARGET: Target = { host: 'origin.test', port: 80, path: '/resource', timeoutMs: 500 };
const craft = (target: Target, opts: Parameters<typeof craftProbe>[1]): string =>
  new TextDecoder().decode(craftProbe(target, opts));

test('aims the request line at the target path', () => {
  expect(craft(TARGET, { origin: 'https://o.test' }).startsWith('GET /resource HTTP/1.1\r\n')).toBe(true);
});

test('sets the Host header to the bare host on the default port', () => {
  expect(craft(TARGET, { origin: 'https://o.test' })).toContain('Host: origin.test\r\n');
});

test('includes the port in the Host authority for a non-default port', () => {
  expect(craft({ ...TARGET, port: 3000 }, { origin: 'https://o.test' })).toContain('Host: origin.test:3000\r\n');
});

test('brackets an IPv6 host in the Host authority', () => {
  expect(craft({ ...TARGET, host: '::1', port: 3000 }, { origin: 'https://o.test' })).toContain('Host: [::1]:3000\r\n');
});

test('carries the Origin header', () => {
  expect(craft(TARGET, { origin: 'https://o.test' })).toContain('Origin: https://o.test\r\n');
});

test('never sends a Cookie — credentials mode is not server-observable', () => {
  expect(craft(TARGET, { origin: 'https://o.test' })).not.toContain('Cookie:');
});

test('always sends Connection: close so the probe is not held open', () => {
  expect(craft(TARGET, { origin: 'https://o.test' })).toContain('Connection: close\r\n');
});

test('defaults the simple method to GET', () => {
  expect(craft(TARGET, { origin: 'https://o.test' }).startsWith('GET ')).toBe(true);
});

test('crafts a preflight with OPTIONS and the previewed method', () => {
  const sent = craft(TARGET, { kind: 'preflight', origin: 'https://o.test', requestMethod: 'DELETE' });
  expect(sent.startsWith('OPTIONS /resource HTTP/1.1\r\n')).toBe(true);
  expect(sent).toContain('Access-Control-Request-Method: DELETE\r\n');
});

test('joins previewed headers into one Access-Control-Request-Headers field', () => {
  const sent = craft(TARGET, {
    kind: 'preflight',
    origin: 'https://o.test',
    requestMethod: 'GET',
    requestHeaders: ['x-a', 'x-b'],
  });
  expect(sent).toContain('Access-Control-Request-Headers: x-a, x-b\r\n');
});

test('previews a private-network access when asked (§6.1 elicitation)', () => {
  const sent = craft(TARGET, { kind: 'preflight', origin: 'https://o.test', requestMethod: 'GET', requestPrivateNetwork: true });
  expect(sent).toContain('Access-Control-Request-Private-Network: true\r\n');
});

test('a simple probe never carries preflight request headers', () => {
  const sent = craft(TARGET, { origin: 'https://o.test' });
  expect(sent).not.toContain('Access-Control-Request-Method');
  expect(sent).not.toContain('Access-Control-Request-Headers');
});

test('rejects a forged origin that tries to inject a second header via CRLF', () => {
  expect(() => craftProbe(TARGET, { origin: 'https://x\r\nCookie: a=b' })).toThrow('CR/LF');
});
