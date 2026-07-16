import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import {
  EXACT_VALUE_HEADERS,
  notModifiedRequiredHeaders as rule,
  PRESENCE_ONLY_HEADERS,
  REQUIRED_HEADERS,
} from './not-modified-required-headers';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const res = (status: string, fields = ''): string => `HTTP/1.1 ${status}\r\n${fields}\r\n\r\n`;
const run = async (...responses: string[]) => rule.run({ probe: replay(...responses), target: TARGET });
const FULL_METADATA = [
  'ETag: "v1"',
  'Cache-Control: max-age=60',
  'Vary: Accept-Encoding',
  'Expires: Sun, 06 Nov 1994 08:49:37 GMT',
  'Content-Location: /canonical',
].join('\r\n');

// MINOR 5 — REQUIRED_HEADERS (used by the judge to decide what a 304 MUST carry) and
// EXACT_VALUE_HEADERS ∪ PRESENCE_ONLY_HEADERS (used by the kit's RE-DISCOVER re-confirm guard) must
// never drift apart: a required header added to one set without the other would silently let a Fail
// stand un-reconfirmed (or a header the guard re-checks that the judge never actually requires).
// This is now a structural derivation (REQUIRED_HEADERS = EXACT_VALUE_HEADERS ∪
// PRESENCE_ONLY_HEADERS), not independent literals — this test pins the invariant so a future
// refactor back to independent literals fails immediately.
test('REQUIRED_HEADERS is exactly the union of EXACT_VALUE_HEADERS and PRESENCE_ONLY_HEADERS, with no overlap', () => {
  const union = new Set([...EXACT_VALUE_HEADERS, ...PRESENCE_ONLY_HEADERS]);
  expect(union.size).toBe(EXACT_VALUE_HEADERS.length + PRESENCE_ONLY_HEADERS.length);
  expect(new Set(REQUIRED_HEADERS)).toEqual(union);
});

// PLAN §5 C11 — §6.1.2 MUST→Fail: elicit 304 (INM:<E>); it MUST carry each of ETag/Cache-Control/
// Vary/Expires/Content-Location that the discovered 200 sent (missing→Fail). Couldn't elicit
// 304→Skip(NotApplicable).

test('passes when the elicited 304 carries every required header the discovered 200 sent', async () => {
  const out = await run(res('200 OK', FULL_METADATA), res('304 Not Modified', FULL_METADATA));
  expect(out.verdict).toBe(Verdict.Pass);
});

test('fails when the elicited 304 drops a required header the discovered 200 sent', async () => {
  const out = await run(
    res('200 OK', FULL_METADATA),
    res('304 Not Modified', 'ETag: "v1"\r\nCache-Control: max-age=60'),
    res('200 OK', FULL_METADATA),
  );
  expect(out.verdict).toBe(Verdict.Fail);
});

// MAJOR — a repeated required header must not read as absent: `headerOf`/`singleFieldValue`
// collapses a repeated field to null, which used to hide a genuine required-header omission.
test('fails when the elicited 304 drops a header the discovered 200 sent as a REPEATED field', async () => {
  const withRepeatedCacheControl = `${FULL_METADATA}\r\nCache-Control: no-cache`;
  const out = await run(
    res('200 OK', withRepeatedCacheControl),
    res(
      '304 Not Modified',
      'ETag: "v1"\r\nVary: Accept-Encoding\r\nExpires: Sun, 06 Nov 1994 08:49:37 GMT\r\nContent-Location: /canonical',
    ),
    res('200 OK', withRepeatedCacheControl),
  );
  expect(out.verdict).toBe(Verdict.Fail);
});

// MAJOR — §6.1.2's Date field is now part of C11's guarded set (moved out of the untestable
// residue): a 304 must carry Date whenever the discovered 200 sent it.
// De-tautologized: the re-discover's `Date` is DELIBERATELY one second later than discover's, not
// frozen to the same literal value — `Date` is checked for re-confirm PRESENCE only (§6.6.1: its
// exact value is irrelevant to the §6.1.2 judgment and legitimately advances on a live origin). A
// spec that freezes the same `Date` string on both sides can't tell a presence-only re-confirm
// apart from a byte-identical one; this one can.
test('fails when the elicited 304 omits Date and the discovered 200 sent it', async () => {
  const out = await run(
    res('200 OK', `${FULL_METADATA}\r\nDate: Sun, 06 Nov 1994 08:49:37 GMT`),
    res('304 Not Modified', FULL_METADATA),
    res('200 OK', `${FULL_METADATA}\r\nDate: Sun, 06 Nov 1994 08:49:38 GMT`),
  );
  expect(out.verdict).toBe(Verdict.Fail);
});

