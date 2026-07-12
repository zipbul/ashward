import { test, expect } from 'bun:test';

import { parseResponseHead } from '../../http/decode/head-parse';
import { varyHasOrigin } from './vary';

const headOf = (fields: string): ReturnType<typeof parseResponseHead> =>
  parseResponseHead(new TextEncoder().encode(`HTTP/1.1 200 OK\r\n${fields}\r\n\r\n`));

test.each([
  ['Vary: Origin', true],
  ['Vary: origin', true],
  ['Vary: Accept-Encoding, Origin', true],
  ['Vary: *', true],
  ['Vary: Accept-Encoding', false],
  ['X-Other: y', false],
])('varyHasOrigin(%p) is %p', (fields, expected) => {
  expect(varyHasOrigin(headOf(fields)!)).toBe(expected);
});

test('detects Origin across repeated Vary field lines', () => {
  expect(varyHasOrigin(headOf('Vary: Accept-Encoding\r\nVary: Origin')!)).toBe(true);
});
