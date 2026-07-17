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

// RFC 8878 §3.1.1.1's Dictionary_ID field is 0, 1, 2, or 4 bytes wide (DID_flag 0-3) — every width
// must be skipped correctly so the Frame_Content_Size/window fields that follow it still land right.
test('zstdWindowSizes: skips a Dictionary_ID field of each declared byte width (1, 2, 4)', () => {
  const oneByteDid = buildZstdFrame({
    singleSegment: false,
    windowExponent: 0,
    windowMantissa: 0, // 1024
    dictionaryIdBytes: 1,
    dictionaryId: 7,
    terminated: true,
  });
  const twoByteDid = buildZstdFrame({
    singleSegment: false,
    windowExponent: 1,
    windowMantissa: 0, // 2048
    dictionaryIdBytes: 2,
    dictionaryId: 700,
    terminated: true,
  });
  const fourByteDid = buildZstdFrame({
    singleSegment: false,
    windowExponent: 2,
    windowMantissa: 0, // 4096
    dictionaryIdBytes: 4,
    dictionaryId: 90_000,
    terminated: true,
  });
  const bytes = Uint8Array.from([...oneByteDid, ...twoByteDid, ...fourByteDid]);
  expect(zstdWindowSizes(bytes)).toEqual([1024, 2048, 4096]);
});

// RFC 8878 §3.1.1.1.4: a 2-byte Frame_Content_Size is stored MINUS 256 on the wire and must be
// added back — and a Single_Segment frame's window size IS its Frame_Content_Size (§3.1.1.1.2).
test('zstdWindowSizes: adds back the 2-byte Frame_Content_Size "+256" offset on a Single_Segment frame', () => {
  const bytes = Uint8Array.from(
    buildZstdFrame({ singleSegment: true, frameContentSizeBytes: 2, frameContentSize: 300, terminated: true }),
  );
  expect(zstdWindowSizes(bytes)).toEqual([300]);
});

test('zstdWindowSizes: empty when the buffer ends right after the magic, before the Frame_Header_Descriptor', () => {
  const bytes = Uint8Array.from([0x28, 0xb5, 0x2f, 0xfd]); // STANDARD_MAGIC only, no descriptor byte
  expect(zstdWindowSizes(bytes)).toEqual([]);
});

test('zstdAllReservedBitsZero: null when the buffer ends right after the magic, before the Frame_Header_Descriptor', () => {
  const bytes = Uint8Array.from([0x28, 0xb5, 0x2f, 0xfd]);
  expect(zstdAllReservedBitsZero(bytes)).toBeNull();
});

test('zstdWindowSizes: empty when a non-Single_Segment frame is cut off before its Window_Descriptor byte', () => {
  const full = buildZstdFrame({ singleSegment: false, windowExponent: 0, windowMantissa: 0 });
  const bytes = Uint8Array.from(full.slice(0, 5)); // magic(4) + descriptor(1), the Window_Descriptor byte never arrives
  expect(zstdWindowSizes(bytes)).toEqual([]);
  expect(zstdAllReservedBitsZero(bytes)).toBeNull();
});

test('zstdWindowSizes: empty when a declared Dictionary_ID field is cut off partway through', () => {
  const full = buildZstdFrame({
    singleSegment: false,
    windowExponent: 0,
    windowMantissa: 0,
    dictionaryIdBytes: 4,
    dictionaryId: 123_456,
  });
  const bytes = Uint8Array.from(full.slice(0, full.length - 1)); // one byte short of the declared 4-byte Dictionary_ID
  expect(zstdWindowSizes(bytes)).toEqual([]);
  expect(zstdAllReservedBitsZero(bytes)).toBeNull();
});

test('zstdWindowSizes: empty when a declared Frame_Content_Size field is cut off partway through', () => {
  const full = buildZstdFrame({
    singleSegment: false,
    windowExponent: 0,
    windowMantissa: 0,
    frameContentSizeBytes: 4,
    frameContentSize: 100_000,
  });
  const bytes = Uint8Array.from(full.slice(0, full.length - 1)); // one byte short of the declared 4-byte Frame_Content_Size
  expect(zstdWindowSizes(bytes)).toEqual([]);
  expect(zstdAllReservedBitsZero(bytes)).toBeNull();
});

