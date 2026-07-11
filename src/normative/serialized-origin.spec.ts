import { test, expect } from 'bun:test';

import { WHATWG_FETCH } from '../standards/documents';
import { isSerializedOrigin, SERIALIZED_ORIGIN_CITATION } from './serialized-origin';

test.each([
  ['https://example.com', true],
  ['http://example.com:8080', true],
  ['http://localhost', true],
  ['https://[::1]:443', true],
  ['https://[2001:db8::1]', true],
  ['null', false],
  ['example.com', false],
  ['https://example.com/', false],
  ['https://example.com/path', false],
  ['https://user@example.com', false],
  ['https://example.com?q=1', false],
  ['https://a, https://b', false],
  // §1.1 — no list, no subdomain wildcard
  ['https://*.example.com', false],
  // §1.3 — lowercase scheme/host, no percent-encoding, port 1*5DIGIT
  ['HTTPS://example.com', false],
  ['https://Example.com', false],
  ['https://ex%20ample.com', false],
  ['https://example.com:123456', false],
  // §1.3 — IPv6: no embedded IPv4, no leading zeros, no single-zero :: elision
  ['https://[::ffff:192.168.0.1]', false],
  ['https://[0db8::1]', false],
  ['https://[1:2:3:4:5:6:7::]', false],
])('isSerializedOrigin(%p) is %p', (value, expected) => {
  expect(isSerializedOrigin(value)).toBe(expected);
});

test('cites Fetch #origin-header (which supplants RFC 6454)', () => {
  expect(SERIALIZED_ORIGIN_CITATION.doc).toBe(WHATWG_FETCH);
  expect(SERIALIZED_ORIGIN_CITATION.locator.value).toBe('origin-header');
});
