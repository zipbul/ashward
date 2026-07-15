import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { urlencodedPlusIsSpace } from './urlencoded-plus-is-space';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/echo', timeoutMs: 500 };
const head = (status: string): string => `HTTP/1.1 ${status}\r\nContent-Type: application/json\r\n\r\n`;

test('passes when the echo decodes + as a space', async () => {
  const out = await urlencodedPlusIsSpace.run({
    probe: replay(`${head('200 OK')}${JSON.stringify([['a', '1 2']])}`),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Pass);
});

test('fails when the echo leaves + as a literal character', async () => {
  const out = await urlencodedPlusIsSpace.run({
    probe: replay(`${head('200 OK')}${JSON.stringify([['a', '1+2']])}`),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Fail);
});

test('is skipped as endpoint-not-reflecting when the mode does not match (uri-generic opted, form rule)', async () => {
  const out = await urlencodedPlusIsSpace.run({
    probe: replay(`${head('200 OK')}${JSON.stringify([['a', '1 2']])}`),
    target: TARGET,
    reflect: { mode: 'uri-generic' },
  });
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointNotReflecting);
});
