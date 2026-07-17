import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { replay, res } from '../testkit/replay';
import { ifNoneMatchStarNotModified as rule } from './if-none-match-star-not-modified';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const run = async (...responses: string[]) => rule.run({ probe: replay(...responses), target: TARGET });

// PLAN §5 C2 — §5.2.4 MUST→Fail (existence guard): stable present-200 baseline (×2), GET
// If-None-Match:* → Pass iff 304; 200 with the resource re-confirmed present→Fail; 5xx/drift→
// Skip(EndpointUnstable).

test('passes when a stable present-200 baseline elicits 304 on If-None-Match: *', async () => {
  const out = await run(res('200 OK'), res('200 OK'), res('304 Not Modified'));
  expect(out.verdict).toBe(Verdict.Pass);
});

test('fails when the resource stays 200 despite If-None-Match: * and a stable present baseline', async () => {
  const out = await run(res('200 OK'), res('200 OK'), res('200 OK'), res('200 OK'), res('200 OK'));
  expect(out.verdict).toBe(Verdict.Fail);
});

// BLOCKER 1 (existence guard, C2) — the resource that was present-200 at discover time must still be
// present-200 by re-discover time before the tentative Fail stands; drift → Skip(EndpointUnstable).
test('is skipped as endpoint-unstable when the present-200 baseline drifted by re-discover time', async () => {
  const out = await run(res('200 OK'), res('200 OK'), res('200 OK'), res('404 Not Found'), res('404 Not Found'));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointUnstable);
});

test('is skipped as endpoint-unstable when the two present-200 baselines disagree', async () => {
  const out = await run(res('200 OK'), res('404 Not Found'));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointUnstable);
});

test('is skipped as endpoint-unstable when a baseline discover probe answers 5xx', async () => {
  const out = await run(res('200 OK'), res('500 Internal Server Error'));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointUnstable);
});