// BLOCKER 1 — the previous fix widened the re-discover guard to re-confirm the FULL §6.1.2 set
// BYTE-IDENTICALLY, including `Date` — but `Date` legitimately advances every second on a live
// origin. That downgrades ANY tentative C11 Fail (even a real missing-`Vary` violation) to
// Skip(EndpointUnstable) merely because the origin's clock ticked between discover and re-discover.
// `Date` must be re-confirmed by PRESENCE only; a genuine missing-`Vary` Fail must stand when only
// `Date` changed by 1 second.
test('a genuine missing-Vary Fail stands even though Date advances by 1 second between discover and re-discover', async () => {
  const out = await run(
    res('200 OK', 'ETag: "v1"\r\nVary: Accept-Encoding\r\nDate: Sun, 06 Nov 1994 08:49:37 GMT'), // discover: Vary + Date=T
    res('304 Not Modified', 'ETag: "v1"\r\nDate: Sun, 06 Nov 1994 08:49:37 GMT'), // 304 drops Vary -> tentative Fail
    res('200 OK', 'ETag: "v1"\r\nVary: Accept-Encoding\r\nDate: Sun, 06 Nov 1994 08:49:38 GMT'), // re-discover: Vary present, Date=T+1s
  );
  expect(out.verdict).toBe(Verdict.Fail);
});

// MINOR 4 — the guard's `Date` re-confirm is PRESENCE-only, and the case above only pins the
// tolerated side (VALUE drift, still present both times). The other side of that split — Date
// genuinely disappearing between discover and re-discover (PRESENCE drift) while an unrelated
// required header (Vary) is what the 304 actually dropped — must still downgrade the tentative Fail
// to Skip(EndpointUnstable), same as any other validator-guard drift.
test('a Date PRESENCE drift (sent at discover, absent at re-discover) downgrades a tentative Fail to Skip(EndpointUnstable)', async () => {
  const out = await run(
    res('200 OK', `${FULL_METADATA}\r\nDate: Sun, 06 Nov 1994 08:49:37 GMT`), // discover: full metadata + Date present
    res(
      '304 Not Modified',
      'ETag: "v1"\r\nCache-Control: max-age=60\r\nExpires: Sun, 06 Nov 1994 08:49:37 GMT\r\nContent-Location: /canonical',
    ), // 304 drops Vary -> tentative Fail
    res('200 OK', FULL_METADATA), // re-discover: EXACT_VALUE_HEADERS unchanged, but Date is now ABSENT
  );
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointUnstable);
});

// §6.6.1 clockless guard: when the discovered 200 itself never sent Date, its absence on the 304
// is not judged (the origin may simply have no live clock).
test('passes when neither the discovered 200 nor the elicited 304 sends Date', async () => {
  const out = await run(res('200 OK', FULL_METADATA), res('304 Not Modified', FULL_METADATA));
  expect(out.verdict).toBe(Verdict.Pass);
});

test('is skipped as not-applicable when the conditional probe could not elicit a 304', async () => {
  const out = await run(res('200 OK', FULL_METADATA), res('200 OK', FULL_METADATA));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.NotApplicable);
});

test('is skipped with no-validator when the discovered representation carries no ETag', async () => {
  const out = await run(res('200 OK'));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.NoValidator);
});

// BLOCKER 2 — the kit's validator-guard re-discover used to key ONLY on ETag: a required header
// (other than ETag) dropping out from under the probe between discover and re-discover left a
// tentative Fail standing falsely, because the metadata that actually made it "missing" on the 304
// was never itself re-confirmed. The FULL §6.1.2 set the Fail depends on must be re-confirmed.
test('a required header present on the discovered 200 but gone by re-discover time downgrades a tentative Fail to Skip(EndpointUnstable), never lets it stand', async () => {
  const out = await run(
    res('200 OK', FULL_METADATA), // discover: ETag/Cache-Control/Vary/Expires/Content-Location all present
    res('304 Not Modified', 'ETag: "v1"'), // 304 drops everything but ETag -> tentative Fail
    // re-discover: Vary is gone even though ETag (the only header the old guard re-checked) is
    // unchanged — the endpoint drifted underneath the probe, so the Fail must not stand.
    res(
      '200 OK',
      'ETag: "v1"\r\nCache-Control: max-age=60\r\nExpires: Sun, 06 Nov 1994 08:49:37 GMT\r\nContent-Location: /canonical',
    ),
  );
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointUnstable);
});

// The narrower half of the same bug: a repeated required header's re-discover comparison must not
// collapse to "both null, therefore stable" — `singleFieldValue` returns null for ANY repeated
// field, so a genuinely drifted repeated Cache-Control (different values, still repeated on both
// sides) would read as unchanged under the old ETag-only, singleFieldValue-based re-discover.
test('a repeated required header whose values drift between discover and re-discover downgrades a tentative Fail to Skip, not "stable" merely because both sides collapse to null', async () => {
  const discoverRepeated = `${FULL_METADATA}\r\nCache-Control: no-cache`;
  const reconfirmDrifted =
    'ETag: "v1"\r\nCache-Control: max-age=60\r\nCache-Control: no-store\r\nVary: Accept-Encoding\r\n' +
    'Expires: Sun, 06 Nov 1994 08:49:37 GMT\r\nContent-Location: /canonical';
  const out = await run(
    res('200 OK', discoverRepeated), // Cache-Control repeated: [max-age=60, no-cache]
    res('304 Not Modified', 'ETag: "v1"'), // drops everything but ETag -> tentative Fail
    res('200 OK', reconfirmDrifted), // Cache-Control repeated: [max-age=60, no-store] -- drifted
  );
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointUnstable);
});
