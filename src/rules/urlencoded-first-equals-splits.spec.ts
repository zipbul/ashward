import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { parseFormUrlencoded } from '../normative/urlencoded';
import { capturingProbe, replay } from '../testkit/replay';
import { defineReflectRule } from './kit/reflect-rule';
import { urlencodedFirstEqualsSplits } from './urlencoded-first-equals-splits';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/echo', timeoutMs: 500 };
const head = (status: string): string => `HTTP/1.1 ${status}\r\nContent-Type: application/json\r\n\r\n`;

/** §2.3 MUST: split on the FIRST "=" only; a sequence with no "=" gets an empty-string value.
 *  `expectedPairs` is ALWAYS derived by calling the oracle on `rawQuery`. */
const VECTORS: readonly string[] = ['a=b=c', 'a', 'a=b=c=d'];

for (const rawQuery of VECTORS) {
  const expectedPairs = parseFormUrlencoded(rawQuery);
  const rule =
    rawQuery === 'a=b=c'
      ? urlencodedFirstEqualsSplits
      : defineReflectRule({
          id: urlencodedFirstEqualsSplits.id,
          normative: urlencodedFirstEqualsSplits.normative,
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
    probe: replay(`${head('200 OK')}${JSON.stringify(parseFormUrlencoded('a=b=c'))}`),
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
