import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { Rule, Verdict } from '../core/contract/enums';
import { head, replay } from '../testkit/replay';
import { accessControlExposeHeadersWildcardWithCredentials } from './access-control-expose-headers-wildcard-with-credentials';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const run = async (fields: string) =>
  accessControlExposeHeadersWildcardWithCredentials.run({ probe: replay(head(fields)), target: TARGET });

test('fails on Access-Control-Expose-Headers: * with credentials true', async () => {
  expect((await run('Access-Control-Expose-Headers: *\r\nAccess-Control-Allow-Credentials: true')).verdict).toBe(Verdict.Fail);
});

test('passes on a concrete exposed-header list with credentials', async () => {
  expect((await run('Access-Control-Expose-Headers: X-Total\r\nAccess-Control-Allow-Credentials: true')).verdict).toBe(
    Verdict.Pass,
  );
});

test('reports its own rule id', async () => {
  expect((await run('Access-Control-Expose-Headers: *')).ruleId).toBe(Rule.AccessControlExposeHeadersWildcardWithCredentials);
});
