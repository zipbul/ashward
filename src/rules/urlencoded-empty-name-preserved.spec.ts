import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { parseFormUrlencoded } from '../normative/urlencoded';
import { capturingProbe, jsonHead, replay } from '../testkit/replay';
import { defineReflectRule } from './kit/reflect-rule';
import { urlencodedEmptyNamePreserved } from './urlencoded-empty-name-preserved';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/echo', timeoutMs: 500 };

/** §2.3 MUST (empty-name sub-limb): a sequence beginning with "=" splits into an empty-string name
 *  and the remaining value — a pair distinct from an absent key, losslessly representable by an
 *  ordered pair-list echo. `expectedPairs` is ALWAYS derived by calling the oracle on `rawQuery`. */
const VECTORS: readonly string[] = ['=v', 'a=1&=v', '=v&=w'];

for (const rawQuery of VECTORS) {
  const expectedPairs = parseFormUrlencoded(rawQuery);
  const rule =
    rawQuery === '=v'
      ? urlencodedEmptyNamePreserved
      : defineReflectRule({
          id: urlencodedEmptyNamePreserved.id,
          normative: urlencodedEmptyNamePreserved.normative,
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

test('fails when the echo drops the empty-string-key pair entirely', async () => {
  const out = await urlencodedEmptyNamePreserved.run({
    probe: replay(`${jsonHead('200 OK')}${JSON.stringify([])}`),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Fail);
});

test('is skipped as endpoint-not-reflecting when reflect is not opted in', async () => {
  const out = await urlencodedEmptyNamePreserved.run({
    probe: replay(`${jsonHead('200 OK')}${JSON.stringify(parseFormUrlencoded('=v'))}`),
    target: TARGET,
  });
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointNotReflecting);
});
