import { test, expect } from 'bun:test';

import type { HttpTarget, ProbeFn } from '../../http/context';

import { Rule, SkipReason, Verdict } from '../../core/contract/enums';
import { RFC9110 } from '../../standards/documents';
import { LocatorKind, ReqLevel } from '../../standards/enums';
import { capturingProbe, replay, res } from '../../testkit/replay';
import { TerminationCause } from '../../transport/tcp/enums';
import { defineReflectRule } from './reflect-rule';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/echo', timeoutMs: 500 };
const NORMATIVE = [{ doc: RFC9110, locator: { kind: LocatorKind.Section, value: '5' }, req: ReqLevel.Must }];

const rule = defineReflectRule({
  id: Rule.UrlencodedAmpersandOnlySeparator,
  normative: NORMATIVE,
  mode: 'form',
  rawQuery: 'a=1',
  expectedPairs: [['a', '1']],
});

const jsonBody = (pairs: readonly (readonly [string, string])[]): string => JSON.stringify(pairs);
const countQuestionMarks = (line: string): number => line.split('?').length - 1;

/** Split one `a=1` (or bare `a`) form-urlencoded pair on its FIRST `=`. */
function splitPair(pair: string): readonly [string, string] {
  const eq = pair.indexOf('=');
  return eq === -1 ? [pair, ''] : [pair.slice(0, eq), pair.slice(eq + 1)];
}

/** The query pairs a genuinely conformant reflector would echo for `requestTarget` — parsed from
 *  whatever request-target it actually received, never a canned answer. */
function queryPairsOf(requestTarget: string): (readonly [string, string])[] {
  const qIndex = requestTarget.indexOf('?');
  if (qIndex === -1) {
    return [];
  }
  const queryString = requestTarget.slice(qIndex + 1);
  return queryString.length === 0 ? [] : queryString.split('&').map(splitPair);
}

/** A ProbeFn behaving like a genuinely conformant reflector: it echoes back exactly the query it
 *  actually received, as pair-list JSON — so, unlike a canned response, it would catch a
 *  regression where a pre-existing query leaks back onto the wire (the old `&`-join bug). */
function conformantReflectorProbe(): ProbeFn {
  return async bytes => {
    const requestLine = new TextDecoder().decode(bytes).split('\r\n')[0] ?? '';
    const requestTarget = requestLine.split(' ')[1] ?? '';
    const raw = `${res('200 OK', 'Content-Type: application/json')}${jsonBody(queryPairsOf(requestTarget))}`;
    return Promise.resolve({ response: new TextEncoder().encode(raw), termination: TerminationCause.Fin });
  };
}

test('Skips as endpoint-not-reflecting when reflect is undefined', async () => {
  const out = await rule.run({ probe: replay(res('200 OK', '')), target: TARGET });
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointNotReflecting);
});

test('Skips as endpoint-not-reflecting when reflect.mode does not match this rule', async () => {
  const out = await rule.run({ probe: replay(res('200 OK', '')), target: TARGET, reflect: { mode: 'uri-generic' } });
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointNotReflecting);
});

