import { test, expect } from 'bun:test';

import { craftRequest } from './request';

const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

test('writes the request line with method, target, and version', () => {
  const sent = decode(craftRequest({ method: 'GET', target: '/', host: 'h.test', headers: [] }));
  expect(sent.startsWith('GET / HTTP/1.1\r\n')).toBe(true);
});

test('emits the Host line and each header in order', () => {
  const sent = decode(
    craftRequest({
      method: 'OPTIONS',
      target: '/',
      host: 'h.test',
      headers: [
        { name: 'Origin', value: 'https://o.test' },
        { name: 'Access-Control-Request-Method', value: 'DELETE' },
      ],
    }),
  );
  expect(sent).toContain('Host: h.test\r\n');
  expect(sent.indexOf('Origin:')).toBeLessThan(sent.indexOf('Access-Control-Request-Method:'));
});

test('always appends Connection: close so the probe is not held open', () => {
  const sent = decode(craftRequest({ method: 'GET', target: '/', host: 'h.test', headers: [] }));
  expect(sent).toContain('Connection: close\r\n');
});

test('terminates the head with a blank line', () => {
  const sent = decode(craftRequest({ method: 'GET', target: '/', host: 'h.test', headers: [] }));
  expect(sent.endsWith('\r\n\r\n')).toBe(true);
});
