import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { httpDateFormatsAccepted as rule } from './http-date-formats-accepted';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const res = (status: string, fields = ''): string => `HTTP/1.1 ${status}\r\n${fields}\r\n\r\n`;
const run = async (...responses: string[]) => rule.run({ probe: replay(...responses), target: TARGET });
const LAST_MODIFIED = 'Last-Modified: Sun, 06 Nov 1994 08:49:37 GMT';

// PLAN §5 C8 — §1.3 MUST→Fail: baseline IMS:<L, IMF-fixdate>→304; same instant in RFC 850 and
// asctime (emitter MUST be grammar-valid) → each Pass iff 304, 200→Fail; baseline≠304→
// Skip(NotApplicable); no L→Skip(NoValidator).
//
// The classic RFC 9110 §5.6.7 example instant (1994-11-06 08:49:37 UTC) is used as the discovered
// Last-Modified so the rule's own IMF-fixdate/RFC-850/asctime formatting can be cross-checked
// against the STANDARD's own worked examples: "Sun, 06 Nov 1994 08:49:37 GMT" (IMF-fixdate),
// "Sunday, 06-Nov-94 08:49:37 GMT" (RFC 850), "Sun Nov  6 08:49:37 1994" (asctime).

test('passes when the same instant in all three HTTP-date formats elicits 304', async () => {
  const out = await run(res('200 OK', LAST_MODIFIED), res('304 Not Modified'), res('304 Not Modified'), res('304 Not Modified'));
  expect(out.verdict).toBe(Verdict.Pass);
});

test('fails when the RFC 850 form of the same instant is rejected with 200', async () => {
  const out = await run(res('200 OK', LAST_MODIFIED), res('304 Not Modified'), res('200 OK'), res('304 Not Modified'));
  expect(out.verdict).toBe(Verdict.Fail);
});

test('fails when the asctime form of the same instant is rejected with 200', async () => {
  const out = await run(res('200 OK', LAST_MODIFIED), res('304 Not Modified'), res('304 Not Modified'), res('200 OK'));
  expect(out.verdict).toBe(Verdict.Fail);
});

test('is skipped as not-applicable when even the IMF-fixdate baseline fails to elicit 304', async () => {
  const out = await run(res('200 OK', LAST_MODIFIED), res('200 OK'), res('200 OK'), res('200 OK'));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.NotApplicable);
});

test('is skipped with no-validator when the discovered representation carries no Last-Modified', async () => {
  const out = await run(res('200 OK'));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.NoValidator);
});
