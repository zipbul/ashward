import { test, expect } from 'bun:test';

import { isDeltaSeconds } from './delta-seconds';

test.each([
  ['0', true],
  ['86400', true],
  ['', false],
  ['-1', false],
  ['5.0', false],
  ['600s', false],
  ['1 week', false],
])('isDeltaSeconds(%p) is %p', (value, expected) => {
  expect(isDeltaSeconds(value)).toBe(expected);
});
