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
  const out = await run(res('200 OK', FULL_METADATA), res('304 Not Modified', 'ETag: "v1"\r\nCache-Control: max-age=60'));
  expect(out.verdict).toBe(Verdict.Fail);
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
