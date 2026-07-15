import { test, expect } from 'bun:test';

import { buildSkippableFrame, buildZstdFrame } from '../testkit/zstd-frame';
import { zstdAllReservedBitsZero, zstdReservedBitsZero, zstdWindowSize, zstdWindowSizes } from './zstd';

const MAGIC = [0x28, 0xb5, 0x2f, 0xfd];

test('zstdWindowSize: Single_Segment frame with FCS=8388608 (8 MiB)', () => {
  // descriptor 0xA0: FCS_flag=2 (4-byte size), Single_Segment_flag=1
  const bytes = Uint8Array.from([...MAGIC, 0xa0, 0x00, 0x00, 0x80, 0x00]);

  expect(zstdWindowSize(bytes)).toBe(8388608);
});

test('zstdWindowSize: Single_Segment frame with FCS=8388609', () => {
  const bytes = Uint8Array.from([...MAGIC, 0xa0, 0x01, 0x00, 0x80, 0x00]);

  expect(zstdWindowSize(bytes)).toBe(8388609);
});

test('zstdWindowSize: Window_Descriptor giving 8 MiB (exponent=13, mantissa=0)', () => {
  // descriptor 0x00: FCS_flag=0, Single_Segment_flag=0 -> Window_Descriptor byte follows
  const bytes = Uint8Array.from([...MAGIC, 0x00, 0x68]);

  expect(zstdWindowSize(bytes)).toBe(8388608);
});

test('zstdWindowSize: Window_Descriptor giving 9 MiB (exponent=13, mantissa=1)', () => {
  const bytes = Uint8Array.from([...MAGIC, 0x00, 0x69]);

  expect(zstdWindowSize(bytes)).toBe(9437184);
});

test('zstdWindowSize: Dictionary_ID (1 byte) is skipped AFTER Window_Descriptor', () => {
  // descriptor 0x01: DID_flag=1 (1-byte dictionary id), Single_Segment_flag=0.
  // Window_Descriptor 0x00 (exponent=0, mantissa=0 -> 1024), then a 1-byte dictionary id (0xAB),
  // then no Frame_Content_Size (FCS_flag=0, not single-segment). Reading DID before the
  // Window_Descriptor would misinterpret 0xAB as the window byte and yield a huge window instead.
  const bytes = Uint8Array.from([...MAGIC, 0x01, 0x00, 0xab]);

  expect(zstdWindowSize(bytes)).toBe(1024);
});

test('zstdWindowSize: a leading Skippable_Frame is skipped to reach the standard frame', () => {
  const skippable = [0x50, 0x2a, 0x4d, 0x18, 0x03, 0x00, 0x00, 0x00, 0xaa, 0xbb, 0xcc];
  const standard = [...MAGIC, 0x00, 0x68];
  const bytes = Uint8Array.from([...skippable, ...standard]);

  expect(zstdWindowSize(bytes)).toBe(8388608);
});

test('zstdWindowSize: non-zstd bytes are not a frame', () => {
  expect(zstdWindowSize(Uint8Array.from([0x00, 0x00]))).toBeNull();
});

test('zstdWindowSize: empty input is not a frame', () => {
  expect(zstdWindowSize(Uint8Array.from([]))).toBeNull();
});

test('zstdWindowSize: truncated frame (magic only, no descriptor byte) is unparseable', () => {
  expect(zstdWindowSize(Uint8Array.from(MAGIC))).toBeNull();
});

test('zstdReservedBitsZero: reserved bit (bit 3) set is a violation', () => {
  const bytes = Uint8Array.from([...MAGIC, 0x08, 0x00]);

  expect(zstdReservedBitsZero(bytes)).toBe(false);
});

test('zstdReservedBitsZero: unused bit (bit 4) set is a violation', () => {
  const bytes = Uint8Array.from([...MAGIC, 0x10, 0x00]);

  expect(zstdReservedBitsZero(bytes)).toBe(false);
});

test('zstdReservedBitsZero: both bits clear is conformant', () => {
  const bytes = Uint8Array.from([...MAGIC, 0x00, 0x68]);

  expect(zstdReservedBitsZero(bytes)).toBe(true);
});

test('zstdReservedBitsZero: non-zstd bytes are not a frame', () => {
  expect(zstdReservedBitsZero(Uint8Array.from([0x00, 0x00]))).toBeNull();
});

// Missing predicate coverage: 2-byte Frame_Content_Size (the FCS_flag=1 "+256" encoding).
test('zstdWindowSize: 2-byte Frame_Content_Size (FCS_flag=1) adds 256 to the on-wire value', () => {
  // descriptor 0x60: FCS_flag=1 (2-byte size, +256), Single_Segment_flag=1.
  const bytes = Uint8Array.from([...MAGIC, 0x60, 0x2c, 0x01]); // on-wire 0x012c=300 -> 300+256=556
  expect(zstdWindowSize(bytes)).toBe(556);
});

// Missing predicate coverage: a 4-byte Dictionary_ID field (DID_flag=3).
test('zstdWindowSize: 4-byte Dictionary_ID is skipped before Frame_Content_Size', () => {
  // descriptor 0x43: FCS_flag=1 (2-byte size), Single_Segment_flag=0, DID_flag=3 (4-byte dictionary id).
  const bytes = Uint8Array.from([...MAGIC, 0x43, 0x68, 0xde, 0xad, 0xbe, 0xef, 0x00, 0x00]);
  // Window_Descriptor 0x68 -> exponent=13, mantissa=0 -> 8388608; FCS bytes ignored for the window.
  expect(zstdWindowSize(bytes)).toBe(8388608);
});

// Missing predicate coverage: more than one skippable frame chained before the standard frame.
test('zstdWindowSize: a chain of multiple leading Skippable_Frames is skipped', () => {
  const first = buildSkippableFrame(0x50, 2);
  const second = buildSkippableFrame(0x5f, 3);
  const standard = [...MAGIC, 0x00, 0x68];
  const bytes = Uint8Array.from([...first, ...second, ...standard]);
  expect(zstdWindowSize(bytes)).toBe(8388608);
});

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
