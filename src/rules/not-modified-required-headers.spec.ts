import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { notModifiedRequiredHeaders as rule } from './not-modified-required-headers';

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
test('fails when the elicited 304 omits Date and the discovered 200 sent it', async () => {
  const out = await run(
    res('200 OK', `${FULL_METADATA}\r\nDate: Sun, 06 Nov 1994 08:49:37 GMT`),
    res('304 Not Modified', FULL_METADATA),
    res('200 OK', `${FULL_METADATA}\r\nDate: Sun, 06 Nov 1994 08:49:37 GMT`),
  );
  expect(out.verdict).toBe(Verdict.Fail);
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
