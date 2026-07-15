import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { varyAcceptEncodingOnNegotiated } from './vary-accept-encoding-on-negotiated';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const run = async (a: string, b: string) => varyAcceptEncodingOnNegotiated.run({ probe: replay(a, b), target: TARGET });

test('warns when the negotiated gzip variant is cacheable but lacks Vary: Accept-Encoding', async () => {
  const out = await run('HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\n\r\n', 'HTTP/1.1 200 OK\r\n\r\n');
  expect(out.verdict).toBe(Verdict.Warn);
});

test('passes when both the gzip and identity variants carry Vary: Accept-Encoding', async () => {
  const out = await run(
    'HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\nVary: Accept-Encoding\r\n\r\n',
    'HTTP/1.1 200 OK\r\nVary: Accept-Encoding\r\n\r\n',
  );
  expect(out.verdict).toBe(Verdict.Pass);
});

test('is skipped as not-cacheable on Cache-Control: no-store (never private)', async () => {
  const out = await run(
    'HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\nCache-Control: no-store\r\n\r\n',
    'HTTP/1.1 200 OK\r\n\r\n',
  );
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.NotCacheable);
});

test('a private (but not no-store) cacheable pair is still judged, not skipped', async () => {
  const out = await run(
    'HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\nCache-Control: private\r\n\r\n',
    'HTTP/1.1 200 OK\r\nCache-Control: private\r\n\r\n',
  );
  expect(out.verdict).toBe(Verdict.Warn);
});

test('is skipped as not-negotiated when neither variant is compressed', async () => {
  const out = await run('HTTP/1.1 200 OK\r\n\r\n', 'HTTP/1.1 200 OK\r\n\r\n');
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.NotNegotiated);
});

test('is skipped as not-negotiated when the identity-requesting probe still gets gzip', async () => {
  const out = await run('HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\n\r\n', 'HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\n\r\n');
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.NotNegotiated);
});

test('is skipped as endpoint-unstable when the identity probe 500s', async () => {
  const out = await run('HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\n\r\n', 'HTTP/1.1 500 Internal Server Error\r\n\r\n');
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointUnstable);
});
