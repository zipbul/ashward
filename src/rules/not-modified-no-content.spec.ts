import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { InconclusiveReason, SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { notModifiedNoContent as rule } from './not-modified-no-content';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const res = (status: string, fields = '', body = ''): string => `HTTP/1.1 ${status}\r\n${fields}\r\n\r\n${body}`;
const run = async (...responses: string[]) => rule.run({ probe: replay(...responses), target: TARGET });
const ETAG = 'ETag: "v1"';

// PLAN §5 C12 — §6.1.4 Unmarked→Warn: elicited 304 with content bytes→Warn (never Fail — Unmarked);
// empty→Pass; !complete→Inconclusive(IncompleteMessage); no 304→Skip(NotApplicable).

test('warns (never fails, Unmarked) when the elicited 304 carries content bytes', async () => {
  const out = await run(res('200 OK', ETAG), res('304 Not Modified', 'Content-Length: 5', 'hello'), res('200 OK', ETAG));
  expect(out.verdict).toBe(Verdict.Warn);
});

test('passes when the elicited 304 carries no content', async () => {
  const out = await run(res('200 OK', ETAG), res('304 Not Modified'));
  expect(out.verdict).toBe(Verdict.Pass);
});

test('is inconclusive with incomplete-message on a truncated 304 body, never a false pass', async () => {
  const out = await run(res('200 OK', ETAG), res('304 Not Modified', 'Content-Length: 100', 'short'));
  expect(out.verdict).toBe(Verdict.Inconclusive);
  expect(out.reason).toBe(InconclusiveReason.IncompleteMessage);
});

// BLOCKER 2 — a Content-Length-framed body's bytes are real content, even when they happen to be a
// lone CRLF or a single byte: the RFC 9112 §2.2 "tolerate one leading empty line" allowance is a
// close-delimited-framing artifact only, never license to blind C12 to a framed 304 body.
test('warns on a Content-Length-framed 304 body that is exactly a lone CRLF', async () => {
  const out = await run(res('200 OK', ETAG), res('304 Not Modified', 'Content-Length: 2', '\r\n'), res('200 OK', ETAG));
  expect(out.verdict).toBe(Verdict.Warn);
});

test('warns on a Content-Length-framed 304 body that is a single byte', async () => {
  const out = await run(res('200 OK', ETAG), res('304 Not Modified', 'Content-Length: 1', '\n'), res('200 OK', ETAG));
  expect(out.verdict).toBe(Verdict.Warn);
});

test('is skipped as not-applicable when the conditional probe could not elicit a 304', async () => {
  const out = await run(res('200 OK', ETAG), res('200 OK'));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.NotApplicable);
});

test('is skipped with no-validator when the discovered representation carries no ETag', async () => {
  const out = await run(res('200 OK'));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.NoValidator);
});
