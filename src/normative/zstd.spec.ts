import { test, expect } from 'bun:test';

import { buildSkippableFrame, buildZstdFrame } from '../testkit/zstd-frame';
import { zstdAllReservedBitsZero, zstdWindowSizes } from './zstd';

// RFC 9659 §3's 8 MiB HTTP window cap applies PER frame — a stream can concatenate frames
// (RFC 8878 §3.1), and a later frame exceeding the cap must not be hidden behind a conformant one.
test('zstdWindowSizes: reports every standard frame window size, in order', () => {
  const first = buildZstdFrame({ singleSegment: false, windowExponent: 13, windowMantissa: 0, terminated: true }); // 8 MiB
  const second = buildZstdFrame({ singleSegment: false, windowExponent: 13, windowMantissa: 1, terminated: true }); // 9 MiB
  const bytes = Uint8Array.from([...first, ...second]);
  expect(zstdWindowSizes(bytes)).toEqual([8388608, 9437184]);
});

test('zstdWindowSizes: a chain of skippable frames between two standard frames is skipped', () => {
  const first = buildZstdFrame({ singleSegment: false, windowExponent: 0, windowMantissa: 0, terminated: true }); // 1024
  const skippableA = buildSkippableFrame(0x50, 1);
  const skippableB = buildSkippableFrame(0x51, 4);
  const second = buildZstdFrame({ singleSegment: false, windowExponent: 1, windowMantissa: 0, terminated: true }); // 2048
  const bytes = Uint8Array.from([...first, ...skippableA, ...skippableB, ...second]);
  expect(zstdWindowSizes(bytes)).toEqual([1024, 2048]);
});

test('zstdWindowSizes: empty for bytes that are not a parseable zstd frame at all', () => {
  expect(zstdWindowSizes(Uint8Array.from([0x00, 0x00]))).toEqual([]);
});

test('zstdAllReservedBitsZero: true when every frame in a multi-frame stream is clean', () => {
  const first = buildZstdFrame({ singleSegment: false, windowExponent: 10, windowMantissa: 0, terminated: true });
  const second = buildZstdFrame({ singleSegment: false, windowExponent: 11, windowMantissa: 0, terminated: true });
  const bytes = Uint8Array.from([...first, ...second]);
  expect(zstdAllReservedBitsZero(bytes)).toBe(true);
});

test('zstdAllReservedBitsZero: false when the SECOND frame has a nonzero reserved bit', () => {
  const first = buildZstdFrame({ singleSegment: false, windowExponent: 10, windowMantissa: 0, terminated: true });
  const second = buildZstdFrame({
    singleSegment: false,
    windowExponent: 11,
    windowMantissa: 0,
    reservedBit: 1,
    terminated: true,
  });
  const bytes = Uint8Array.from([...first, ...second]);
  expect(zstdAllReservedBitsZero(bytes)).toBe(false);
});

test('zstdAllReservedBitsZero: null for bytes that are not a parseable zstd frame at all', () => {
  expect(zstdAllReservedBitsZero(Uint8Array.from([0x00, 0x00]))).toBeNull();
});
