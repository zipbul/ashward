import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { urlencodedAmpersandOnlySeparator } from './urlencoded-ampersand-only-separator';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/echo', timeoutMs: 500 };
const head = (status: string): string => `HTTP/1.1 ${status}\r\nContent-Type: application/json\r\n\r\n`;

test('passes when the echo correctly does not split on the semicolon', async () => {
  const out = await urlencodedAmpersandOnlySeparator.run({
    probe: replay(`${head('200 OK')}${JSON.stringify([['a', '1;b=2']])}`),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Pass);
});

test('fails when the echo wrongly splits on the semicolon', async () => {
  const out = await urlencodedAmpersandOnlySeparator.run({
    probe: replay(
      `${head('200 OK')}${JSON.stringify([
        ['a', '1'],
        ['b', '2'],
      ])}`,
    ),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Fail);
});

test('is skipped as endpoint-not-reflecting when reflect is not opted in', async () => {
  const out = await urlencodedAmpersandOnlySeparator.run({
    probe: replay(`${head('200 OK')}${JSON.stringify([['a', '1;b=2']])}`),
    target: TARGET,
  });
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointNotReflecting);
});

test('is skipped as endpoint-not-reflecting on a non-2xx response', async () => {
  const out = await urlencodedAmpersandOnlySeparator.run({
    probe: replay(`${head('404 Not Found')}${JSON.stringify([['a', '1;b=2']])}`),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointNotReflecting);
});
