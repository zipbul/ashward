import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { Rule, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { accessControlAllowHeadersWildcardWithCredentials } from './access-control-allow-headers-wildcard-with-credentials';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const head = (fields: string): string => `HTTP/1.1 200 OK\r\n${fields}\r\n\r\n`;
const run = async (fields: string) =>
  accessControlAllowHeadersWildcardWithCredentials.run({ probe: replay(head(fields)), target: TARGET });

test('fails on Access-Control-Allow-Headers: * with credentials true', async () => {
  expect((await run('Access-Control-Allow-Headers: *\r\nAccess-Control-Allow-Credentials: true')).verdict).toBe(Verdict.Fail);
});

test('passes on a concrete header list with credentials', async () => {
  expect((await run('Access-Control-Allow-Headers: X-A, X-B\r\nAccess-Control-Allow-Credentials: true')).verdict).toBe(
    Verdict.Pass,
  );
});

test('reports its own rule id', async () => {
  expect((await run('Access-Control-Allow-Headers: *')).ruleId).toBe(Rule.AccessControlAllowHeadersWildcardWithCredentials);
});
