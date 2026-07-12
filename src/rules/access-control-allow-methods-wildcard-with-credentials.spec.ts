import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { Rule, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { accessControlAllowMethodsWildcardWithCredentials } from './access-control-allow-methods-wildcard-with-credentials';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const head = (fields: string): string => `HTTP/1.1 200 OK\r\n${fields}\r\n\r\n`;
const run = async (fields: string) =>
  accessControlAllowMethodsWildcardWithCredentials.run({ probe: replay(head(fields)), target: TARGET });

test('fails on Access-Control-Allow-Methods: * with credentials true', async () => {
  expect((await run('Access-Control-Allow-Methods: *\r\nAccess-Control-Allow-Credentials: true')).verdict).toBe(Verdict.Fail);
});

test('passes on a concrete method list with credentials', async () => {
  expect((await run('Access-Control-Allow-Methods: GET, PUT\r\nAccess-Control-Allow-Credentials: true')).verdict).toBe(
    Verdict.Pass,
  );
});

test('reports its own rule id', async () => {
  expect((await run('Access-Control-Allow-Methods: *')).ruleId).toBe(Rule.AccessControlAllowMethodsWildcardWithCredentials);
});
