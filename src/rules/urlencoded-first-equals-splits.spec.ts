import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { urlencodedFirstEqualsSplits } from './urlencoded-first-equals-splits';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/echo', timeoutMs: 500 };
const head = (status: string): string => `HTTP/1.1 ${status}\r\nContent-Type: application/json\r\n\r\n`;

test('passes when the echo splits only on the first =', async () => {
  const out = await urlencodedFirstEqualsSplits.run({
    probe: replay(`${head('200 OK')}${JSON.stringify([['a', 'b=c']])}`),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Pass);
});

test('fails when the echo wrongly splits on every =', async () => {
  const out = await urlencodedFirstEqualsSplits.run({
    probe: replay(`${head('200 OK')}${JSON.stringify([['a', 'b']])}`),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Fail);
});

test('is skipped as endpoint-not-reflecting when reflect is not opted in', async () => {
  const out = await urlencodedFirstEqualsSplits.run({
    probe: replay(`${head('200 OK')}${JSON.stringify([['a', 'b=c']])}`),
    target: TARGET,
  });
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointNotReflecting);
});

test('is skipped as endpoint-not-reflecting on a malformed (non-pair-list) body', async () => {
  const out = await urlencodedFirstEqualsSplits.run({
    probe: replay(`${head('200 OK')}not json`),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointNotReflecting);
});