test('Skips as endpoint-not-reflecting on a non-2xx response', async () => {
  const response = `${res('404 Not Found', 'Content-Type: application/json')}${jsonBody([['a', '1']])}`;
  const out = await rule.run({
    probe: async () => Promise.resolve({ response: new TextEncoder().encode(response), termination: TerminationCause.Fin }),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointNotReflecting);
});

test('Skips as endpoint-not-reflecting on a malformed (non-JSON) body', async () => {
  const raw = `${res('200 OK', 'Content-Type: text/plain')}not json`;
  const out = await rule.run({
    probe: async () => Promise.resolve({ response: new TextEncoder().encode(raw), termination: TerminationCause.Fin }),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointNotReflecting);
});

test('Skips as endpoint-not-reflecting when the body is JSON but not a pair list', async () => {
  const raw = `${res('200 OK', 'Content-Type: application/json')}${JSON.stringify({ a: '1' })}`;
  const out = await rule.run({
    probe: async () => Promise.resolve({ response: new TextEncoder().encode(raw), termination: TerminationCause.Fin }),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointNotReflecting);
});

/** isPairList adversarial shapes: none of these is a conforming echo — every one must Skip, never
 *  crash and never a false Fail/Pass from indexing into a shape that isn't actually a pair list. */
const adversarialBodies: readonly [string, unknown][] = [
  ['a JSON object (not an array) at the top level', { a: '1' }],
  ['an array of non-2-element arrays', [['a']]],
  ['an array of 3-element arrays', [['a', '1', 'extra']]],
  ['an array with a non-string second member', [['a', 1]]],
  ['an array with a non-string first member', [[1, 'a']]],
  ['an array containing a nested object instead of a pair', [['a', { nested: true }]]],
  ['an array containing null instead of a pair', [null, ['a', '1']]],
  ['an array of bare strings instead of pairs', ['a', '1']],
  ['a deeply nested array-of-array-of-array', [[['a'], '1']]],
];

test("strips a pre-existing query on the reflect path — sends only the rule's own query, never doubled", async () => {
  const targetWithQuery: HttpTarget = { ...TARGET, path: '/echo?existing=1' };
  const { probe, sentLine } = capturingProbe(`${res('200 OK', 'Content-Type: application/json')}${jsonBody([['a', '1']])}`);
  const out = await rule.run({ probe, target: targetWithQuery, reflect: { mode: 'form' } });
  expect(sentLine()).toBe('GET /echo?a=1 HTTP/1.1');
  expect(countQuestionMarks(sentLine())).toBe(1);
  expect(out.verdict).toBe(Verdict.Pass);
});

/** The proof that stripping actually prevents a false Fail: a genuinely conformant reflector (one
 *  that echoes back exactly the query it received, parsed into pairs) must never be judged against
 *  pairs it was never even sent. Unlike a canned response, this probe derives its answer from the
 *  actual request-target it was given — so it would catch a regression where the pre-existing query
 *  leaks back onto the wire (the old `&`-join bug), which a canned "always answer [['a','1']]" mock
 *  cannot. */
test('a reflect path with a pre-existing query does not false-Fail a conformant reflector', async () => {
  const targetWithQuery: HttpTarget = { ...TARGET, path: '/echo?existing=1&other=2' };
  const out = await rule.run({ probe: conformantReflectorProbe(), target: targetWithQuery, reflect: { mode: 'form' } });
  expect(out.verdict).toBe(Verdict.Pass);
});

for (const [description, body] of adversarialBodies) {
  test(`Skips as endpoint-not-reflecting, never crashes or false-Fails, on ${description}`, async () => {
    const raw = `${res('200 OK', 'Content-Type: application/json')}${JSON.stringify(body)}`;
    const out = await rule.run({
      probe: async () => Promise.resolve({ response: new TextEncoder().encode(raw), termination: TerminationCause.Fin }),
      target: TARGET,
      reflect: { mode: 'form' },
    });
    expect(out.verdict).toBe(Verdict.Skip);
    expect(out.reason).toBe(SkipReason.EndpointNotReflecting);
  });
}

test('Passes on a 2xx echo whose pairs deep-equal the oracle expected pairs', async () => {
  const raw = `${res('200 OK', 'Content-Type: application/json')}${jsonBody([['a', '1']])}`;
  const out = await rule.run({
    probe: async () => Promise.resolve({ response: new TextEncoder().encode(raw), termination: TerminationCause.Fin }),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Pass);
});

test('Fails on a 2xx echo whose pairs differ from the oracle expected pairs', async () => {
  const raw = `${res('200 OK', 'Content-Type: application/json')}${jsonBody([['a', 'wrong']])}`;
  const out = await rule.run({
    probe: async () => Promise.resolve({ response: new TextEncoder().encode(raw), termination: TerminationCause.Fin }),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Fail);
});

test('Skips as endpoint-not-reflecting on a truncated body (Content-Length promises more than actually arrived), even when the truncated prefix happens to be valid, matching JSON', async () => {
  // The header claims a much larger body than what actually arrived — decodeBody's completeness
  // check (available bytes vs. Content-Length) must gate the judge BEFORE it ever parses the
  // partial content as if it were the whole echo, even though the truncated prefix here happens
  // to be exactly the well-formed, oracle-matching JSON.
  const body = jsonBody([['a', '1']]);
  const raw = `${res('200 OK', `Content-Type: application/json\r\nContent-Length: ${body.length + 500}`)}${body}`;
  const out = await rule.run({
    probe: async () => Promise.resolve({ response: new TextEncoder().encode(raw), termination: TerminationCause.Fin }),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointNotReflecting);
});
