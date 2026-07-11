import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { accessControlAllowOriginWildcardWithCredentials } from './access-control-allow-origin-wildcard-with-credentials';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const head = (fields: string): string => `HTTP/1.1 200 OK\r\n${fields}\r\n\r\n`;
const run = async (fields: string) =>
  accessControlAllowOriginWildcardWithCredentials.run({ probe: replay(head(fields)), target: TARGET });

test('fails on Access-Control-Allow-Origin: * with credentials true', async () => {
  expect((await run('Access-Control-Allow-Origin: *\r\nAccess-Control-Allow-Credentials: true')).verdict).toBe(Verdict.Fail);
});

test('passes on * without credentials', async () => {
  expect((await run('Access-Control-Allow-Origin: *')).verdict).toBe(Verdict.Pass);
});

test('skips when Access-Control-Allow-Origin is absent', async () => {
  const out = await run('X-Other: y');
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.HeaderAbsent);
});

test('reports its own rule id', async () => {
  expect((await run('Access-Control-Allow-Origin: *')).ruleId).toBe(Rule.AccessControlAllowOriginWildcardWithCredentials);
});
