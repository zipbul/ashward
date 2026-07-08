import { test, expect } from 'bun:test';

import type { ClauseResult } from '../contract/interfaces';

import { Rule, Verdict } from '../contract/enums';
import { AshwardError } from './ashward-error';

const fail: ClauseResult = { ruleId: Rule.DuplicateContentLength, verdict: Verdict.Fail };

test('is an Error named AshwardError', () => {
  const error = new AshwardError([fail]);
  expect(error).toBeInstanceOf(Error);
  expect(error.name).toBe('AshwardError');
});

test('carries the blocking results', () => {
  expect(new AshwardError([fail]).results).toEqual([fail]);
});

test('summarizes the failures in its message', () => {
  expect(new AshwardError([fail]).message).toContain('http.framing.duplicate-content-length');
});
