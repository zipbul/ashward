import { test, expect } from 'bun:test';

import { Rule } from '../core/contract/enums';
import { BUILTIN_RULES } from './constants';

test('includes the duplicate-content-length rule', () => {
  const ids = BUILTIN_RULES.map(rule => rule.id);
  expect(ids).toContain(Rule.DuplicateContentLength);
});

test('every built-in rule exposes a stable id and a run function', () => {
  for (const rule of BUILTIN_RULES) {
    expect(typeof rule.id).toBe('string');
    expect(typeof rule.run).toBe('function');
  }
});

test('built-in rule ids are unique', () => {
  const ids = BUILTIN_RULES.map(rule => rule.id);
  expect(new Set(ids).size).toBe(ids.length);
});
