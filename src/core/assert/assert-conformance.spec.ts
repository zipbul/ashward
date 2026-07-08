import { test, expect } from 'bun:test';
import { assertConformance } from './assert-conformance';
import { AshwardError } from './ashward-error';
import { buildReport } from '../report/report';
import { Rule, Verdict } from '../contract/enums';
import { InconclusiveHandling } from '../report/enums';
import type { ClauseResult } from '../contract/interfaces';

const clause = (verdict: Verdict): ClauseResult => ({ ruleId: Rule.DuplicateContentLength, verdict });

test('does not throw when the report is ok', () => {
  const report = buildReport([clause(Verdict.Pass)]);
  expect(() => assertConformance(report)).not.toThrow();
});

test('throws AshwardError when a rule fails under the default policy', () => {
  const report = buildReport([clause(Verdict.Fail)]);
  expect(() => assertConformance(report)).toThrow(AshwardError);
});

test('throws under failOn Warn when a warn is present', () => {
  const report = buildReport([clause(Verdict.Warn)]);
  expect(() => assertConformance(report, { failOn: Verdict.Warn })).toThrow(AshwardError);
});

test('does not throw for a warn under the default policy', () => {
  const report = buildReport([clause(Verdict.Warn)]);
  expect(() => assertConformance(report)).not.toThrow();
});

test('throws for an inconclusive result when handling is Fail', () => {
  const report = buildReport([clause(Verdict.Inconclusive)]);
  expect(() => assertConformance(report, { inconclusive: InconclusiveHandling.Fail })).toThrow(
    AshwardError,
  );
});

test('the thrown error carries only the blocking results', () => {
  const report = buildReport([clause(Verdict.Pass), clause(Verdict.Fail)]);
  try {
    assertConformance(report);
    expect.unreachable();
  } catch (error) {
    expect((error as AshwardError).results).toEqual([clause(Verdict.Fail)]);
  }
});
