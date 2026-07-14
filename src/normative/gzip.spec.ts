import { test, expect } from 'bun:test';

import { isWellFormedGzipHeader } from './gzip';

test.each([
  // valid headers
  [Uint8Array.from([0x1f, 0x8b, 0x08, 0x00]), true],
  [Uint8Array.from([0x1f, 0x8b, 0x08, 0x08]), true],
  [Uint8Array.from([0x1f, 0x8b, 0x08]), true],
  // zlib magic, not gzip
  [Uint8Array.from([0x78, 0x9c]), false],
  // wrong CM (not deflate)
  [Uint8Array.from([0x1f, 0x8b, 0x09, 0x00]), false],
  // wrong ID1/ID2
  [Uint8Array.from([0x1f, 0x8c, 0x08, 0x00]), false],
  [Uint8Array.from([0x1e, 0x8b, 0x08, 0x00]), false],
  // FLG reserved bit set
  [Uint8Array.from([0x1f, 0x8b, 0x08, 0xe0]), false],
  // too short
  [Uint8Array.from([]), false],
  [Uint8Array.from([0x1f, 0x8b]), false],
])('isWellFormedGzipHeader(%p) is %p', (bytes, expected) => {
  expect(isWellFormedGzipHeader(bytes)).toBe(expected);
});
