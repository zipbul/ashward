import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { parseFormUrlencoded } from '../normative/urlencoded';
import { capturingProbe, jsonHead, replay } from '../testkit/replay';
import { defineReflectRule } from './kit/reflect-rule';
import { urlencodedEmptySequenceSkipped } from './urlencoded-empty-sequence-skipped';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/echo', timeoutMs: 500 };

/** §2.2 MUST: an empty byte sequence between/around separators contributes no pair. `expectedPairs`
 *  is ALWAYS derived by calling the oracle on `rawQuery`. */
const VECTORS: readonly string[] = ['a=1&&b=2', '&a=1', 'a=1&', '&&'];

for (const rawQuery of VECTORS) {
  const expectedPairs = parseFormUrlencoded(rawQuery);
  const rule =
    rawQuery === 'a=1&&b=2'
      ? urlencodedEmptySequenceSkipped
      : defineReflectRule({
          id: urlencodedEmptySequenceSkipped.id,
          normative: urlencodedEmptySequenceSkipped.normative,
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

test('fails when the echo emits a spurious empty pair for the skipped sequence', async () => {
  const out = await urlencodedEmptySequenceSkipped.run({
    probe: replay(
      `${jsonHead('200 OK')}${JSON.stringify([
        ['a', '1'],
        ['', ''],
        ['b', '2'],
      ])}`,
    ),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Fail);
});

test('is skipped as endpoint-not-reflecting on a non-2xx response', async () => {
  const out = await urlencodedEmptySequenceSkipped.run({
    probe: replay(`${jsonHead('500 Internal Server Error')}${JSON.stringify(parseFormUrlencoded('a=1&&b=2'))}`),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointNotReflecting);
});
