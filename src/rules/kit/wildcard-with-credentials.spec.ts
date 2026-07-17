import { test, expect } from 'bun:test';

import type { HttpTarget } from '../../http/context';

import { Rule, SkipReason, Verdict } from '../../core/contract/enums';
import { FetchClauseId } from '../../standards/catalog/fetch';
import { head, replay } from '../../testkit/replay';
import { defineWildcardWithCredentialsRule } from './wildcard-with-credentials';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const rule = defineWildcardWithCredentialsRule({
  id: Rule.AccessControlAllowMethodsWildcardWithCredentials,
  header: 'Access-Control-Allow-Methods',
  probes: [{ kind: 'preflight', origin: 'https://x.test', requestMethod: 'GET' }],
  clauses: [FetchClauseId.CredentialedNoWildcard],
});
const run = async (fields: string) => rule.run({ probe: replay(head(fields)), target: TARGET });

test('fails when the header is * and credentials are true', async () => {
  const out = await run('Access-Control-Allow-Methods: *\r\nAccess-Control-Allow-Credentials: true');
  expect(out.verdict).toBe(Verdict.Fail);
});

test('passes when the header is * but credentials are absent (public-API shape)', async () => {
  expect((await run('Access-Control-Allow-Methods: *')).verdict).toBe(Verdict.Pass);
});

test('passes when the value is a concrete list even with credentials', async () => {
  const out = await run('Access-Control-Allow-Methods: GET, POST\r\nAccess-Control-Allow-Credentials: true');
  expect(out.verdict).toBe(Verdict.Pass);
});

test('fails on * with a repeated ACAC whose lines include true', async () => {
  const out = await run(
    'Access-Control-Allow-Methods: *\r\nAccess-Control-Allow-Credentials: true\r\nAccess-Control-Allow-Credentials: true',
  );
  expect(out.verdict).toBe(Verdict.Fail);
});

test('skips with header-absent when the header is not sent', async () => {
  const out = await run('X-Other: y');
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.HeaderAbsent);
});

test('carries the configured rule id', async () => {
  expect((await run('Access-Control-Allow-Methods: *')).ruleId).toBe(Rule.AccessControlAllowMethodsWildcardWithCredentials);
});
