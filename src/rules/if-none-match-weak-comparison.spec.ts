import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { ifNoneMatchWeakComparison as rule } from './if-none-match-weak-comparison';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const res = (status: string, fields = ''): string => `HTTP/1.1 ${status}\r\n${fields}\r\n\r\n`;
const run = async (...responses: string[]) => rule.run({ probe: replay(...responses), target: TARGET });

// PLAN §5 C3 — §2.4 MUST→Fail: strong "v1" + If-None-Match:W/"v1" → Pass iff 304; 200→Fail;
// discovered weak ETag→Skip(NotApplicable).

test('passes when a weak form of the discovered strong ETag still elicits 304', async () => {
  const out = await run(res('200 OK', 'ETag: "v1"'), res('304 Not Modified'));
  expect(out.verdict).toBe(Verdict.Pass);
});

test('fails when a weak form of the discovered strong ETag is rejected with 200', async () => {
  const out = await run(res('200 OK', 'ETag: "v1"'), res('200 OK'));
  expect(out.verdict).toBe(Verdict.Fail);
});

test('is skipped as not-applicable when the discovered ETag is already weak', async () => {
  const out = await run(res('200 OK', 'ETag: W/"v1"'));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.NotApplicable);
});

test('is skipped with no-validator when the discovered representation carries no ETag', async () => {
  const out = await run(res('200 OK'));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.NoValidator);
});
