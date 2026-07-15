import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { compressedEtagWeakOrDistinct } from './compressed-etag-weak-or-distinct';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const run = async (a: string, b: string) => compressedEtagWeakOrDistinct.run({ probe: replay(a, b), target: TARGET });

test('fails when the compressed and uncompressed representations share the same strong ETag', async () => {
  const out = await run(
    'HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\nETag: "v1"\r\n\r\n',
    'HTTP/1.1 200 OK\r\nETag: "v1"\r\n\r\n',
  );
  expect(out.verdict).toBe(Verdict.Fail);
});

test('passes a properly weak-marked ETag that is distinct from the uncompressed one', async () => {
  const out = await run(
    'HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\nETag: W/"v1"\r\n\r\n',
    'HTTP/1.1 200 OK\r\nETag: "v2"\r\n\r\n',
  );
  expect(out.verdict).toBe(Verdict.Pass);
});

test('is skipped as not-applicable when the compressed response has no ETag', async () => {
  const out = await run('HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\n\r\n', 'HTTP/1.1 200 OK\r\nETag: "v1"\r\n\r\n');
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.NotApplicable);
});

test('is skipped as not-compressed when the gzip-requesting probe was not actually compressed', async () => {
  const out = await run('HTTP/1.1 200 OK\r\nETag: "v1"\r\n\r\n', 'HTTP/1.1 200 OK\r\nETag: "v1"\r\n\r\n');
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.NotCompressed);
});

test('is skipped as same-representation when the identity-requesting probe is also compressed', async () => {
  const out = await run(
    'HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\nETag: "v1"\r\n\r\n',
    'HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\nETag: "v1"\r\n\r\n',
  );
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.SameRepresentation);
});

test('is skipped as out-of-scope on a malformed lowercase weak prefix (ETag-grammar validation is a non-goal)', async () => {
  const out = await run(
    'HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\nETag: w/"v1"\r\n\r\n',
    'HTTP/1.1 200 OK\r\nETag: "v1"\r\n\r\n',
  );
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.OutOfScope);
});
