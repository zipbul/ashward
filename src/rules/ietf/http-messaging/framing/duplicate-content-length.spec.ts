import { test, expect } from 'bun:test';
import { duplicateContentLength } from './duplicate-content-length';
import { Rule, Verdict, InconclusiveReason } from '../../../../core/contract/enums';
import { TerminationCause } from '../../../../core/driver/enums';
import type { ProbeFn } from '../../../../core/contract/types';
import type { ProbeResult } from '../../../../core/driver/interfaces';

const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);

/** Stub the target-bound probe (a function parameter) with a canned wire result. */
const probeReturning = (result: ProbeResult): ProbeFn => async () => result;

const response = (raw: string, termination: TerminationCause): ProbeResult => ({
  response: bytes(raw),
  termination,
});

test('fails when the server accepts the ambiguous request with a 2xx', async () => {
  const probe = probeReturning(response('HTTP/1.1 200 OK\r\n\r\n', TerminationCause.Fin));
  const result = await duplicateContentLength.run({ probe });
  expect(result.verdict).toBe(Verdict.Fail);
});

test('passes when the server rejects with a 4xx', async () => {
  const probe = probeReturning(response('HTTP/1.1 400 Bad Request\r\n\r\n', TerminationCause.Fin));
  const result = await duplicateContentLength.run({ probe });
  expect(result.verdict).toBe(Verdict.Pass);
});

test('passes when the server closes without serving a response', async () => {
  const probe = probeReturning(response('', TerminationCause.Fin));
  const result = await duplicateContentLength.run({ probe });
  expect(result.verdict).toBe(Verdict.Pass);
});

test('is inconclusive with a timeout reason when the server never responds', async () => {
  const probe = probeReturning(response('', TerminationCause.Timeout));
  const result = await duplicateContentLength.run({ probe });
  expect(result.verdict).toBe(Verdict.Inconclusive);
  expect(result.reason).toBe(InconclusiveReason.Timeout);
});

test('is inconclusive with an ambiguous-framing reason on an unclassifiable status', async () => {
  const probe = probeReturning(response('HTTP/1.1 100 Continue\r\n\r\n', TerminationCause.Fin));
  const result = await duplicateContentLength.run({ probe });
  expect(result.verdict).toBe(Verdict.Inconclusive);
  expect(result.reason).toBe(InconclusiveReason.AmbiguousFraming);
});

test('reports its own rule id on the result', async () => {
  const probe = probeReturning(response('HTTP/1.1 200 OK\r\n\r\n', TerminationCause.Fin));
  const result = await duplicateContentLength.run({ probe });
  expect(result.ruleId).toBe(Rule.DuplicateContentLength);
});

test('sends a request carrying two divergent Content-Length header lines', async () => {
  // Crafting the malformed frame IS the rule's behavior, so this asserts the probe input.
  let sent = '';
  const probe: ProbeFn = async (b) => {
    sent = new TextDecoder().decode(b);
    return response('HTTP/1.1 200 OK\r\n\r\n', TerminationCause.Fin);
  };
  await duplicateContentLength.run({ probe });
  const clHeaders = sent.split('\r\n').filter((line) => /^Content-Length:/i.test(line));
  expect(clHeaders.length).toBe(2);
});

test('carries the sent request and received response as evidence', async () => {
  const probe = probeReturning(response('HTTP/1.1 200 OK\r\n\r\n', TerminationCause.Fin));
  const result = await duplicateContentLength.run({ probe });
  expect(new TextDecoder().decode(result.evidence!.response)).toBe('HTTP/1.1 200 OK\r\n\r\n');
});

test('cites RFC 9112 §6.3 as a normative source', async () => {
  const cited = duplicateContentLength.normative.some(
    (ref) => ref.doc.code === 'RFC 9112' && ref.locator.value === '6.3',
  );
  expect(cited).toBe(true);
});

test('is tagged with CWE-444 (HTTP request smuggling)', () => {
  expect(duplicateContentLength.tags?.cwe).toContain('CWE-444');
});
