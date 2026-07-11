import { test, expect } from 'bun:test';

import { WHATWG_FETCH } from '../standards/documents';
import { isOkStatus, OK_STATUS_CITATION } from './ok-status';

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

test('cites Fetch ok status', () => {
  expect(OK_STATUS_CITATION.doc).toBe(WHATWG_FETCH);
  expect(OK_STATUS_CITATION.locator.value).toBe('ok-status');
});
