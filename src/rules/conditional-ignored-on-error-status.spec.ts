import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { conditionalIgnoredOnErrorStatus as rule } from './conditional-ignored-on-error-status';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const res = (status: string, fields = ''): string => `HTTP/1.1 ${status}\r\n${fields}\r\n\r\n`;
const run = async (...responses: string[]) => rule.run({ probe: replay(...responses), target: TARGET });

// PLAN §5 C14 — §3.2 MUST→Fail: custom discover = GET {path}/<random> twice (status-stability
// guard); the two baselines must agree on a stable status S ∉ {2xx, 304, 412} (else
// Skip(EndpointUnstable)). Resend with If-None-Match:*; on a precondition-shaped outcome (2xx/304/
//412), re-discover and Fail only if S is re-confirmed; status==S→Pass; any other status→
// Skip(EndpointUnstable).

test('passes when a stable error status is unchanged by If-None-Match: *', async () => {
  const out = await run(res('404 Not Found'), res('404 Not Found'), res('404 Not Found'));
  expect(out.verdict).toBe(Verdict.Pass);
});

test('fails when a precondition-shaped 2xx is elicited on a resource stably answering an error status', async () => {
  const out = await run(res('404 Not Found'), res('404 Not Found'), res('200 OK'), res('404 Not Found'), res('404 Not Found'));
  expect(out.verdict).toBe(Verdict.Fail);
});

test('fails when a precondition-shaped 304 is elicited on a resource stably answering an error status', async () => {
  const out = await run(
    res('404 Not Found'),
    res('404 Not Found'),
    res('304 Not Modified'),
    res('404 Not Found'),
    res('404 Not Found'),
  );
  expect(out.verdict).toBe(Verdict.Fail);
});

test('fails when a precondition-shaped 412 is elicited on a resource stably answering an error status', async () => {
  const out = await run(
    res('404 Not Found'),
    res('404 Not Found'),
    res('412 Precondition Failed'),
    res('404 Not Found'),
    res('404 Not Found'),
  );
  expect(out.verdict).toBe(Verdict.Fail);
});

// BLOCKER 1 (existence guard, C14) — a resource that stops answering the fixed nonexistent path with
// the original stable error status by the time the re-discover round-trip runs must never let the
// tentative Fail stand: the disqualifying verdict downgrades to Skip(EndpointUnstable).
test('is skipped as endpoint-unstable when the error-status baseline drifted by re-discover time', async () => {
  const out = await run(res('404 Not Found'), res('404 Not Found'), res('200 OK'), res('410 Gone'), res('410 Gone'));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointUnstable);
});

test('is skipped as endpoint-unstable when the two error-status baselines disagree', async () => {
  const out = await run(res('404 Not Found'), res('410 Gone'));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointUnstable);
});

test('is skipped as endpoint-unstable when the discover baseline is itself 2xx (not an error status)', async () => {
  const out = await run(res('200 OK'), res('200 OK'));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointUnstable);
});

test('is skipped as endpoint-unstable when a baseline discover probe answers 5xx', async () => {
  const out = await run(res('404 Not Found'), res('500 Internal Server Error'));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointUnstable);
});
