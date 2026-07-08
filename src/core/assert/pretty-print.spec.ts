import { test, expect } from 'bun:test';

import type { ClauseResult } from '../contract/interfaces';

import { Rule, Verdict, InconclusiveReason } from '../contract/enums';
import { formatFailures } from './pretty-print';

const fail: ClauseResult = { ruleId: Rule.DuplicateContentLength, verdict: Verdict.Fail };
const inconclusive: ClauseResult = {
  ruleId: Rule.DuplicateContentLength,
  verdict: Verdict.Inconclusive,
  reason: InconclusiveReason.Timeout,
};

test('names the failing rule and its verdict', () => {
  const message = formatFailures([fail]);
  expect(message).toContain('http.framing.duplicate-content-length');
  expect(message).toContain('fail');
});

test('includes the typed reason when present', () => {
  expect(formatFailures([inconclusive])).toContain('timeout');
});

test('states how many checks failed', () => {
  expect(formatFailures([fail])).toContain('1 conformance check');
});

test('omits the reason parenthetical on a clause line that has no reason', () => {
  const clauseLine = formatFailures([fail])
    .split('\n')
    .find(line => line.includes('✗'));
  expect(clauseLine).not.toContain('(');
});

test('lists every failing clause and counts them', () => {
  const message = formatFailures([fail, inconclusive]);
  expect(message).toContain('2 conformance check');
  const clauseLines = message.split('\n').filter(line => line.includes('✗'));
  expect(clauseLines.length).toBe(2);
});

test('reports zero when given no failures (edge)', () => {
  expect(formatFailures([])).toContain('0 conformance check');
});
