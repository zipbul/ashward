import { test, expect } from 'bun:test';

import type { ClauseResult } from '../contract/interfaces';
import type { ReportPolicy } from './interfaces';

import { Verdict, Rule } from '../contract/enums';
import { InconclusiveHandling } from './enums';
import { resolveOk, selectBlocking } from './ok-policy';

const clause = (verdict: Verdict): ClauseResult => ({ ruleId: Rule.DuplicateContentLength, verdict });

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

test('ignores inconclusive by default', () => {
  expect(resolveOk([clause(Verdict.Inconclusive)], policy())).toBe(true);
});

test('is not ok for inconclusive when handling is Fail', () => {
  expect(resolveOk([clause(Verdict.Inconclusive)], policy({ inconclusive: InconclusiveHandling.Fail }))).toBe(false);
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

test('selectBlocking includes inconclusive results when handling is Fail', () => {
  const results = [clause(Verdict.Inconclusive), clause(Verdict.Pass)];
  const blocking = selectBlocking(results, policy({ inconclusive: InconclusiveHandling.Fail }));
  expect(blocking).toEqual([clause(Verdict.Inconclusive)]);
});
