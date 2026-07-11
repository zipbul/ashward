import { test, expect } from 'bun:test';

import { Rule } from '../core/contract/enums';
import { ALL_RULES } from './all';

test('includes the duplicate-content-length rule', () => {
  const ids = ALL_RULES.map(rule => rule.id);
  expect(ids).toContain(Rule.DuplicateContentLength);
});

test('every rule carries at least one normative source', () => {
  for (const rule of ALL_RULES) {
    expect(rule.normative.length).toBeGreaterThan(0);
  }
});

test('every rule exposes a stable id and a run function', () => {
  for (const rule of ALL_RULES) {
    expect(typeof rule.id).toBe('string');
    expect(typeof rule.run).toBe('function');
  }
});

test('rule ids are unique', () => {
  const ids = ALL_RULES.map(rule => rule.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test('every rule id is a member of the frozen Rule roster', () => {
  const roster = new Set<string>(Object.values(Rule));
  const strays = ALL_RULES.map(rule => rule.id).filter(id => !roster.has(id));
  expect(strays).toEqual([]);
});

test('every rule in the frozen roster is shipped — the roster is complete', () => {
  const shipped = new Set(ALL_RULES.map(rule => rule.id));
  const missing = Object.values(Rule).filter(id => !shipped.has(id));
  expect(missing).toEqual([]);
  expect(shipped.size).toBe(Object.values(Rule).length);
});
