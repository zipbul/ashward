import { test, expect } from 'bun:test';

import type { HttpTarget, ProbeFn } from '../http/context';
import type { ProbeResult } from '../transport/tcp/interfaces';

import { InconclusiveReason, SkipReason, Verdict } from '../core/contract/enums';
import { buildZstdFrame } from '../testkit/zstd-frame';
import { TerminationCause } from '../transport/tcp/enums';
import { zstdReservedBitsZero } from './zstd-reserved-bits-zero';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };

function exchange(
  headFields: string,
  body: readonly number[],
  opts?: { contentLength?: number; complete?: boolean },
): ProbeResult {
  const bodyBytes = Uint8Array.from(body);
  const cl = opts?.contentLength ?? bodyBytes.length;
  const headStr = `HTTP/1.1 200 OK\r\n${headFields}\r\nContent-Length: ${cl}\r\n\r\n`;
  const headBytes = new TextEncoder().encode(headStr);
  const response = new Uint8Array(headBytes.length + bodyBytes.length);
  response.set(headBytes, 0);
  response.set(bodyBytes, headBytes.length);
  return { response, termination: opts?.complete === false ? TerminationCause.Rst : TerminationCause.Fin };
}

const probeOnce =
  (result: ProbeResult): ProbeFn =>
  async () =>
    Promise.resolve(result);

const run = async (result: ProbeResult) => zstdReservedBitsZero.run({ probe: probeOnce(result), target: TARGET });
const CE = 'Content-Encoding: zstd';

test('warns when the Frame_Header_Descriptor Unused bit is set', async () => {
  const frame = buildZstdFrame({ singleSegment: false, windowExponent: 10, windowMantissa: 0, unusedBit: 1 });
  const out = await run(exchange(CE, frame));
  expect(out.verdict).toBe(Verdict.Warn);
});

test('warns when the Frame_Header_Descriptor Reserved bit is set', async () => {
  const frame = buildZstdFrame({ singleSegment: false, windowExponent: 10, windowMantissa: 0, reservedBit: 1 });
  const out = await run(exchange(CE, frame));
  expect(out.verdict).toBe(Verdict.Warn);
});

test('passes when both the Unused and Reserved bits are zero', async () => {
  const frame = buildZstdFrame({ singleSegment: false, windowExponent: 10, windowMantissa: 0 });
  const out = await run(exchange(CE, frame));
  expect(out.verdict).toBe(Verdict.Pass);
});

test('is skipped as out-of-scope on a non-zstd magic number', async () => {
  const out = await run(exchange(CE, [0x00, 0x00, 0x00, 0x00, 0x00]));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.OutOfScope);
});

test('is inconclusive with incomplete-message on a truncated frame', async () => {
  const frame = buildZstdFrame({ singleSegment: false, windowExponent: 10, windowMantissa: 0 });
  const out = await run(exchange(CE, frame, { contentLength: 100, complete: false }));
  expect(out.verdict).toBe(Verdict.Inconclusive);
  expect(out.reason).toBe(InconclusiveReason.IncompleteMessage);
});

test('is skipped as header-absent when Content-Encoding is missing', async () => {
  const frame = buildZstdFrame({ singleSegment: false, windowExponent: 10, windowMantissa: 0 });
  const out = await run(exchange('', frame));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.HeaderAbsent);
});

// RFC 8878 §3.1 permits concatenated frames — a clean first frame must not hide a reserved-bit
// violation on a later frame.
test('warns when the Reserved bit is set on the SECOND concatenated frame', async () => {
  const clean = buildZstdFrame({ singleSegment: false, windowExponent: 10, windowMantissa: 0, terminated: true });
  const dirty = buildZstdFrame({ singleSegment: false, windowExponent: 10, windowMantissa: 0, reservedBit: 1, terminated: true });
  const out = await run(exchange(CE, [...clean, ...dirty]));
  expect(out.verdict).toBe(Verdict.Warn);
});
