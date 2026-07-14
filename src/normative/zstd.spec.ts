import { test, expect } from 'bun:test';

import { zstdReservedBitsZero, zstdWindowSize } from './zstd';

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
