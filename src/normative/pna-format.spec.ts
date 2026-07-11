import { test, expect } from 'bun:test';

import { isPnaId, isPnaName } from './pna-format';

test.each([
  ['01:23:45:67:89:0A', true],
  ['01:23:45:67:89:0a', true],
  ['0123456789ab', false],
  ['01:23:45:67:89', false],
  ['01:23:45:67:89:0A:BC', false],
  ['GG:23:45:67:89:0A', false],
])('isPnaId(%p) is %p', (value, expected) => {
  expect(isPnaId(value)).toBe(expected);
});

test.each([
  ['router.local', true],
  ['my-device_1', true],
  ['UPPER', false],
  ['has space', false],
  ['', false],
])('isPnaName(%p) is %p', (value, expected) => {
  expect(isPnaName(value)).toBe(expected);
});

test('isPnaName enforces the 248 code-unit bound', () => {
  expect(isPnaName('a'.repeat(248))).toBe(true);
  expect(isPnaName('a'.repeat(249))).toBe(false);
});
