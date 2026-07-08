import { test, expect } from 'bun:test';

import type { ClauseResult } from '../contract/interfaces';

import { Verdict, Rule } from '../contract/enums';
import { InconclusiveHandling } from './enums';
import { buildReport } from './report';

const clause = (verdict: Verdict): ClauseResult => ({ ruleId: Rule.DuplicateContentLength, verdict });

test('exposes the results it was built from', () => {
  const results = [clause(Verdict.Pass)];
  expect(buildReport(results).results).toEqual(results);
});

test('ok() is true under the default policy when all results pass', () => {
  expect(buildReport([clause(Verdict.Pass)]).ok()).toBe(true);
});

test('ok() is false under the default policy when a result fails', () => {
  expect(buildReport([clause(Verdict.Fail)]).ok()).toBe(false);
});

test('ok() applies a partial policy override for failOn', () => {
  expect(buildReport([clause(Verdict.Warn)]).ok({ failOn: Verdict.Warn })).toBe(false);
});

test('ok() applies a partial policy override for inconclusive handling', () => {
  expect(buildReport([clause(Verdict.Inconclusive)]).ok({ inconclusive: InconclusiveHandling.Fail })).toBe(false);
});
