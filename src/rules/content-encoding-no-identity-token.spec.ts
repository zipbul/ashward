import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { contentEncodingNoIdentityToken } from './content-encoding-no-identity-token';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const head = (fields: string): string => `HTTP/1.1 200 OK\r\n${fields}\r\n\r\n`;
const run = async (fields: string) => contentEncodingNoIdentityToken.run({ probe: replay(head(fields)), target: TARGET });

test('warns when Content-Encoding carries the identity token', async () => {
  const out = await run('Content-Encoding: identity');
  expect(out.verdict).toBe(Verdict.Warn);
});

test('passes when Content-Encoding is gzip', async () => {
  const out = await run('Content-Encoding: gzip');
  expect(out.verdict).toBe(Verdict.Pass);
});

test('is skipped with header-absent when Content-Encoding is missing', async () => {
  const out = await run('');
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.HeaderAbsent);
});

test('warns on the identity token regardless of case and surrounding whitespace', async () => {
  const out = await run('Content-Encoding:  IDENTITY  ');
  expect(out.verdict).toBe(Verdict.Warn);
});

test('passes when the token is identityx (not the identity token)', async () => {
  const out = await run('Content-Encoding: identityx');
  expect(out.verdict).toBe(Verdict.Pass);
});

test('passes when the token is x-identity (not the identity token)', async () => {
  const out = await run('Content-Encoding: x-identity');
  expect(out.verdict).toBe(Verdict.Pass);
});
