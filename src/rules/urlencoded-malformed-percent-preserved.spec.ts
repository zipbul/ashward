import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { urlencodedMalformedPercentPreserved } from './urlencoded-malformed-percent-preserved';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/echo', timeoutMs: 500 };
const head = (status: string): string => `HTTP/1.1 ${status}\r\nContent-Type: application/json\r\n\r\n`;

test('passes when the echo preserves the malformed escape literally', async () => {
  const out = await urlencodedMalformedPercentPreserved.run({
    probe: replay(`${head('200 OK')}${JSON.stringify([['a', '%ZZA']])}`),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Pass);
});

test('fails when the echo drops the malformed escape', async () => {
  const out = await urlencodedMalformedPercentPreserved.run({
    probe: replay(`${head('200 OK')}${JSON.stringify([['a', 'A']])}`),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Fail);
});

test('is skipped as endpoint-not-reflecting when reflect is not opted in', async () => {
  const out = await urlencodedMalformedPercentPreserved.run({
    probe: replay(`${head('200 OK')}${JSON.stringify([['a', '%ZZA']])}`),
    target: TARGET,
  });
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointNotReflecting);
});
