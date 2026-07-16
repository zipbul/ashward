import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { parseFormUrlencoded } from '../normative/urlencoded';
import { capturingProbe, jsonHead, replay } from '../testkit/replay';
import { defineReflectRule } from './kit/reflect-rule';
import { urlencodedPlusIsSpace } from './urlencoded-plus-is-space';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/echo', timeoutMs: 500 };

/** §2.4 MUST (form): "+" decodes to a space. `expectedPairs` is ALWAYS derived by calling the
 *  oracle on `rawQuery`. */
const VECTORS: readonly string[] = ['a=1+2', 'a=%2B', 'a=1+2+3'];

for (const rawQuery of VECTORS) {
  const expectedPairs = parseFormUrlencoded(rawQuery);
  const rule =
    rawQuery === 'a=1+2'
      ? urlencodedPlusIsSpace
      : defineReflectRule({
          id: urlencodedPlusIsSpace.id,
          normative: urlencodedPlusIsSpace.normative,
          mode: 'form',
          rawQuery,
          expectedPairs,
        });

  test(`passes on rawQuery ${JSON.stringify(rawQuery)} when the echo matches the oracle and crafts exactly "GET ${TARGET.path}?${rawQuery} HTTP/1.1"`, async () => {
    const { probe, sentLine } = capturingProbe(`${jsonHead('200 OK')}${JSON.stringify(expectedPairs)}`);
    const out = await rule.run({ probe, target: TARGET, reflect: { mode: 'form' } });
    expect(sentLine()).toBe(`GET ${TARGET.path}?${rawQuery} HTTP/1.1`);
    expect(out.verdict).toBe(Verdict.Pass);
  });
}

test('fails when the echo leaves + as a literal character', async () => {
  const out = await urlencodedPlusIsSpace.run({
    probe: replay(`${jsonHead('200 OK')}${JSON.stringify([['a', '1+2']])}`),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Fail);
});

test('is skipped as endpoint-not-reflecting when the mode does not match (uri-generic opted, form rule)', async () => {
  const out = await urlencodedPlusIsSpace.run({
    probe: replay(`${jsonHead('200 OK')}${JSON.stringify(parseFormUrlencoded('a=1+2'))}`),
    target: TARGET,
    reflect: { mode: 'uri-generic' },
  });
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointNotReflecting);
});
