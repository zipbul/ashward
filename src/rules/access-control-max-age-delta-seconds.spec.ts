import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { head, replay } from '../testkit/replay';
import { accessControlMaxAgeDeltaSeconds } from './access-control-max-age-delta-seconds';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const run = async (fields: string) => accessControlMaxAgeDeltaSeconds.run({ probe: replay(head(fields)), target: TARGET });

test('passes a delta-seconds value', async () => {
  expect((await run('Access-Control-Max-Age: 600')).verdict).toBe(Verdict.Pass);
});

test('passes zero', async () => {
  expect((await run('Access-Control-Max-Age: 0')).verdict).toBe(Verdict.Pass);
});

test('fails a value with units', async () => {
  expect((await run('Access-Control-Max-Age: 10m')).verdict).toBe(Verdict.Fail);
});

test('fails a negative value', async () => {
  expect((await run('Access-Control-Max-Age: -1')).verdict).toBe(Verdict.Fail);
});

test('skips when Access-Control-Max-Age is absent', async () => {
  const out = await run('X-Other: y');
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.HeaderAbsent);
});
