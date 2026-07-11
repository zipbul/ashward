import { test, expect } from 'bun:test';

import type { ProbeFn } from '../core/contract/types';
import type { Target } from '../core/engine/interfaces';

import { Rule, InconclusiveReason, SkipReason, Verdict } from '../core/contract/enums';
import { TerminationCause } from '../core/driver/enums';
import { accessControlAllowCredentialsExactTrue } from './access-control-allow-credentials-exact-true';

const TARGET: Target = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };

const respond =
  (raw: string, termination = TerminationCause.Fin): ProbeFn =>
  async () =>
    Promise.resolve({ response: new TextEncoder().encode(raw), termination });

const withAcac = (value: string): string => `HTTP/1.1 200 OK\r\nAccess-Control-Allow-Credentials: ${value}\r\n\r\n`;
const run = async (probe: ProbeFn) => accessControlAllowCredentialsExactTrue.run({ probe, target: TARGET });

test('passes on the exact lowercase true', async () => {
  expect((await run(respond(withAcac('true')))).verdict).toBe(Verdict.Pass);
});

test('fails on capitalized True', async () => {
  expect((await run(respond(withAcac('True')))).verdict).toBe(Verdict.Fail);
});

test('fails on the numeric 1', async () => {
  expect((await run(respond(withAcac('1')))).verdict).toBe(Verdict.Fail);
});

test('fails on false — Fetch defines no value but the exact bytes true (a §1.4 MUST violation)', async () => {
  expect((await run(respond(withAcac('false')))).verdict).toBe(Verdict.Fail);
});

test('fails on two Access-Control-Allow-Credentials field lines', async () => {
  const raw = 'HTTP/1.1 200 OK\r\nAccess-Control-Allow-Credentials: true\r\nAccess-Control-Allow-Credentials: true\r\n\r\n';
  expect((await run(respond(raw))).verdict).toBe(Verdict.Fail);
});

test('skips with header-absent when the header is not sent', async () => {
  const result = await run(respond('HTTP/1.1 200 OK\r\n\r\n'));
  expect(result.verdict).toBe(Verdict.Skip);
  expect(result.reason).toBe(SkipReason.HeaderAbsent);
});

test('is a connectivity inconclusive when the target is unreachable', async () => {
  const result = await run(respond('', TerminationCause.Unreachable));
  expect(result.verdict).toBe(Verdict.Inconclusive);
  expect(result.reason).toBe(InconclusiveReason.ConnectionRefused);
});

test('reports its own rule id', async () => {
  expect((await run(respond(withAcac('true')))).ruleId).toBe(Rule.AccessControlAllowCredentialsExactTrue);
});

test('aims the probe at the target path with a cross-origin Origin and no Cookie', async () => {
  let sent = '';
  const probe: ProbeFn = async bytes => {
    sent = new TextDecoder().decode(bytes);
    return Promise.resolve({ response: new TextEncoder().encode(withAcac('true')), termination: TerminationCause.Fin });
  };
  await accessControlAllowCredentialsExactTrue.run({ probe, target: { ...TARGET, path: '/api/x' } });
  expect(sent.startsWith('GET /api/x HTTP/1.1\r\n')).toBe(true);
  expect(sent).toContain('Host: origin.test\r\n');
  expect(sent).toContain('Origin: https://ashward.invalid\r\n');
  expect(sent).not.toContain('Cookie:');
});
