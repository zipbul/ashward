import { test, expect } from 'bun:test';

import { isOkStatus } from './ok-status';

test.each([
  [199, false],
  [200, true],
  [204, true],
  [299, true],
  [300, false],
  [404, false],
  [500, false],
])('isOkStatus(%p) is %p', (code, expected) => {
  expect(isOkStatus(code)).toBe(expected);
});
