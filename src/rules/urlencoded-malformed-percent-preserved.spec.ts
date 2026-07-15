import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { parseFormUrlencoded } from '../normative/urlencoded';
import { capturingProbe, replay } from '../testkit/replay';
import { defineReflectRule } from './kit/reflect-rule';
import { urlencodedMalformedPercentPreserved } from './urlencoded-malformed-percent-preserved';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/echo', timeoutMs: 500 };
const head = (status: string): string => `HTTP/1.1 ${status}\r\nContent-Type: application/json\r\n\r\n`;

/** §2.6 MUST: a "%" not followed by two hex digits is preserved literally, never consumed past the
 *  "%" itself. `expectedPairs` is ALWAYS derived by calling the oracle on `rawQuery`. */
const VECTORS: readonly string[] = ['a=%ZZ%41', 'a=%zz', 'a=%4'];

for (const rawQuery of VECTORS) {
  const expectedPairs = parseFormUrlencoded(rawQuery);
  const rule =
    rawQuery === 'a=%ZZ%41'
      ? urlencodedMalformedPercentPreserved
      : defineReflectRule({
          id: urlencodedMalformedPercentPreserved.id,
          normative: urlencodedMalformedPercentPreserved.normative,
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
    probe: replay(`${head('200 OK')}${JSON.stringify(parseFormUrlencoded('a=%ZZ%41'))}`),
    target: TARGET,
  });
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointNotReflecting);
});
