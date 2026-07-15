import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { uriGenericPlusIsLiteral } from './uri-generic-plus-is-literal';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/echo', timeoutMs: 500 };
const head = (status: string): string => `HTTP/1.1 ${status}\r\nContent-Type: application/json\r\n\r\n`;

test('passes when the uri-generic echo keeps + as a literal character', async () => {
  const out = await uriGenericPlusIsLiteral.run({
    probe: replay(`${head('200 OK')}${JSON.stringify([['a', '1+2']])}`),
    target: TARGET,
    reflect: { mode: 'uri-generic' },
  });
  expect(out.verdict).toBe(Verdict.Pass);
});

test('fails when the echo wrongly decodes + as a space (the catalog maps this clause to Warn severity, not the rule verdict)', async () => {
  const out = await uriGenericPlusIsLiteral.run({
    probe: replay(`${head('200 OK')}${JSON.stringify([['a', '1 2']])}`),
    target: TARGET,
    reflect: { mode: 'uri-generic' },
  });
  expect(out.verdict).toBe(Verdict.Fail);
});

test('is skipped as endpoint-not-reflecting when reflect is opted into form mode instead', async () => {
  const out = await uriGenericPlusIsLiteral.run({
    probe: replay(`${head('200 OK')}${JSON.stringify([['a', '1+2']])}`),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointNotReflecting);
});
