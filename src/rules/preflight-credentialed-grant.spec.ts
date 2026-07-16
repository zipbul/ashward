import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { head, replay } from '../testkit/replay';
import { PROBE_ORIGIN } from './kit/probe-fixtures';
import { preflightCredentialedGrant } from './preflight-credentialed-grant';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
// Probe order is preflight (OPTIONS) then actual (GET).
const run = async (preflight: string, actual: string) =>
  preflightCredentialedGrant.run({ probe: replay(head(preflight), head(actual)), target: TARGET });

const CREDENTIALED = `Access-Control-Allow-Origin: ${PROBE_ORIGIN}\r\nAccess-Control-Allow-Credentials: true`;
const ECHO_ONLY = `Access-Control-Allow-Origin: ${PROBE_ORIGIN}`;

test('fails when the actual credential-grants us but the echoing preflight omits ACAC:true', async () => {
  expect((await run(ECHO_ONLY, CREDENTIALED)).verdict).toBe(Verdict.Fail);
});

test('passes when both the preflight and the actual credential-grant us', async () => {
  expect((await run(CREDENTIALED, CREDENTIALED)).verdict).toBe(Verdict.Pass);
});

test('skips when the actual reveals no credentialed grant to us', async () => {
  const out = await run(ECHO_ONLY, 'Access-Control-Allow-Origin: *');
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.HeaderAbsent);
});

test('skips when the preflight does not speak CORS to us (server does not preflight our requests)', async () => {
  expect((await run('X-Other: y', CREDENTIALED)).verdict).toBe(Verdict.Skip);
});
