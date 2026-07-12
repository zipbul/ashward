import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { accessControlAllowOriginSingle } from './access-control-allow-origin-single';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const head = (fields: string): string => `HTTP/1.1 200 OK\r\n${fields}\r\n\r\n`;
const run = async (fields: string) => accessControlAllowOriginSingle.run({ probe: replay(head(fields)), target: TARGET });

test('passes a single Access-Control-Allow-Origin', async () => {
  expect((await run('Access-Control-Allow-Origin: https://app.example')).verdict).toBe(Verdict.Pass);
});

test('fails two Access-Control-Allow-Origin field lines', async () => {
  const out = await run('Access-Control-Allow-Origin: https://a.test\r\nAccess-Control-Allow-Origin: https://b.test');
  expect(out.verdict).toBe(Verdict.Fail);
});

test('skips when Access-Control-Allow-Origin is absent', async () => {
  const out = await run('X-Other: y');
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.HeaderAbsent);
});

test('reports its own rule id', async () => {
  expect((await run('Access-Control-Allow-Origin: *')).ruleId).toBe(Rule.AccessControlAllowOriginSingle);
});
