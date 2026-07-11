import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { accessControlExposeHeadersTokenList } from './access-control-expose-headers-token-list';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const head = (fields: string): string => `HTTP/1.1 200 OK\r\n${fields}\r\n\r\n`;
const run = async (fields: string) => accessControlExposeHeadersTokenList.run({ probe: replay(head(fields)), target: TARGET });

test('passes a well-formed exposed-header list', async () => {
  expect((await run('Access-Control-Expose-Headers: X-Total, X-Page')).verdict).toBe(Verdict.Pass);
});

test('fails a non-token element', async () => {
  expect((await run('Access-Control-Expose-Headers: X Total')).verdict).toBe(Verdict.Fail);
});

test('skips when the header is absent', async () => {
  const out = await run('X-Other: y');
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.HeaderAbsent);
});

test('reports its own rule id', async () => {
  expect((await run('Access-Control-Expose-Headers: X-Total')).ruleId).toBe(Rule.AccessControlExposeHeadersTokenList);
});
