import { test, expect } from 'bun:test';

import { portFromAddress } from './address';

test('returns the port from a numeric address', () => {
  expect(portFromAddress({ address: '127.0.0.1', family: 'IPv4', port: 3000 })).toBe(3000);
});

test('throws when the address is a string (unix socket)', () => {
  expect(() => portFromAddress('/tmp/sock')).toThrow('expected a bound TCP address');
});

test('throws when the address is null', () => {
  expect(() => portFromAddress(null)).toThrow('expected a bound TCP address');
});
