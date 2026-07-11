import { test, expect } from 'bun:test';

import { isToken } from './token';

test.each([
  ['GET', true],
  ['X-Custom!', true],
  ['*', true],
  ['', false],
  ['has space', false],
  ['semi;colon', false],
  ['GET,POST', false],
])('isToken(%p) is %p', (value, expected) => {
  expect(isToken(value)).toBe(expected);
});
