import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { ifNoneMatchNotModified as rule } from './if-none-match-not-modified';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const res = (status: string, fields = ''): string => `HTTP/1.1 ${status}\r\n${fields}\r\n\r\n`;
const run = async (...responses: string[]) => rule.run({ probe: replay(...responses), target: TARGET });

// PLAN §5 C1 — §5.2.4 MUST→Fail: GET If-None-Match:<E> → Pass iff 304; 200→Fail (ignored match);
// If-None-Match:"no-match"→200 Pass; no ETag→Skip(NoValidator).
//
// The rule sends TWO conditional probes per discover: the real discovered ETag (the disqualifying
// probe) and a literal "no-match" (the STANDARD's own contrast — a genuinely non-matching condition
// legitimately evaluates true, so the method IS performed, 200). The table's "no-match→200 Pass" row
// is folded into the first (fully-correct-server) case below rather than encoded as a separate probe
// sequence: C1's own crafted probes never send an isolated "no-match" without also sending the real
// tag, so the row is only meaningfully drivable together with the matching-tag outcome.

test('a fully correct server (304 on the real ETag, 200 on a non-matching one) passes', async () => {
  const out = await run(res('200 OK', 'ETag: "v1"'), res('304 Not Modified'), res('200 OK'));
  expect(out.verdict).toBe(Verdict.Pass);
});

test('200 on the real matching ETag fails — the precondition was ignored', async () => {
  const out = await run(res('200 OK', 'ETag: "v1"'), res('200 OK'), res('200 OK'));
  expect(out.verdict).toBe(Verdict.Fail);
});

test('is skipped with no-validator when the discovered representation carries no ETag', async () => {
  const out = await run(res('200 OK'));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.NoValidator);
});

test('is skipped with no-validator when the discover baseline is not a 200', async () => {
  const out = await run(res('404 Not Found'));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.NoValidator);
});