// RFC 8878 §3.1.2: a Skippable_Frame's own header is magic(4) + Frame_Size(4) — cut off before the
// Frame_Size field arrives, `locateStandardFrame` can't even tell how much user data to skip.
test('zstdWindowSizes: empty when a leading Skippable_Frame is cut off before its own Frame_Size field', () => {
  const bytes = Uint8Array.from([0x50, 0x2a, 0x4d, 0x18]); // Skippable_Frame magic only, no 4-byte Frame_Size
  expect(zstdWindowSizes(bytes)).toEqual([]);
  expect(zstdAllReservedBitsZero(bytes)).toBeNull();
});

// RFC 8878 §3.1.1.2: Block_Type 3 is Reserved — not a parseable stream. The frame's OWN header was
// already fully parsed before its block data was walked, so it must still be reported; only the
// walk for any FURTHER frame stops.
test('zstdWindowSizes: a Reserved block type ends the walk but keeps the already-parsed frame header', () => {
  const header = buildZstdFrame({ singleSegment: false, windowExponent: 5, windowMantissa: 0 }); // 32768, no block appended
  const reservedBlockHeader = [0x07, 0x00, 0x00]; // Last_Block=1, Block_Type=3 (Reserved), Block_Size=0
  const bytes = Uint8Array.from([...header, ...reservedBlockHeader]);
  expect(zstdWindowSizes(bytes)).toEqual([32768]);
});

test('zstdWindowSizes: a block whose declared size runs past the buffer ends the walk but keeps the already-parsed header', () => {
  const header = buildZstdFrame({ singleSegment: false, windowExponent: 5, windowMantissa: 0 }); // 32768, no block appended
  const oversizedBlockHeader = [0x51, 0x00, 0x00]; // Last_Block=1, Block_Type=0 (Raw), Block_Size=10 — but no data follows
  const bytes = Uint8Array.from([...header, ...oversizedBlockHeader]);
  expect(zstdWindowSizes(bytes)).toEqual([32768]);
});

// The test-only `buildZstdFrame` builder never sets the Content_Checksum_flag bit (bit 2 of the
// Frame_Header_Descriptor) — no fixture in this repo has needed it before now — so these two set it
// by hand on the builder's own output rather than hand-rolling an entire frame.
function withContentChecksumFlag(headerBytes: readonly number[]): number[] {
  const bytes = [...headerBytes];
  const descriptorIndex = 4; // STANDARD_MAGIC is 4 bytes; the descriptor immediately follows.
  bytes[descriptorIndex] = (bytes[descriptorIndex] ?? 0) | 0x04; // bit 2 — Content_Checksum_flag.
  return bytes;
}

test('zstdWindowSizes: a truncated trailing Content_Checksum ends the walk but keeps the already-parsed header', () => {
  const header = withContentChecksumFlag(buildZstdFrame({ singleSegment: false, windowExponent: 0, windowMantissa: 0 })); // 1024
  const terminatingBlock = [0x01, 0x00, 0x00]; // Last_Block=1, Block_Type=0 (Raw), Block_Size=0
  const bytes = Uint8Array.from([...header, ...terminatingBlock]); // no 4-byte checksum trailer at all
  expect(zstdWindowSizes(bytes)).toEqual([1024]);
  expect(zstdAllReservedBitsZero(bytes)).toBe(true);
});

test('zstdWindowSizes: a present Content_Checksum trailer is skipped so a concatenated second frame is still found', () => {
  const header = withContentChecksumFlag(buildZstdFrame({ singleSegment: false, windowExponent: 0, windowMantissa: 0 })); // 1024
  const terminatingBlock = [0x01, 0x00, 0x00];
  const checksumTrailer = [0x00, 0x00, 0x00, 0x00];
  const second = buildZstdFrame({ singleSegment: false, windowExponent: 1, windowMantissa: 0, terminated: true }); // 2048
  const bytes = Uint8Array.from([...header, ...terminatingBlock, ...checksumTrailer, ...second]);
  expect(zstdWindowSizes(bytes)).toEqual([1024, 2048]);
});

test('zstdAllReservedBitsZero: false when the Frame_Header_Descriptor Unused bit is set, even with Reserved clear', () => {
  const bytes = Uint8Array.from(
    buildZstdFrame({ singleSegment: false, windowExponent: 0, windowMantissa: 0, unusedBit: 1, terminated: true }),
  );
  expect(zstdAllReservedBitsZero(bytes)).toBe(false);
});
