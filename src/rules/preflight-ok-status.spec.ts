import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { preflightOkStatus } from './preflight-ok-status';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const head = (status: string, fields: string): string => `HTTP/1.1 ${status}\r\n${fields}\r\n\r\n`;
const run = async (status: string, fields: string) =>
  preflightOkStatus.run({ probe: replay(head(status, fields)), target: TARGET });

const GRANT = 'Access-Control-Allow-Origin: https://x.test';

test('passes a 200 preflight that grants ACAO', async () => {
  expect((await run('200 OK', GRANT)).verdict).toBe(Verdict.Pass);
});

test('passes a 204 preflight that grants ACAO', async () => {
  expect((await run('204 No Content', GRANT)).verdict).toBe(Verdict.Pass);
});

test('fails a 403 preflight that still grants ACAO (a browser preflight would network-error)', async () => {
  expect((await run('403 Forbidden', GRANT)).verdict).toBe(Verdict.Fail);
});

test('fails a non-2xx preflight that speaks CORS via ACAM even without ACAO', async () => {
  expect((await run('403 Forbidden', 'Access-Control-Allow-Methods: DELETE')).verdict).toBe(Verdict.Fail);
});

test('skips a non-2xx preflight with no grant (server is simply not sharing)', async () => {
  const out = await run('404 Not Found', 'X-Other: y');
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.HeaderAbsent);
});
