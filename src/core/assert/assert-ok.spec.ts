import { test, expect } from 'bun:test';

import type { ClauseResult } from '../contract/interfaces';
import type { ClauseReason } from '../contract/types';

import { InconclusiveReason, Rule, Verdict } from '../contract/enums';
import { InconclusiveHandling } from '../report/enums';
import { buildReport } from '../report/report';
import { AshwardError } from './ashward-error';
import { assertOk } from './assert-ok';

const clause = (verdict: Verdict, reason?: ClauseReason): ClauseResult => ({
  ruleId: Rule.DuplicateContentLength,
  verdict,
  ...(reason !== undefined ? { reason } : {}),
});

/** Run `assertOk` and return the thrown AshwardError, narrowed without a cast. */
function captureAshwardError(run: () => void): AshwardError {
  try {
    run();
  } catch (error) {
    if (error instanceof AshwardError) {
      return error;
    }
    throw error;
  }
  throw new Error('expected assertOk to throw an AshwardError');
}

test('does not throw when the report is ok', () => {
  const report = buildReport([clause(Verdict.Pass)]);
  expect(() => {
    assertOk(report);
  }).not.toThrow();
});

test('throws AshwardError when a rule fails under the default policy', () => {
  const report = buildReport([clause(Verdict.Fail)]);
  expect(() => {
    assertOk(report);
  }).toThrow(AshwardError);
});

test('throws under failOn Warn when a warn is present', () => {
  const report = buildReport([clause(Verdict.Warn)]);
  expect(() => {
    assertOk(report, { failOn: Verdict.Warn });
  }).toThrow(AshwardError);
});

test('does not throw for a warn under the default policy', () => {
  const report = buildReport([clause(Verdict.Warn)]);
  expect(() => {
    assertOk(report);
  }).not.toThrow();
});

test('throws under the default policy for a connectivity inconclusive (unreachable server)', () => {
  const report = buildReport([clause(Verdict.Inconclusive, InconclusiveReason.ConnectionRefused)]);
  expect(() => {
    assertOk(report);
  }).toThrow(AshwardError);
});

test('does not throw for an undecidable inconclusive under the default policy', () => {
  const report = buildReport([clause(Verdict.Inconclusive, InconclusiveReason.AmbiguousFraming)]);
  expect(() => {
    assertOk(report);
  }).not.toThrow();
});

test('throws for an undecidable inconclusive when handling is escalated to Fail', () => {
  const report = buildReport([clause(Verdict.Inconclusive, InconclusiveReason.AmbiguousFraming)]);
  expect(() => {
    assertOk(report, { inconclusive: InconclusiveHandling.Fail });
  }).toThrow(AshwardError);
});

test('the thrown error carries only the blocking results', () => {
  const report = buildReport([clause(Verdict.Pass), clause(Verdict.Fail)]);
  const error = captureAshwardError(() => {
    assertOk(report);
  });
  expect(error.results).toEqual([clause(Verdict.Fail)]);
});
