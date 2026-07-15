import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { ifMatchFalseNotPerformed as rule } from './if-match-false-not-performed';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const res = (status: string, fields = ''): string => `HTTP/1.1 ${status}\r\n${fields}\r\n\r\n`;
const run = async (...responses: string[]) => rule.run({ probe: replay(...responses), target: TARGET });

// PLAN §5 C4 — §5.1.3 MUST NOT→Fail: GET If-Match:"no-match" → 2xx→Fail (performed); 412→Pass;
// If-Match:*→200 Pass; other non-2xx (3xx/4xx≠412)→Skip(EndpointUnstable, ambiguous); no ETag→
// Skip(NoValidator).

test('passes when a never-matching If-Match is refused 412 while If-Match: * is honored 200', async () => {
  const out = await run(res('200 OK', 'ETag: "v1"'), res('412 Precondition Failed'), res('200 OK'));
  expect(out.verdict).toBe(Verdict.Pass);
});

test('fails when a never-matching If-Match is performed anyway (2xx)', async () => {
  const out = await run(res('200 OK', 'ETag: "v1"'), res('200 OK'), res('200 OK'));
  expect(out.verdict).toBe(Verdict.Fail);
});

test('is skipped as endpoint-unstable on an ambiguous non-2xx/412 status for the never-matching probe', async () => {
  const out = await run(res('200 OK', 'ETag: "v1"'), res('302 Found'), res('200 OK'));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointUnstable);
});

test('is skipped with no-validator when the discovered representation carries no ETag', async () => {
  const out = await run(res('200 OK'));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.NoValidator);
});
