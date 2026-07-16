import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { parseFormUrlencoded } from '../normative/urlencoded';
import { capturingProbe, jsonHead, replay } from '../testkit/replay';
import { defineReflectRule } from './kit/reflect-rule';
import { urlencodedAmpersandOnlySeparator } from './urlencoded-ampersand-only-separator';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/echo', timeoutMs: 500 };

/** Every vector this rule (§2.1 MUST: "&" is the ONLY separator; ";" inside a sequence is DATA)
 *  must handle correctly. `expectedPairs` is ALWAYS derived by calling the oracle on `rawQuery`
 *  in the test, never hand-copied — a wrong rawQuery with a hand-matched expectedPairs would no
 *  longer pass. */
const VECTORS: readonly string[] = ['a=1;b=2', 'a=1;2;3', 'a=1;b=2&c=3', ';a=1'];

for (const rawQuery of VECTORS) {
  const expectedPairs = parseFormUrlencoded(rawQuery);
  const rule =
    rawQuery === 'a=1;b=2'
      ? urlencodedAmpersandOnlySeparator
      : defineReflectRule({
          id: urlencodedAmpersandOnlySeparator.id,
          normative: urlencodedAmpersandOnlySeparator.normative,
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

test('fails when the echo wrongly splits on the semicolon', async () => {
  const out = await urlencodedAmpersandOnlySeparator.run({
    probe: replay(
      `${jsonHead('200 OK')}${JSON.stringify([
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
    probe: replay(`${jsonHead('200 OK')}${JSON.stringify(parseFormUrlencoded('a=1;b=2'))}`),
    target: TARGET,
  });
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointNotReflecting);
});

test('is skipped as endpoint-not-reflecting on a non-2xx response', async () => {
  const out = await urlencodedAmpersandOnlySeparator.run({
    probe: replay(`${jsonHead('404 Not Found')}${JSON.stringify(parseFormUrlencoded('a=1;b=2'))}`),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointNotReflecting);
});
