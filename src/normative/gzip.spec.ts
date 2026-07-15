import { test, expect } from 'bun:test';

import { isWellFormedGzipHeader } from './gzip';

// RFC 1952 §2.3.1: ID1 ID2 CM FLG MTIME[4] XFL OS is a FIXED 10-byte header — MTIME/XFL/OS may
// be any value, so they are zero-filled in these fixtures.
const full = (id1: number, id2: number, cm: number, flg: number): Uint8Array =>
  Uint8Array.from([id1, id2, cm, flg, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

test.each([
  // valid full 10-byte headers
  [full(0x1f, 0x8b, 0x08, 0x00), true],
  [full(0x1f, 0x8b, 0x08, 0x08), true],
  // a 3-byte prefix is not a complete fixed header, no matter how well-formed it looks
  [Uint8Array.from([0x1f, 0x8b, 0x08]), false],
  // zlib magic, not gzip
  [Uint8Array.from([0x78, 0x9c]), false],
  // wrong CM (not deflate)
  [full(0x1f, 0x8b, 0x09, 0x00), false],
  // wrong ID1/ID2
  [full(0x1f, 0x8c, 0x08, 0x00), false],
  [full(0x1e, 0x8b, 0x08, 0x00), false],
  // FLG reserved bit set
  [full(0x1f, 0x8b, 0x08, 0xe0), false],
  // too short
  [Uint8Array.from([]), false],
  [Uint8Array.from([0x1f, 0x8b]), false],
  // 9 bytes: one short of the fixed 10-byte header
  [Uint8Array.from([0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]), false],
])('isWellFormedGzipHeader(%p) is %p', (bytes, expected) => {
  expect(isWellFormedGzipHeader(bytes)).toBe(expected);
});
