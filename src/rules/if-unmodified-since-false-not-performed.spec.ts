import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { ifUnmodifiedSinceFalseNotPerformed as rule } from './if-unmodified-since-false-not-performed';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const res = (status: string, fields = ''): string => `HTTP/1.1 ${status}\r\n${fields}\r\n\r\n`;
const run = async (...responses: string[]) => rule.run({ probe: replay(...responses), target: TARGET });
const LAST_MODIFIED = 'Last-Modified: Sun, 06 Nov 1994 08:49:37 GMT';

// PLAN §5 C6 — §5.4.7 MUST NOT→Fail: GET If-Unmodified-Since:<L−1d> → 2xx→Fail; 412→Pass;
// IUS≥L→200 Pass; no Last-Modified→Skip(NoValidator).

test('passes when an earlier-than-L If-Unmodified-Since is refused 412 and an equal-to-L one is honored 200', async () => {
  const out = await run(res('200 OK', LAST_MODIFIED), res('412 Precondition Failed'), res('200 OK'));
  expect(out.verdict).toBe(Verdict.Pass);
});

test('fails when an earlier-than-L If-Unmodified-Since is performed anyway (2xx)', async () => {
  const out = await run(res('200 OK', LAST_MODIFIED), res('200 OK'), res('200 OK'), res('200 OK', LAST_MODIFIED));
  expect(out.verdict).toBe(Verdict.Fail);
});

// BLOCKER 3 — the contrast (IUS == L) probe must actually be consulted: a server that answers 412
// unconditionally (ignoring If-Unmodified-Since's value entirely) must not false-Pass just because
// the earlier-than-L probe happened to land on 412.
test('fails when the server answers 412 unconditionally, ignoring If-Unmodified-Since entirely', async () => {
  const out = await run(
    res('200 OK', LAST_MODIFIED),
    res('412 Precondition Failed'),
    res('412 Precondition Failed'),
    res('200 OK', LAST_MODIFIED),
  );
  expect(out.verdict).toBe(Verdict.Fail);
});

test('is skipped with no-validator when the discovered representation carries no Last-Modified', async () => {
  const out = await run(res('200 OK'));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.NoValidator);
});

test('is skipped with no-validator when the discovered Last-Modified is not a valid HTTP-date', async () => {
  const out = await run(res('200 OK', 'Last-Modified: not-a-date'));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.NoValidator);
});
