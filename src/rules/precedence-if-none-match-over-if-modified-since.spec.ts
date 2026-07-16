import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { replay, res } from '../testkit/replay';
import { precedenceIfNoneMatchOverIfModifiedSince as rule } from './precedence-if-none-match-over-if-modified-since';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const run = async (...responses: string[]) => rule.run({ probe: replay(...responses), target: TARGET });
const VALIDATORS = 'ETag: "v1"\r\nLast-Modified: Sun, 06 Nov 1994 08:49:37 GMT';

// PLAN §5 C9 — §4.2 MUST→Fail: INM:"no-match"(→200) + IMS:<L>(alone→304) → Pass iff 200; 304→Fail;
// no L or no E→Skip(NoValidator).

test('passes when a never-matching If-None-Match combined with If-Modified-Since:<L> still 200s', async () => {
  const out = await run(res('200 OK', VALIDATORS), res('200 OK'));
  expect(out.verdict).toBe(Verdict.Pass);
});

test('fails when the combined probe answers 304 — If-Modified-Since was evaluated despite If-None-Match', async () => {
  const out = await run(res('200 OK', VALIDATORS), res('304 Not Modified'), res('200 OK', VALIDATORS));
  expect(out.verdict).toBe(Verdict.Fail);
});

test('is skipped with no-validator when the discovered representation carries no ETag', async () => {
  const out = await run(res('200 OK', 'Last-Modified: Sun, 06 Nov 1994 08:49:37 GMT'));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.NoValidator);
});

test('is skipped with no-validator when the discovered representation carries no Last-Modified', async () => {
  const out = await run(res('200 OK', 'ETag: "v1"'));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.NoValidator);
});
