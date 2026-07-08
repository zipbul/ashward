import { test, expect } from 'bun:test';

import type { ProbeFn } from '../../../../core/contract/types';
import type { ProbeResult } from '../../../../core/driver/interfaces';

import { Rule, Verdict } from '../../../../core/contract/enums';
import { TerminationCause } from '../../../../core/driver/enums';
import { clTeConflict } from './cl-te-conflict';

const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);
const probeReturning =
  (result: ProbeResult): ProbeFn =>
  async () =>
    result;
const response = (raw: string, termination: TerminationCause): ProbeResult => ({
  response: bytes(raw),
  termination,
});

test('reports its own rule id', async () => {
  const probe = probeReturning(response('HTTP/1.1 400 Bad Request\r\n\r\n', TerminationCause.Fin));
  const result = await clTeConflict.run({ probe });
  expect(result.ruleId).toBe(Rule.ClTeConflict);
});

test('fails when the server accepts a Content-Length + Transfer-Encoding request', async () => {
  const probe = probeReturning(response('HTTP/1.1 200 OK\r\n\r\n', TerminationCause.Fin));
  const result = await clTeConflict.run({ probe });
  expect(result.verdict).toBe(Verdict.Fail);
});

test('passes when the server rejects the conflicting request', async () => {
  const probe = probeReturning(response('HTTP/1.1 400 Bad Request\r\n\r\n', TerminationCause.Fin));
  const result = await clTeConflict.run({ probe });
  expect(result.verdict).toBe(Verdict.Pass);
});

test('sends a request carrying both Content-Length and Transfer-Encoding', async () => {
  let sent = '';
  const probe: ProbeFn = async b => {
    sent = new TextDecoder().decode(b);
    return response('HTTP/1.1 200 OK\r\n\r\n', TerminationCause.Fin);
  };
  await clTeConflict.run({ probe });
  expect(sent).toMatch(/^Content-Length:/im);
  expect(sent).toMatch(/^Transfer-Encoding:/im);
});

test('cites RFC 9112 §6.1 as a normative source', () => {
  const cited = clTeConflict.normative.some(ref => ref.doc.code === 'RFC 9112' && ref.locator.value === '6.1');
  expect(cited).toBe(true);
});
