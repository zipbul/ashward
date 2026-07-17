import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { parseUriGenericQuery } from '../normative/urlencoded';
import { capturingProbe, jsonHead, replay } from '../testkit/replay';
import { defineReflectRule } from './kit/reflect-rule';
import { uriGenericPlusIsLiteral } from './uri-generic-plus-is-literal';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/echo', timeoutMs: 500 };

/** §2.4 Unmarked→Warn (uri-generic): "+" is an ordinary data octet, never substituted for a space.
 *  `expectedPairs` is ALWAYS derived by calling the uri-generic oracle on `rawQuery`. */
const VECTORS: readonly string[] = ['a=1+2', 'a=%2B', 'a=1+2+3'];

for (const rawQuery of VECTORS) {
  const expectedPairs = parseUriGenericQuery(rawQuery);
  const rule =
    rawQuery === 'a=1+2'
      ? uriGenericPlusIsLiteral
      : defineReflectRule({
          id: uriGenericPlusIsLiteral.id,
          normative: uriGenericPlusIsLiteral.normative,
          mode: 'uri-generic',
          rawQuery,
          expectedPairs,
        });

  test(`passes on rawQuery ${JSON.stringify(rawQuery)} when the echo matches the oracle and crafts exactly "GET ${TARGET.path}?${rawQuery} HTTP/1.1"`, async () => {
    const { probe, sentLine } = capturingProbe(`${jsonHead('200 OK')}${JSON.stringify(expectedPairs)}`);
    const out = await rule.run({ probe, target: TARGET, reflect: { mode: 'uri-generic' } });
    expect(sentLine()).toBe(`GET ${TARGET.path}?${rawQuery} HTTP/1.1`);
    expect(out.verdict).toBe(Verdict.Pass);
  });
}

test('fails when the echo wrongly decodes + as a space (the catalog maps this clause to Warn severity, not the rule verdict)', async () => {
  const out = await uriGenericPlusIsLiteral.run({
    probe: replay(`${jsonHead('200 OK')}${JSON.stringify([['a', '1 2']])}`),
    target: TARGET,
    reflect: { mode: 'uri-generic' },
  });
  expect(out.verdict).toBe(Verdict.Fail);
});

test('is skipped as endpoint-not-reflecting when reflect is opted into form mode instead', async () => {
  const out = await uriGenericPlusIsLiteral.run({
    probe: replay(`${jsonHead('200 OK')}${JSON.stringify(parseUriGenericQuery('a=1+2'))}`),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointNotReflecting);
});
