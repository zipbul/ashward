import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { replay, res } from '../testkit/replay';
import { locationRedirectNoUserinfo } from './location-redirect-no-userinfo';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const run = async (status: string, fields: string) =>
  locationRedirectNoUserinfo.run({ probe: replay(res(status, fields)), target: TARGET });

test('fails a 302 whose Location carries userinfo', async () => {
  expect((await run('302 Found', 'Location: https://user:pass@evil.test/next')).verdict).toBe(Verdict.Fail);
});

test('fails a scheme-relative Location that carries userinfo', async () => {
  expect((await run('302 Found', 'Location: //user:pass@evil.test/next')).verdict).toBe(Verdict.Fail);
});

test('passes a 302 whose Location has no userinfo', async () => {
  expect((await run('302 Found', 'Location: https://safe.test/next')).verdict).toBe(Verdict.Pass);
});

test('passes a relative Location (no authority, so no userinfo)', async () => {
  expect((await run('302 Found', 'Location: /next?to=@nope')).verdict).toBe(Verdict.Pass);
});

test('skips a non-redirect response', async () => {
  const out = await run('200 OK', 'Location: https://user@x.test/');
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.HeaderAbsent);
});

test('skips a redirect with no Location', async () => {
  expect((await run('302 Found', 'X-Other: y')).verdict).toBe(Verdict.Skip);
});
