import { test, expect } from 'bun:test';

import type { HttpTarget, ProbeFn } from '../../http/context';

import { InconclusiveReason, Rule, SkipReason, Verdict } from '../../core/contract/enums';
import { RFC9110 } from '../../standards/documents';
import { LocatorKind, ReqLevel } from '../../standards/enums';
import { replay } from '../../testkit/replay';
import { TerminationCause } from '../../transport/tcp/enums';
import { defineQueryStatusHeuristic } from './query-status-probe';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const NORMATIVE = [{ doc: RFC9110, locator: { kind: LocatorKind.Section, value: '5' }, req: ReqLevel.Unmarked }];

const rule = defineQueryStatusHeuristic({
  id: Rule.MalformedPercentNoHardFail,
  normative: NORMATIVE,
  tags: { cwe: ['CWE-20'] },
  rawQuery: 'a=%zz',
});

const head = (status: string): string => `HTTP/1.1 ${status}\r\n\r\n`;
const countQuestionMarks = (line: string): number => line.split('?').length - 1;

interface Exchange {
  readonly response: string;
  readonly termination: TerminationCause;
}

/** A ProbeFn that replays a distinct exchange per call (repeating the last for extra calls),
 *  entirely index-driven — no branching inside the probe body. */
function sequencedProbe(...exchanges: readonly Exchange[]): ProbeFn {
  let call = 0;
  return async () => {
    const exchange = exchanges[Math.min(call, exchanges.length - 1)]!;
    call += 1;
    return Promise.resolve({ response: new TextEncoder().encode(exchange.response), termination: exchange.termination });
  };
}

/** A ProbeFn that records every request-line it was sent (in call order) and always replies with
 *  the same canned response. */
function recordingProbe(rawResponse: string): { probe: ProbeFn; lines: string[] } {
  const lines: string[] = [];
  const probe: ProbeFn = async bytes => {
    lines.push(new TextDecoder().decode(bytes).split('\r\n')[0] ?? '');
    return Promise.resolve({ response: new TextEncoder().encode(rawResponse), termination: TerminationCause.Fin });
  };
  return { probe, lines };
}

test('Warns when the control is stable and the hostile vector 5xxs', async () => {
  const out = await rule.run({ probe: replay(head('200 OK'), head('500 Internal Server Error')), target: TARGET });
  expect(out.verdict).toBe(Verdict.Warn);
});

test('Passes when the control is stable and the hostile vector does not 5xx', async () => {
  const out = await rule.run({ probe: replay(head('200 OK'), head('400 Bad Request')), target: TARGET });
  expect(out.verdict).toBe(Verdict.Pass);
});

test('Skips as endpoint-unstable when the control itself is not 2xx/3xx', async () => {
  const out = await rule.run({ probe: replay(head('500 Internal Server Error')), target: TARGET });
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointUnstable);
});

test('Skips as endpoint-unstable when the control response is unparseable', async () => {
  const out = await rule.run({
    probe: async () => Promise.resolve({ response: new TextEncoder().encode('not http'), termination: TerminationCause.Fin }),
    target: TARGET,
  });
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointUnstable);
});

test('is inconclusive with connection-refused when the control probe cannot reach the target', async () => {
  const out = await rule.run({
    probe: async () => Promise.resolve({ response: new Uint8Array(0), termination: TerminationCause.Unreachable }),
    target: TARGET,
  });
  expect(out.verdict).toBe(Verdict.Inconclusive);
  expect(out.reason).toBe(InconclusiveReason.ConnectionRefused);
});

test('is inconclusive with a timeout reason when the hostile probe times out after a stable control', async () => {
  const out = await rule.run({
    probe: sequencedProbe(
      { response: head('200 OK'), termination: TerminationCause.Fin },
      { response: '', termination: TerminationCause.Timeout },
    ),
    target: TARGET,
  });
  expect(out.verdict).toBe(Verdict.Inconclusive);
  expect(out.reason).toBe(InconclusiveReason.Timeout);
});

test('sends the control probe at ?a=1 and the hostile probe at the declared rawQuery, both against target.path', async () => {
  const { probe, lines } = recordingProbe(head('200 OK'));
  const out = await rule.run({ probe, target: TARGET });
  expect(lines).toEqual(['GET /?a=1 HTTP/1.1', 'GET /?a=%zz HTTP/1.1']);
  expect(out.verdict).toBe(Verdict.Pass);
});

test('never touches context.reflect — runs identically whether or not reflect is opted in', async () => {
  const withoutReflect = await rule.run({ probe: replay(head('200 OK'), head('500 Internal Server Error')), target: TARGET });
  const withReflect = await rule.run({
    probe: replay(head('200 OK'), head('500 Internal Server Error')),
    target: TARGET,
    reflect: { mode: 'form', path: '/somewhere-else' },
  });
  expect(withoutReflect.verdict).toBe(Verdict.Warn);
  expect(withReflect.verdict).toBe(Verdict.Warn);
});

test('does not double the query when target.path already carries one — joins with & instead of a second ?', async () => {
  const targetWithQuery: HttpTarget = { ...TARGET, path: '/?existing=1' };
  const { probe, lines } = recordingProbe(head('200 OK'));
  await rule.run({ probe, target: targetWithQuery });
  expect(lines).toEqual(['GET /?existing=1&a=1 HTTP/1.1', 'GET /?existing=1&a=%zz HTTP/1.1']);
  expect(lines.map(countQuestionMarks)).toEqual([1, 1]);
});

test('is tagged with the caller-declared CWE', () => {
  expect(rule.tags?.cwe).toEqual(['CWE-20']);
});
