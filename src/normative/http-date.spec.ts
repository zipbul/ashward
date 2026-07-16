import { test, expect } from 'bun:test';

import { formatAsctime, formatImfFixdate, formatRfc850, parseHttpDate, resolveRfc850Year } from './http-date';

// The RFC 9110 §5.6.7 worked example instant: 1994-11-06T08:49:37Z.
const EXAMPLE_MS = Date.UTC(1994, 10, 6, 8, 49, 37);

test('parses a well-formed IMF-fixdate to the correct instant', () => {
  expect(parseHttpDate('Sun, 06 Nov 1994 08:49:37 GMT')).toBe(EXAMPLE_MS);
});

test('parses a well-formed asctime-date (single-digit, space-padded day) to the correct instant', () => {
  expect(parseHttpDate('Sun Nov  6 08:49:37 1994')).toBe(EXAMPLE_MS);
});

test('parses a well-formed asctime-date (two-digit day) to the correct instant', () => {
  expect(parseHttpDate('Wed Nov 16 08:49:37 1994')).toBe(Date.UTC(1994, 10, 16, 8, 49, 37));
});

test('parses a well-formed rfc850-date, resolving the 2-digit year relative to `now`', () => {
  const now = new Date(Date.UTC(2000, 0, 1));
  expect(parseHttpDate('Sunday, 06-Nov-94 08:49:37 GMT', now)).toBe(EXAMPLE_MS);
});

test('round-trips every formatter through the parser for the same instant', () => {
  const instant = new Date(EXAMPLE_MS);
  const now = new Date(Date.UTC(2000, 0, 1));
  expect(parseHttpDate(formatImfFixdate(instant))).toBe(EXAMPLE_MS);
  expect(parseHttpDate(formatRfc850(instant), now)).toBe(EXAMPLE_MS);
  expect(parseHttpDate(formatAsctime(instant))).toBe(EXAMPLE_MS);
});

// MAJOR 5 — the whole point of a STRICT parser: `new Date(value)` happily accepts ISO 8601 and
// countless other shapes RFC 9110 §5.6.7 never allows. A malformed-but-Date-parseable validator
// must never be trusted to build a conditional probe.
test('rejects an ISO 8601 timestamp — not an HTTP-date, even though `Date` would parse it', () => {
  expect(parseHttpDate('2026-01-01T00:00:00Z')).toBeNull();
});

test('rejects a GMT-formatted date using the wrong zone literal (UTC instead of GMT)', () => {
  expect(parseHttpDate('Sun, 06 Nov 1994 08:49:37 UTC')).toBeNull();
});

test('rejects a lowercase day-name — the grammar is case-sensitive', () => {
  expect(parseHttpDate('sun, 06 Nov 1994 08:49:37 GMT')).toBeNull();
});

test('rejects an IMF-fixdate with a 2-digit year', () => {
  expect(parseHttpDate('Sun, 06 Nov 94 08:49:37 GMT')).toBeNull();
});

test('rejects a calendrically-invalid date (31 February)', () => {
  expect(parseHttpDate('Tue, 31 Feb 1994 08:49:37 GMT')).toBeNull();
});

test('rejects an out-of-range hour (24)', () => {
  expect(parseHttpDate('Sun, 06 Nov 1994 24:00:00 GMT')).toBeNull();
});

test('rejects an out-of-range minute (60)', () => {
  expect(parseHttpDate('Sun, 06 Nov 1994 08:60:37 GMT')).toBeNull();
});

test('rejects garbage input outright', () => {
  expect(parseHttpDate('not-a-date')).toBeNull();
});

test('rejects an empty string', () => {
  expect(parseHttpDate('')).toBeNull();
});

// MINOR 6 — the 50-year rfc850 disambiguation (§5.6.7) is relative to the actual candidate INSTANT
// vs `now + 50 years`, never a year-only comparison. A year-only check (`naiveYear > nowYear + 50`)
// misses the month/day granularity: when the naive year lands EXACTLY on `nowYear + 50`, whether the
// candidate is actually more than 50 years out still depends on where its month/day falls relative
// to `now`'s.
test('resolves a 2-digit rfc850 year via the candidate INSTANT vs now+50-years, not year-only arithmetic', () => {
  const now = new Date(Date.UTC(2026, 6, 16, 0, 0, 0)); // 2026-07-16T00:00:00Z
  // naiveYear = 2000 + 76 = 2076 = nowYear + 50 exactly. The candidate's month/day (Nov 6) falls
  // AFTER now's month/day (Jul 16) within that naive year, so the candidate instant
  // (2076-11-06T08:49:37Z) genuinely lands more than 50 years after `now` — a year-only comparison
  // (2076 > 2076 is false) would wrongly leave it at 2076 instead of resolving back a century.
  expect(resolveRfc850Year(76, 10, 6, 8, 49, 37, now)).toBe(1976);
});

test('does not resolve back a century when the same naive year is reached but the candidate falls before the now+50y cutoff within that year', () => {
  const now = new Date(Date.UTC(2026, 6, 16, 0, 0, 0)); // 2026-07-16T00:00:00Z
  // Same naiveYear (2076) as above, but the candidate's month/day (Jan 6) falls BEFORE now's
  // month/day (Jul 16) within that year, so the candidate instant is NOT yet more than 50 years
  // past `now` — it must stay at 2076.
  expect(resolveRfc850Year(76, 0, 6, 8, 49, 37, now)).toBe(2076);
});
