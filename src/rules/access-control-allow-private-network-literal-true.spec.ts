import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { head, replay } from '../testkit/replay';
import { accessControlAllowPrivateNetworkLiteralTrue } from './access-control-allow-private-network-literal-true';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const run = async (fields: string) =>
  accessControlAllowPrivateNetworkLiteralTrue.run({ probe: replay(head(fields)), target: TARGET });

test('passes the literal bytes true', async () => {
  expect((await run('Access-Control-Allow-Private-Network: true')).verdict).toBe(Verdict.Pass);
});

test('fails capitalized True', async () => {
  expect((await run('Access-Control-Allow-Private-Network: True')).verdict).toBe(Verdict.Fail);
});

test('fails a repeated header (two lines combine to "true, true", not the literal true)', async () => {
  const out = await run('Access-Control-Allow-Private-Network: true\r\nAccess-Control-Allow-Private-Network: true');
  expect(out.verdict).toBe(Verdict.Fail);
});

test('skips when Access-Control-Allow-Private-Network is absent', async () => {
  const out = await run('X-Other: y');
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.HeaderAbsent);
});
