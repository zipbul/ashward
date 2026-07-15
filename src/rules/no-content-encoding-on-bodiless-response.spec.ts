import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { noContentEncodingOnBodilessResponse } from './no-content-encoding-on-bodiless-response';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const run = async (raw: string) => noContentEncodingOnBodilessResponse.run({ probe: replay(raw), target: TARGET });

test('warns when a 204 carries a real Content-Encoding token', async () => {
  const out = await run('HTTP/1.1 204 No Content\r\nContent-Encoding: gzip\r\n\r\n');
  expect(out.verdict).toBe(Verdict.Warn);
});

test('warns when a 205 carries a real Content-Encoding token', async () => {
  const out = await run('HTTP/1.1 205 Reset Content\r\nContent-Encoding: gzip\r\n\r\n');
  expect(out.verdict).toBe(Verdict.Warn);
});

test('is skipped as not-applicable on a 304', async () => {
  const out = await run('HTTP/1.1 304 Not Modified\r\nContent-Encoding: gzip\r\n\r\n');
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.NotApplicable);
});

test('is skipped as not-applicable on a 200', async () => {
  const out = await run('HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\n\r\n');
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.NotApplicable);
});

test('is skipped as not-applicable on a 206', async () => {
  const out = await run('HTTP/1.1 206 Partial Content\r\nContent-Encoding: gzip\r\n\r\n');
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.NotApplicable);
});

test('passes a 204 with no Content-Encoding', async () => {
  const out = await run('HTTP/1.1 204 No Content\r\n\r\n');
  expect(out.verdict).toBe(Verdict.Pass);
});
