import { test, expect } from 'bun:test';

import type { ClauseResult } from '../contract/interfaces';
import type { ClauseReason } from '../contract/types';
import type { ReportPolicy } from './interfaces';

import { InconclusiveReason, Verdict, Rule } from '../contract/enums';
import { InconclusiveHandling } from './enums';
import { resolveOk, selectBlocking } from './ok-policy';

const clause = (verdict: Verdict, reason?: ClauseReason): ClauseResult => ({
  ruleId: Rule.DuplicateContentLength,
  verdict,
  ...(reason !== undefined ? { reason } : {}),
});
const undecidable = clause(Verdict.Inconclusive, InconclusiveReason.AmbiguousFraming);
const unreachable = clause(Verdict.Inconclusive, InconclusiveReason.ConnectionRefused);

const policy = (over: Partial<ReportPolicy> = {}): ReportPolicy => ({
  failOn: Verdict.Fail,
  inconclusive: InconclusiveHandling.Ignore,
  ...over,
});

test('is ok when every result passes', () => {
  expect(resolveOk([clause(Verdict.Pass), clause(Verdict.Pass)], policy())).toBe(true);
});

test('is ok for an empty result set', () => {
  expect(resolveOk([], policy())).toBe(true);
});

test('is not ok when a result fails and failOn is Fail', () => {
  expect(resolveOk([clause(Verdict.Pass), clause(Verdict.Fail)], policy())).toBe(false);
});

test('is ok for a warn when failOn is Fail (warn is below the threshold)', () => {
  expect(resolveOk([clause(Verdict.Warn)], policy({ failOn: Verdict.Fail }))).toBe(true);
});

test('is not ok for a warn when failOn is Warn', () => {
  expect(resolveOk([clause(Verdict.Warn)], policy({ failOn: Verdict.Warn }))).toBe(false);
});

test('is not ok for a fail when failOn is Warn (fail is above the threshold)', () => {
  expect(resolveOk([clause(Verdict.Fail)], policy({ failOn: Verdict.Warn }))).toBe(false);
});

test('ignores an undecidable inconclusive (reached but odd response) by default', () => {
  expect(resolveOk([undecidable], policy())).toBe(true);
});

test('is not ok for an undecidable inconclusive when handling is Fail', () => {
  expect(resolveOk([undecidable], policy({ inconclusive: InconclusiveHandling.Fail }))).toBe(false);
});

test('is not ok for a connectivity inconclusive even when handling is Ignore (the gate never ran)', () => {
  expect(resolveOk([unreachable], policy({ inconclusive: InconclusiveHandling.Ignore }))).toBe(false);
});

test('is ok for skip results', () => {
  expect(resolveOk([clause(Verdict.Skip)], policy())).toBe(true);
});

test('selectBlocking returns only the results that block under the policy', () => {
  const results = [clause(Verdict.Pass), clause(Verdict.Fail), clause(Verdict.Warn)];
  const blocking = selectBlocking(results, policy({ failOn: Verdict.Fail }));
  expect(blocking).toEqual([clause(Verdict.Fail)]);
});

test('selectBlocking returns an empty list when nothing blocks', () => {
  expect(selectBlocking([clause(Verdict.Pass), clause(Verdict.Skip)], policy())).toEqual([]);
});

test('selectBlocking includes an undecidable inconclusive when handling is Fail', () => {
  const results = [undecidable, clause(Verdict.Pass)];
  const blocking = selectBlocking(results, policy({ inconclusive: InconclusiveHandling.Fail }));
  expect(blocking).toEqual([undecidable]);
});
