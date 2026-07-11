import { test, expect } from 'bun:test';

import type { ProbeFn } from '../../../core/contract/types';
import type { ProbeResult } from '../../../core/driver/interfaces';

import { Rule, Verdict, InconclusiveReason } from '../../../core/contract/enums';
import { TerminationCause } from '../../../core/driver/enums';
import { duplicateContentLength } from './duplicate-content-length';

const TARGET = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);

/** Stub the target-bound probe (a function parameter) with a canned wire result. */
const probeReturning =
  (result: ProbeResult): ProbeFn =>
  async () =>
    Promise.resolve(result);

const response = (raw: string, termination: TerminationCause): ProbeResult => ({
  response: bytes(raw),
  termination,
});

test('fails when the server accepts the ambiguous request with a 2xx', async () => {
  const probe = probeReturning(response('HTTP/1.1 200 OK\r\n\r\n', TerminationCause.Fin));
  const result = await duplicateContentLength.run({ probe, target: TARGET });
  expect(result.verdict).toBe(Verdict.Fail);
});

test('passes when the server rejects with a 4xx', async () => {
  const probe = probeReturning(response('HTTP/1.1 400 Bad Request\r\n\r\n', TerminationCause.Fin));
  const result = await duplicateContentLength.run({ probe, target: TARGET });
  expect(result.verdict).toBe(Verdict.Pass);
});

test('passes when the server closes without serving a response', async () => {
  const probe = probeReturning(response('', TerminationCause.Fin));
  const result = await duplicateContentLength.run({ probe, target: TARGET });
  expect(result.verdict).toBe(Verdict.Pass);
});

test('is inconclusive with a timeout reason when the server never responds', async () => {
  const probe = probeReturning(response('', TerminationCause.Timeout));
  const result = await duplicateContentLength.run({ probe, target: TARGET });
  expect(result.verdict).toBe(Verdict.Inconclusive);
  expect(result.reason).toBe(InconclusiveReason.Timeout);
});

test('is inconclusive with an ambiguous-framing reason on an unclassifiable status', async () => {
  const probe = probeReturning(response('HTTP/1.1 100 Continue\r\n\r\n', TerminationCause.Fin));
  const result = await duplicateContentLength.run({ probe, target: TARGET });
  expect(result.verdict).toBe(Verdict.Inconclusive);
  expect(result.reason).toBe(InconclusiveReason.AmbiguousFraming);
});

test('is inconclusive with a connection-refused reason when the target is unreachable', async () => {
  const probe = probeReturning(response('', TerminationCause.Unreachable));
  const result = await duplicateContentLength.run({ probe, target: TARGET });
  expect(result.verdict).toBe(Verdict.Inconclusive);
  expect(result.reason).toBe(InconclusiveReason.ConnectionRefused);
});

test('reports its own rule id on the result', async () => {
  const probe = probeReturning(response('HTTP/1.1 200 OK\r\n\r\n', TerminationCause.Fin));
  const result = await duplicateContentLength.run({ probe, target: TARGET });
  expect(result.ruleId).toBe(Rule.DuplicateContentLength);
});

test('sends a request carrying two divergent Content-Length header lines', async () => {
  // Crafting the malformed frame IS the rule's behavior, so this asserts the probe input.
  let sent = '';
  const probe: ProbeFn = async b => {
    sent = new TextDecoder().decode(b);
    return Promise.resolve(response('HTTP/1.1 200 OK\r\n\r\n', TerminationCause.Fin));
  };
  await duplicateContentLength.run({ probe, target: TARGET });
  const clHeaders = sent.split('\r\n').filter(line => /^Content-Length:/i.test(line));
  expect(clHeaders.length).toBe(2);
});

test('carries the sent request and received response as evidence', async () => {
  const probe = probeReturning(response('HTTP/1.1 200 OK\r\n\r\n', TerminationCause.Fin));
  const result = await duplicateContentLength.run({ probe, target: TARGET });
  expect(new TextDecoder().decode(result.evidence!.response)).toBe('HTTP/1.1 200 OK\r\n\r\n');
});

test('cites RFC 9112 §6.3 as a normative source', () => {
  const ref = duplicateContentLength.normative.find(source => source.locator.value === '6.3');
  expect(ref?.doc.code).toBe('RFC 9112');
});

test('is tagged with CWE-444 (HTTP request smuggling)', () => {
  expect(duplicateContentLength.tags?.cwe).toContain('CWE-444');
});
