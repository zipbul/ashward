import { test, expect } from 'bun:test';

import type { HttpTarget, ProbeFn } from '../http/context';
import type { ProbeResult } from '../transport/tcp/interfaces';

import { InconclusiveReason, SkipReason, Verdict } from '../core/contract/enums';
import { TerminationCause } from '../transport/tcp/enums';
import { gzipFormatValid } from './gzip-format-valid';

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

const run = async (result: ProbeResult) => gzipFormatValid.run({ probe: probeOnce(result), target: TARGET });

test('passes a well-formed gzip member header', async () => {
  const out = await run(exchange('Content-Encoding: gzip', [0x1f, 0x8b, 0x08, 0x00]));
  expect(out.verdict).toBe(Verdict.Pass);
});

test('warns on bytes that are not a valid gzip magic/CM', async () => {
  const out = await run(exchange('Content-Encoding: gzip', [0x78, 0x9c, 0x00]));
  expect(out.verdict).toBe(Verdict.Warn);
});

test('warns on a complete body too short to carry a gzip header', async () => {
  const out = await run(exchange('Content-Encoding: gzip', [0x1f, 0x8b]));
  expect(out.verdict).toBe(Verdict.Warn);
});

test('is inconclusive with incomplete-message on a truncated body', async () => {
  const out = await run(exchange('Content-Encoding: gzip', [0x1f, 0x8b], { contentLength: 10, complete: false }));
  expect(out.verdict).toBe(Verdict.Inconclusive);
  expect(out.reason).toBe(InconclusiveReason.IncompleteMessage);
});

test('is skipped as header-absent when Content-Encoding is missing', async () => {
  const out = await run(exchange('', [0x1f, 0x8b, 0x08, 0x00]));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.HeaderAbsent);
});

test('passes when gzip is the outermost token (br, gzip)', async () => {
  const out = await run(exchange('Content-Encoding: br, gzip', [0x1f, 0x8b, 0x08, 0x00]));
  expect(out.verdict).toBe(Verdict.Pass);
});

test('is skipped as stacked-coding when gzip is not the outermost token (gzip, br)', async () => {
  const out = await run(exchange('Content-Encoding: gzip, br', [0x1f, 0x8b, 0x08, 0x00]));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.StackedCoding);
});

test('passes the x-gzip alias as the outermost token', async () => {
  const out = await run(exchange('Content-Encoding: x-gzip', [0x1f, 0x8b, 0x08, 0x00]));
  expect(out.verdict).toBe(Verdict.Pass);
});
