import { test, expect } from 'bun:test';

import type { HttpTarget } from '../../http/context';

import { Rule, SkipReason, Verdict } from '../../core/contract/enums';
import { RFC9110 } from '../../standards/documents';
import { LocatorKind, ReqLevel } from '../../standards/enums';
import { replay } from '../../testkit/replay';
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

const head = (status: string, fields: string): string => `HTTP/1.1 ${status}\r\n${fields}\r\n\r\n`;
const jsonBody = (pairs: readonly (readonly [string, string])[]): string => JSON.stringify(pairs);

test('Skips as endpoint-not-reflecting when reflect is undefined', async () => {
  const out = await rule.run({ probe: replay(head('200 OK', '')), target: TARGET });
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointNotReflecting);
});

test('Skips as endpoint-not-reflecting when reflect.mode does not match this rule', async () => {
  const out = await rule.run({ probe: replay(head('200 OK', '')), target: TARGET, reflect: { mode: 'uri-generic' } });
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointNotReflecting);
});

test('Skips as endpoint-not-reflecting on a non-2xx response', async () => {
  const response = `${head('404 Not Found', 'Content-Type: application/json')}${jsonBody([['a', '1']])}`;
  const out = await rule.run({
    probe: async () => Promise.resolve({ response: new TextEncoder().encode(response), termination: TerminationCause.Fin }),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointNotReflecting);
});

test('Skips as endpoint-not-reflecting on a malformed (non-JSON) body', async () => {
  const raw = `${head('200 OK', 'Content-Type: text/plain')}not json`;
  const out = await rule.run({
    probe: async () => Promise.resolve({ response: new TextEncoder().encode(raw), termination: TerminationCause.Fin }),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointNotReflecting);
});

test('Skips as endpoint-not-reflecting when the body is JSON but not a pair list', async () => {
  const raw = `${head('200 OK', 'Content-Type: application/json')}${JSON.stringify({ a: '1' })}`;
  const out = await rule.run({
    probe: async () => Promise.resolve({ response: new TextEncoder().encode(raw), termination: TerminationCause.Fin }),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointNotReflecting);
});

test('Passes on a 2xx echo whose pairs deep-equal the oracle expected pairs', async () => {
  const raw = `${head('200 OK', 'Content-Type: application/json')}${jsonBody([['a', '1']])}`;
  const out = await rule.run({
    probe: async () => Promise.resolve({ response: new TextEncoder().encode(raw), termination: TerminationCause.Fin }),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Pass);
});

test('Fails on a 2xx echo whose pairs differ from the oracle expected pairs', async () => {
  const raw = `${head('200 OK', 'Content-Type: application/json')}${jsonBody([['a', 'wrong']])}`;
  const out = await rule.run({
    probe: async () => Promise.resolve({ response: new TextEncoder().encode(raw), termination: TerminationCause.Fin }),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Fail);
});
