import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { head, replay } from '../testkit/replay';
import { accessControlAllowOriginGrammar } from './access-control-allow-origin-grammar';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const run = async (fields: string) => accessControlAllowOriginGrammar.run({ probe: replay(head(fields)), target: TARGET });

test('passes the wildcard', async () => {
  expect((await run('Access-Control-Allow-Origin: *')).verdict).toBe(Verdict.Pass);
});

test('passes the exact lowercase null', async () => {
  expect((await run('Access-Control-Allow-Origin: null')).verdict).toBe(Verdict.Pass);
});

test('passes a valid serialized origin', async () => {
  expect((await run('Access-Control-Allow-Origin: https://app.example:8080')).verdict).toBe(Verdict.Pass);
});

test('fails a trailing slash (not a bare origin)', async () => {
  expect((await run('Access-Control-Allow-Origin: https://app.example/')).verdict).toBe(Verdict.Fail);
});

test('fails uppercase NULL (null is lowercase-only)', async () => {
  expect((await run('Access-Control-Allow-Origin: NULL')).verdict).toBe(Verdict.Fail);
});

test('fails a comma-separated list (no list grammar)', async () => {
  expect((await run('Access-Control-Allow-Origin: https://a.test, https://b.test')).verdict).toBe(Verdict.Fail);
});

test('skips when Access-Control-Allow-Origin is absent', async () => {
  const out = await run('X-Other: y');
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.HeaderAbsent);
});

test('reports its own rule id', async () => {
  expect((await run('Access-Control-Allow-Origin: *')).ruleId).toBe(Rule.AccessControlAllowOriginGrammar);
});
