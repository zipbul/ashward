import { test, expect } from 'bun:test';

import type { HttpTarget } from '../../http/context';

import { Rule, SkipReason, Verdict } from '../../core/contract/enums';
import { FetchClauseId } from '../../standards/catalog/fetch';
import { head, replay } from '../../testkit/replay';
import { defineTokenListRule } from './token-list';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const rule = defineTokenListRule({
  id: Rule.AccessControlAllowMethodsTokenList,
  header: 'Access-Control-Allow-Methods',
  probes: [{ kind: 'preflight', origin: 'https://x.test', requestMethod: 'GET' }],
  clauses: [FetchClauseId.ListHeaderTokenGrammar],
});
const run = async (fields: string) => rule.run({ probe: replay(head(fields)), target: TARGET });

test('passes a well-formed token list', async () => {
  expect((await run('Access-Control-Allow-Methods: GET, POST, DELETE')).verdict).toBe(Verdict.Pass);
});

test('passes a bare wildcard (* is a valid tchar)', async () => {
  expect((await run('Access-Control-Allow-Methods: *')).verdict).toBe(Verdict.Pass);
});

test('fails an empty list element from a double comma', async () => {
  expect((await run('Access-Control-Allow-Methods: GET,, POST')).verdict).toBe(Verdict.Fail);
});

test('fails a non-token element (contains a space)', async () => {
  expect((await run('Access-Control-Allow-Methods: GET POST')).verdict).toBe(Verdict.Fail);
});

test('passes an entirely empty value as the legal zero-element list', async () => {
  expect((await run('Access-Control-Allow-Methods:')).verdict).toBe(Verdict.Pass);
});

test('fails when duplicate field lines combine into an empty element', async () => {
  const out = await run('Access-Control-Allow-Methods: GET\r\nAccess-Control-Allow-Methods:');
  expect(out.verdict).toBe(Verdict.Fail);
});

test('skips with header-absent when the header is not sent', async () => {
  const out = await run('X-Other: y');
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.HeaderAbsent);
});
