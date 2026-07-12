import { test, expect } from 'bun:test';

import type { ClauseResult } from '../contract/interfaces';
import type { ClauseReason } from '../contract/types';

import { InconclusiveReason, Verdict, Rule } from '../contract/enums';
import { InconclusiveHandling } from './enums';
import { buildReport } from './report';

const clause = (verdict: Verdict, reason?: ClauseReason): ClauseResult => ({
  ruleId: Rule.DuplicateContentLength,
  verdict,
  ...(reason !== undefined ? { reason } : {}),
});

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

test('ok() is false under the default policy for a connectivity inconclusive (dead server, fail-closed)', () => {
  expect(buildReport([clause(Verdict.Inconclusive, InconclusiveReason.ConnectionRefused)]).ok()).toBe(false);
});

test('ok() ignores an undecidable inconclusive (reached, odd response) by default', () => {
  expect(buildReport([clause(Verdict.Inconclusive, InconclusiveReason.AmbiguousFraming)]).ok()).toBe(true);
});

test('ok() can be made to block undecidable inconclusive results too', () => {
  const report = buildReport([clause(Verdict.Inconclusive, InconclusiveReason.AmbiguousFraming)]);
  expect(report.ok({ inconclusive: InconclusiveHandling.Fail })).toBe(false);
});
