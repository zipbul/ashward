import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { precedenceIfMatchOverIfUnmodifiedSince as rule } from './precedence-if-match-over-if-unmodified-since';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const res = (status: string, fields = ''): string => `HTTP/1.1 ${status}\r\n${fields}\r\n\r\n`;
const run = async (...responses: string[]) => rule.run({ probe: replay(...responses), target: TARGET });
const LAST_MODIFIED = 'Last-Modified: Sun, 06 Nov 1994 08:49:37 GMT';

// PLAN §5 C10 — §4.3 MUST→Fail: If-Match:*(→200) + IUS:<L−1d>(alone→412) → Pass iff 200; 412→Fail;
// no validator→Skip(NoValidator).

test('passes when If-Match: * combined with an earlier-than-L If-Unmodified-Since still 200s', async () => {
  const out = await run(res('200 OK', LAST_MODIFIED), res('200 OK'));
  expect(out.verdict).toBe(Verdict.Pass);
});

test('fails when the combined probe answers 412 — If-Unmodified-Since was evaluated despite If-Match', async () => {
  const out = await run(res('200 OK', LAST_MODIFIED), res('412 Precondition Failed'), res('200 OK', LAST_MODIFIED));
  expect(out.verdict).toBe(Verdict.Fail);
});

test('is skipped with no-validator when the discovered representation carries no Last-Modified', async () => {
  const out = await run(res('200 OK'));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.NoValidator);
});
