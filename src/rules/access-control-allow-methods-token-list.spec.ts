import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { accessControlAllowMethodsTokenList } from './access-control-allow-methods-token-list';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const head = (fields: string): string => `HTTP/1.1 200 OK\r\n${fields}\r\n\r\n`;
const run = async (fields: string) => accessControlAllowMethodsTokenList.run({ probe: replay(head(fields)), target: TARGET });

test('passes a well-formed method list', async () => {
  expect((await run('Access-Control-Allow-Methods: GET, POST')).verdict).toBe(Verdict.Pass);
});

test('fails an empty list element', async () => {
  expect((await run('Access-Control-Allow-Methods: GET,,POST')).verdict).toBe(Verdict.Fail);
});

test('skips when the header is absent', async () => {
  const out = await run('X-Other: y');
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.HeaderAbsent);
});

test('reports its own rule id', async () => {
  expect((await run('Access-Control-Allow-Methods: GET')).ruleId).toBe(Rule.AccessControlAllowMethodsTokenList);
});
