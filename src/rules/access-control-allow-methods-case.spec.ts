import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { accessControlAllowMethodsCase } from './access-control-allow-methods-case';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const head = (fields: string): string => `HTTP/1.1 200 OK\r\n${fields}\r\n\r\n`;
const run = async (fields: string) => accessControlAllowMethodsCase.run({ probe: replay(head(fields)), target: TARGET });

test('passes when the previewed PATCH is echoed byte-exactly', async () => {
  expect((await run('Access-Control-Allow-Methods: PATCH')).verdict).toBe(Verdict.Pass);
});

test('fails when PATCH is lowercased to patch (byte mismatch breaks the preflight)', async () => {
  expect((await run('Access-Control-Allow-Methods: patch')).verdict).toBe(Verdict.Fail);
});

test('skips when the previewed method is not listed at all', async () => {
  const out = await run('Access-Control-Allow-Methods: GET, POST');
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.HeaderAbsent);
});

test('skips when Access-Control-Allow-Methods is absent', async () => {
  expect((await run('X-Other: y')).verdict).toBe(Verdict.Skip);
});
