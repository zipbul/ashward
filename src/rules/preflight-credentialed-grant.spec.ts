import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { PROBE_ORIGIN } from './kit/probe-fixtures';
import { preflightCredentialedGrant } from './preflight-credentialed-grant';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const head = (fields: string): string => `HTTP/1.1 200 OK\r\n${fields}\r\n\r\n`;
// Probe order is preflight (OPTIONS) then actual (GET).
const run = async (preflight: string, actual: string) =>
  preflightCredentialedGrant.run({ probe: replay(head(preflight), head(actual)), target: TARGET });

const CREDENTIALED = `Access-Control-Allow-Origin: ${PROBE_ORIGIN}\r\nAccess-Control-Allow-Credentials: true`;

test('fails when the actual grants credentials to us but the preflight does not', async () => {
  expect((await run('X-Other: y', CREDENTIALED)).verdict).toBe(Verdict.Fail);
});

test('passes when both the preflight and the actual grant credentials', async () => {
  expect((await run(CREDENTIALED, CREDENTIALED)).verdict).toBe(Verdict.Pass);
});

test('skips when the actual reveals no credentialed grant to us', async () => {
  const out = await run('X-Other: y', 'Access-Control-Allow-Origin: *');
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.HeaderAbsent);
});
