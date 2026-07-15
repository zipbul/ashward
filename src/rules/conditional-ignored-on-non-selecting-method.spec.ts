import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { conditionalIgnoredOnNonSelectingMethod as rule } from './conditional-ignored-on-non-selecting-method';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const res = (status: string, fields = ''): string => `HTTP/1.1 ${status}\r\n${fields}\r\n\r\n`;
const run = async (...responses: string[]) => rule.run({ probe: replay(...responses), target: TARGET });

// PLAN §5 C13 — §3.3 MUST→Fail: custom discover = bare OPTIONS twice (status-stability guard);
// baselines must agree on a status S not 304/412 (else Skip(EndpointUnstable)). Then OPTIONS +
// If-None-Match:*: Pass iff status == S (precondition ignored); on 304/412, re-confirm then Fail
// (precondition wrongly applied), else Skip(EndpointUnstable); 5xx or any other drift →
// Skip(EndpointUnstable).

test('passes when a stable non-precondition-shaped OPTIONS status is unchanged by If-None-Match: *', async () => {
  const out = await run(res('204 No Content'), res('204 No Content'), res('204 No Content'));
  expect(out.verdict).toBe(Verdict.Pass);
});

test('fails when OPTIONS + If-None-Match: * is answered 304 — the precondition was wrongly applied', async () => {
  const out = await run(
    res('204 No Content'),
    res('204 No Content'),
    res('304 Not Modified'),
    res('204 No Content'),
    res('204 No Content'),
  );
  expect(out.verdict).toBe(Verdict.Fail);
});

test('fails when OPTIONS + If-None-Match: * is answered 412 — the precondition was wrongly applied', async () => {
  const out = await run(
    res('204 No Content'),
    res('204 No Content'),
    res('412 Precondition Failed'),
    res('204 No Content'),
    res('204 No Content'),
  );
  expect(out.verdict).toBe(Verdict.Fail);
});

// BLOCKER 1 (existence guard) — a resource that stops answering bare OPTIONS with the original
// baseline status by the time the re-discover round-trip runs must never let the tentative Fail
// stand: the disqualifying verdict downgrades to Skip(EndpointUnstable).
test('is skipped as endpoint-unstable when the bare-OPTIONS baseline drifted by re-discover time', async () => {
  const out = await run(res('204 No Content'), res('204 No Content'), res('304 Not Modified'), res('200 OK'), res('200 OK'));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointUnstable);
});

test('is skipped as endpoint-unstable when the two bare-OPTIONS baselines disagree', async () => {
  const out = await run(res('204 No Content'), res('200 OK'));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointUnstable);
});

test('is skipped as endpoint-unstable when the bare-OPTIONS baseline is itself precondition-shaped (304/412)', async () => {
  const out = await run(res('304 Not Modified'), res('304 Not Modified'));
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointUnstable);
});
