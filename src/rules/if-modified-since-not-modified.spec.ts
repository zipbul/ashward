import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { ifModifiedSinceNotModified as rule } from './if-modified-since-not-modified';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const res = (status: string, fields = ''): string => `HTTP/1.1 ${status}\r\n${fields}\r\n\r\n`;
const run = async (...responses: string[]) => rule.run({ probe: replay(...responses), target: TARGET });
const LAST_MODIFIED = 'Last-Modified: Sun, 06 Nov 1994 08:49:37 GMT';

// PLAN §5 C7 — §5.3.7 SHOULD→Warn: GET (no INM) If-Modified-Since:<L> → Pass iff 304; 200→Warn;
// IMS far-past→200 Pass; no L→Skip(NoValidator).

test('passes when If-Modified-Since:<L> elicits 304 and a far-past date is honored 200', async () => {
  const out = await run(res('200 OK', LAST_MODIFIED), res('304 Not Modified'), res('200 OK'));
  expect(out.verdict).toBe(Verdict.Pass);
});

test('warns (never fails, SHOULD) when If-Modified-Since:<L> is ignored and the method is performed', async () => {
  const out = await run(res('200 OK', LAST_MODIFIED), res('200 OK'), res('200 OK'));
  expect(out.verdict).toBe(Verdict.Warn);
});

test('is skipped with no-validator when the discovered representation carries no Last-Modified', async () => {
  const out = await run(res('200 OK'));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.NoValidator);
});
