import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { head, replay } from '../testkit/replay';
import { accessControlExposeHeadersPreflightOnly } from './access-control-expose-headers-preflight-only';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
// Probe order is actual (GET) then preflight (OPTIONS).
const run = async (actual: string, preflight: string) =>
  accessControlExposeHeadersPreflightOnly.run({ probe: replay(head(actual), head(preflight)), target: TARGET });

test('fails when ACEH is only on the preflight while the actual is shared to us', async () => {
  const out = await run('Access-Control-Allow-Origin: *', 'Access-Control-Expose-Headers: X-Total');
  expect(out.verdict).toBe(Verdict.Fail);
});

test('passes when ACEH is on the actual response', async () => {
  expect((await run('Access-Control-Expose-Headers: X-Total', 'X-Other: y')).verdict).toBe(Verdict.Pass);
});

test('fails when the actual ACEH is empty (exposes nothing) but the preflight lists one', async () => {
  const out = await run(
    'Access-Control-Allow-Origin: *\r\nAccess-Control-Expose-Headers:',
    'Access-Control-Expose-Headers: X-Total',
  );
  expect(out.verdict).toBe(Verdict.Fail);
});

test('skips when ACEH is on the preflight but the actual is not a grant to us', async () => {
  const out = await run('X-Other: y', 'Access-Control-Expose-Headers: X-Total');
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.HeaderAbsent);
});

test('skips when ACEH is on neither response', async () => {
  expect((await run('X-Other: y', 'X-Other: y')).verdict).toBe(Verdict.Skip);
});
