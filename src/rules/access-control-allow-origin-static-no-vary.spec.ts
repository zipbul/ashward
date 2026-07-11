import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { accessControlAllowOriginStaticNoVary } from './access-control-allow-origin-static-no-vary';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const head = (fields: string): string => `HTTP/1.1 200 OK\r\n${fields}\r\n\r\n`;
const run = async (first: string, second: string) =>
  accessControlAllowOriginStaticNoVary.run({ probe: replay(head(first), head(second)), target: TARGET });

const FIXED = 'Access-Control-Allow-Origin: https://app.example';

test('warns when a static ACAO is paired with Vary: Origin', async () => {
  expect((await run(`${FIXED}\r\nVary: Origin`, FIXED)).verdict).toBe(Verdict.Warn);
});

test('passes a static ACAO with no Vary', async () => {
  expect((await run(FIXED, FIXED)).verdict).toBe(Verdict.Pass);
});

test('passes an origin-dependent ACAO (that is §7.1 territory, not static)', async () => {
  const out = await run('Access-Control-Allow-Origin: https://a.test', 'Access-Control-Allow-Origin: https://b.test');
  expect(out.verdict).toBe(Verdict.Pass);
});

test('skips when ACAO is absent from a probe', async () => {
  const out = await run(FIXED, 'X-Other: y');
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.HeaderAbsent);
});
