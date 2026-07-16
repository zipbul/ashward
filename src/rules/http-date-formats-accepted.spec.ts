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
  const out = await run(
    res('200 OK', LAST_MODIFIED),
    res('304 Not Modified'),
    res('200 OK'),
    res('304 Not Modified'),
    res('200 OK', LAST_MODIFIED),
  );
  expect(out.verdict).toBe(Verdict.Fail);
});

test('fails when the asctime form of the same instant is rejected with 200', async () => {
  const out = await run(
    res('200 OK', LAST_MODIFIED),
    res('304 Not Modified'),
    res('304 Not Modified'),
    res('200 OK'),
    res('200 OK', LAST_MODIFIED),
  );
  expect(out.verdict).toBe(Verdict.Fail);
});

// MAJOR — RFC 9110 §5.6.7's rfc850-date 2-digit year + the 50-year disambiguation rule means an old
// enough instant is NOT representable in RFC 850 form as the same instant to a CORRECT recipient (the
// SUT applies the rule against ITS clock, "now"). C8 must Skip(NotApplicable) rather than false-Fail
// a correct server that (rightly) resolves the 2-digit year to a different century than intended.
test('is skipped as not-applicable when the discovered instant does not round-trip through rfc850 under the 50-year rule', async () => {
  const out = await run(res('200 OK', 'Last-Modified: Wed, 01 Jan 1975 00:00:00 GMT'), res('304 Not Modified'));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.NotApplicable);
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

// MAJOR 5 — `new Date(value)` also accepts ISO 8601 and countless other non-HTTP-date shapes, so a
// loose parser would wrongly trust this as a validator and build a probe from it. Only a STRICT
// RFC 9110 §5.6.7 HTTP-date grammar counts.
test('is skipped with no-validator when the discovered Last-Modified is an ISO 8601 timestamp, not an HTTP-date', async () => {
  const out = await run(res('200 OK', 'Last-Modified: 2026-01-01T00:00:00Z'));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.NoValidator);
});
