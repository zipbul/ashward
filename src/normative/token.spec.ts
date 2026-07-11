import { test, expect } from 'bun:test';

import { RFC9110 } from '../standards/documents';
import { isToken, TOKEN_CITATION } from './token';

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

test('cites RFC 9110 §5.6.2 as its source production', () => {
  expect(TOKEN_CITATION.doc).toBe(RFC9110);
  expect(TOKEN_CITATION.locator.value).toBe('5.6.2');
});
