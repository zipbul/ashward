import { test, expect } from 'bun:test';

import { isZlibWrapped } from './zlib';

test.each([
  // canonical zlib headers (default/fastest/best compression, no dictionary)
  [Uint8Array.from([0x78, 0x9c]), true],
  [Uint8Array.from([0x78, 0x01]), true],
  [Uint8Array.from([0x78, 0xda]), true],
  // raw deflate has no zlib wrapper
  [Uint8Array.from([0x03, 0x00]), false],
  // CM=8 but checkbits don't satisfy the %31 constraint
  [Uint8Array.from([0x78, 0x9d]), false],
  // FDICT bit set (0x20) on an otherwise-valid CMF/FLG pair
  [Uint8Array.from([0x78, 0xbb]), false],
  // too short
  [Uint8Array.from([0x78]), false],
  [Uint8Array.from([]), false],
])('isZlibWrapped(%p) is %p', (bytes, expected) => {
  expect(isZlibWrapped(bytes)).toBe(expected);
});
