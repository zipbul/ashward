import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { varyOrigin } from './vary-origin';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const head = (fields: string): string => `HTTP/1.1 200 OK\r\n${fields}\r\n\r\n`;
const run = async (first: string, second: string) => varyOrigin.run({ probe: replay(head(first), head(second)), target: TARGET });

test('warns when ACAO depends on Origin but Vary: Origin is missing', async () => {
  const out = await run('Access-Control-Allow-Origin: https://a.test', 'Access-Control-Allow-Origin: https://b.test');
  expect(out.verdict).toBe(Verdict.Warn);
});

test('passes when an origin-dependent ACAO carries Vary: Origin on both responses', async () => {
  const out = await run(
    'Access-Control-Allow-Origin: https://a.test\r\nVary: Origin',
    'Access-Control-Allow-Origin: https://b.test\r\nVary: Origin',
  );
  expect(out.verdict).toBe(Verdict.Pass);
});

test('passes a static ACAO (same for both origins) with no Vary', async () => {
  const fixed = 'Access-Control-Allow-Origin: https://app.example';
  expect((await run(fixed, fixed)).verdict).toBe(Verdict.Pass);
});
