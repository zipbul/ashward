import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { parseFormUrlencoded } from '../normative/urlencoded';
import { capturingProbe, replay } from '../testkit/replay';
import { defineReflectRule } from './kit/reflect-rule';
import { urlencodedUtf8Replacement } from './urlencoded-utf8-replacement';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/echo', timeoutMs: 500 };
const head = (status: string): string => `HTTP/1.1 ${status}\r\nContent-Type: application/json\r\n\r\n`;

/** §2.5 MUST: the percent-decoded bytes are UTF-8 decoded with U+FFFD substituted for invalid
 *  sequences. `expectedPairs` is ALWAYS derived by calling the oracle on `rawQuery`. */
const VECTORS: readonly string[] = ['a=%FF', 'a=%C3%A9', 'a=%E2%82%AC'];

for (const rawQuery of VECTORS) {
  const expectedPairs = parseFormUrlencoded(rawQuery);
  const rule =
    rawQuery === 'a=%FF'
      ? urlencodedUtf8Replacement
      : defineReflectRule({
          id: urlencodedUtf8Replacement.id,
          normative: urlencodedUtf8Replacement.normative,
          mode: 'form',
          rawQuery,
          expectedPairs,
        });

  test(`passes on rawQuery ${JSON.stringify(rawQuery)} when the echo matches the oracle and crafts exactly "GET ${TARGET.path}?${rawQuery} HTTP/1.1"`, async () => {
    const { probe, sentLine } = capturingProbe(`${head('200 OK')}${JSON.stringify(expectedPairs)}`);
    const out = await rule.run({ probe, target: TARGET, reflect: { mode: 'form' } });
    expect(sentLine()).toBe(`GET ${TARGET.path}?${rawQuery} HTTP/1.1`);
    expect(out.verdict).toBe(Verdict.Pass);
  });
}

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
