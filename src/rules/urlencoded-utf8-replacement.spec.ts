import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { urlencodedUtf8Replacement } from './urlencoded-utf8-replacement';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/echo', timeoutMs: 500 };
const head = (status: string): string => `HTTP/1.1 ${status}\r\nContent-Type: application/json\r\n\r\n`;

test('passes when the echo substitutes the invalid byte with U+FFFD', async () => {
  const out = await urlencodedUtf8Replacement.run({
    probe: replay(`${head('200 OK')}${JSON.stringify([['a', '�']])}`),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Pass);
});

test('fails when the echo drops the invalid byte instead of substituting U+FFFD', async () => {
  const out = await urlencodedUtf8Replacement.run({
    probe: replay(`${head('200 OK')}${JSON.stringify([['a', '']])}`),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Fail);
});

test('is skipped as endpoint-not-reflecting when the echo body is not valid JSON', async () => {
  const out = await urlencodedUtf8Replacement.run({
    probe: replay(`${head('200 OK')}<not json>`),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointNotReflecting);
});
