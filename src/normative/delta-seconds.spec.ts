import { test, expect } from 'bun:test';

import { RFC9111 } from '../standards/documents';
import { DELTA_SECONDS_CITATION, isDeltaSeconds } from './delta-seconds';

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

test('cites RFC 9111 §1.2.2 as its source production', () => {
  expect(DELTA_SECONDS_CITATION.doc).toBe(RFC9111);
  expect(DELTA_SECONDS_CITATION.locator.value).toBe('1.2.2');
});
