import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { head, replay } from '../testkit/replay';
import { accessControlAllowHeadersTokenList } from './access-control-allow-headers-token-list';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const run = async (fields: string) => accessControlAllowHeadersTokenList.run({ probe: replay(head(fields)), target: TARGET });

test('passes a well-formed header list', async () => {
  expect((await run('Access-Control-Allow-Headers: X-A, X-B')).verdict).toBe(Verdict.Pass);
});

test('fails a trailing empty element', async () => {
  expect((await run('Access-Control-Allow-Headers: X-A,')).verdict).toBe(Verdict.Fail);
});

test('skips when the header is absent', async () => {
  const out = await run('X-Other: y');
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.HeaderAbsent);
});

test('reports its own rule id', async () => {
  expect((await run('Access-Control-Allow-Headers: X-A')).ruleId).toBe(Rule.AccessControlAllowHeadersTokenList);
});
