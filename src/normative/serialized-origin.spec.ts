import { test, expect } from 'bun:test';

import { isSerializedOrigin } from './serialized-origin';

test.each([
  // canonical serialized origins
  ['https://example.com', true],
  ['http://example.com:8080', true],
  ['http://localhost', true],
  ['https://[::1]', true],
  ['https://[2001:db8::1]', true],
  // not origins at all
  ['null', false],
  ['example.com', false],
  ['https://example.com/', false],
  ['https://example.com/path', false],
  ['https://user@example.com', false],
  ['https://example.com?q=1', false],
  ['https://a.test, https://b.test', false],
  // §1.1 — no subdomain wildcard / list
  ['https://*.example.com', false],
  // §1.2 — a default port must be elided from the serialization
  ['https://example.com:443', false],
  ['http://example.com:80', false],
  ['https://[::1]:443', false],
  // §1.3 — lowercase scheme/host, no percent-encoding, canonical IPv4, port range
  ['HTTPS://example.com', false],
  ['https://Example.com', false],
  ['https://ex%20ample.com', false],
  ['https://example.com:123456', false],
  ['https://01.02.03.04', false],
  ['https://999.999.999.999', false],
  // §1.3 — IPv6: no embedded IPv4, no leading zeros, no single-zero :: elision
  ['https://[::ffff:192.168.0.1]', false],
  ['https://[0db8::1]', false],
  ['https://[1:2:3:4:5:6:7::]', false],
])('isSerializedOrigin(%p) is %p', (value, expected) => {
  expect(isSerializedOrigin(value)).toBe(expected);
});
