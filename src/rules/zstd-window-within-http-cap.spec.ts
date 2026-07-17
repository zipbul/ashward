import { test, expect } from 'bun:test';

import type { HttpTarget, ProbeFn } from '../http/context';
import type { ProbeResult } from '../transport/tcp/interfaces';

import { InconclusiveReason, SkipReason, Verdict } from '../core/contract/enums';
import { exchange } from '../testkit/replay';
import { buildSkippableFrame, buildZstdFrame } from '../testkit/zstd-frame';
import { zstdWindowWithinHttpCap } from './zstd-window-within-http-cap';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };

const probeOnce =
  (result: ProbeResult): ProbeFn =>
  async () =>
    Promise.resolve(result);

const run = async (result: ProbeResult) => zstdWindowWithinHttpCap.run({ probe: probeOnce(result), target: TARGET });
const CE = 'Content-Encoding: zstd';

test('passes an exact 8 MiB window (the cap)', async () => {
  // windowBase = 2^(10+13) = 8388608 (exponent 13, mantissa 0)
  const frame = buildZstdFrame({ singleSegment: false, windowExponent: 13, windowMantissa: 0 });
  const out = await run(exchange(CE, frame));
  expect(out.verdict).toBe(Verdict.Pass);
});

test('fails the next window step above 8 MiB (9 MiB)', async () => {
  // windowBase 8388608 + windowAdd (8388608/8)*1 = 9437184
  const frame = buildZstdFrame({ singleSegment: false, windowExponent: 13, windowMantissa: 1 });
  const out = await run(exchange(CE, frame));
  expect(out.verdict).toBe(Verdict.Fail);
});

test('fails a Single_Segment frame whose Frame_Content_Size is 8 388 609 (one byte over)', async () => {
  const frame = buildZstdFrame({ singleSegment: true, frameContentSizeBytes: 4, frameContentSize: 8_388_609 });
  const out = await run(exchange(CE, frame));
  expect(out.verdict).toBe(Verdict.Fail);
});

test('passes a Single_Segment frame whose Frame_Content_Size is exactly 8 MiB', async () => {
  const frame = buildZstdFrame({ singleSegment: true, frameContentSizeBytes: 4, frameContentSize: 8_388_608 });
  const out = await run(exchange(CE, frame));
  expect(out.verdict).toBe(Verdict.Pass);
});

test('passes a 128 KiB window with a non-zero Dictionary_ID field (exercises field order)', async () => {
  // windowBase = 2^(10+7) = 131072 (128 KiB), exponent 7, mantissa 0
  const frame = buildZstdFrame({
    singleSegment: false,
    windowExponent: 7,
    windowMantissa: 0,
    dictionaryIdBytes: 1,
    dictionaryId: 5,
  });
  const out = await run(exchange(CE, frame));
  expect(out.verdict).toBe(Verdict.Pass);
});

test('passes a 128 KiB window preceded by a leading skippable frame', async () => {
  const skippable = buildSkippableFrame(0x50, 4);
  const frame = buildZstdFrame({ singleSegment: false, windowExponent: 7, windowMantissa: 0 });
  const out = await run(exchange(CE, [...skippable, ...frame]));
  expect(out.verdict).toBe(Verdict.Pass);
});

test('is skipped as out-of-scope on a non-zstd magic number', async () => {
  const out = await run(exchange(CE, [0x00, 0x00, 0x00, 0x00, 0x00]));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.OutOfScope);
});

test('is inconclusive with incomplete-message on a truncated frame', async () => {
  const frame = buildZstdFrame({ singleSegment: false, windowExponent: 13, windowMantissa: 0 });
  const out = await run(exchange(CE, frame, { contentLength: 100, complete: false }));
  expect(out.verdict).toBe(Verdict.Inconclusive);
  expect(out.reason).toBe(InconclusiveReason.IncompleteMessage);
});

test('is skipped as header-absent when Content-Encoding is missing', async () => {
  const frame = buildZstdFrame({ singleSegment: false, windowExponent: 13, windowMantissa: 0 });
  const out = await run(exchange('', frame));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.HeaderAbsent);
});

// RFC 8878 §3.1 permits concatenated frames, and RFC 9659 §3's 8 MiB cap applies PER frame — a
// conformant first frame must not hide an oversized second frame from the rule.
test('fails when only the SECOND concatenated frame exceeds the 8 MiB window cap', async () => {
  const conformant = buildZstdFrame({ singleSegment: false, windowExponent: 13, windowMantissa: 0, terminated: true }); // 8 MiB
  const oversized = buildZstdFrame({ singleSegment: false, windowExponent: 13, windowMantissa: 1, terminated: true }); // 9 MiB
  const out = await run(exchange(CE, [...conformant, ...oversized]));
  expect(out.verdict).toBe(Verdict.Fail);
});
