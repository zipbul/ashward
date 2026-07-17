import { test, expect } from 'bun:test';

import type { HttpTarget, ProbeFn } from '../http/context';
import type { ProbeResult } from '../transport/tcp/interfaces';

import { InconclusiveReason, SkipReason, Verdict } from '../core/contract/enums';
import { exchange } from '../testkit/replay';
import { deflateZlibWrapped } from './deflate-zlib-wrapped';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };

const probeOnce =
  (result: ProbeResult): ProbeFn =>
  async () =>
    Promise.resolve(result);

const run = async (result: ProbeResult) => deflateZlibWrapped.run({ probe: probeOnce(result), target: TARGET });

test('passes a well-formed zlib header (0x78 0x9c)', async () => {
  const out = await run(exchange('Content-Encoding: deflate', [0x78, 0x9c]));
  expect(out.verdict).toBe(Verdict.Pass);
});

test('passes a well-formed zlib header (0x78 0x01)', async () => {
  const out = await run(exchange('Content-Encoding: deflate', [0x78, 0x01]));
  expect(out.verdict).toBe(Verdict.Pass);
});

test('passes a well-formed zlib header (0x78 0xda)', async () => {
  const out = await run(exchange('Content-Encoding: deflate', [0x78, 0xda]));
  expect(out.verdict).toBe(Verdict.Pass);
});

test('warns on raw deflate with no zlib wrapper', async () => {
  const out = await run(exchange('Content-Encoding: deflate', [0x03, 0x00]));
  expect(out.verdict).toBe(Verdict.Warn);
});

test('warns when the FDICT flag is set', async () => {
  const out = await run(exchange('Content-Encoding: deflate', [0x78, 0x20]));
  expect(out.verdict).toBe(Verdict.Warn);
});

test('warns on a complete body too short to carry a zlib header', async () => {
  const out = await run(exchange('Content-Encoding: deflate', [0x78]));
  expect(out.verdict).toBe(Verdict.Warn);
});

test('is inconclusive with incomplete-message on a truncated body', async () => {
  const out = await run(exchange('Content-Encoding: deflate', [0x78], { contentLength: 10, complete: false }));
  expect(out.verdict).toBe(Verdict.Inconclusive);
  expect(out.reason).toBe(InconclusiveReason.IncompleteMessage);
});

test('is skipped as header-absent when Content-Encoding is missing', async () => {
  const out = await run(exchange('', [0x78, 0x9c]));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.HeaderAbsent);
});

test('passes when deflate is the outermost token (gzip, deflate)', async () => {
  const out = await run(exchange('Content-Encoding: gzip, deflate', [0x78, 0x9c]));
  expect(out.verdict).toBe(Verdict.Pass);
});

test('is skipped as stacked-coding when deflate is not the outermost token (deflate, gzip)', async () => {
  const out = await run(exchange('Content-Encoding: deflate, gzip', [0x78, 0x9c]));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.StackedCoding);
});
