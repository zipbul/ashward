import { test, expect } from 'bun:test';

import { Rule } from '../core/contract/enums';
import { BUILTIN_RULES } from './constants';

test('includes the duplicate-content-length rule', () => {
  const ids = BUILTIN_RULES.map(rule => rule.id);
  expect(ids).toContain(Rule.DuplicateContentLength);
});

test('every built-in rule carries at least one normative source', () => {
  for (const rule of BUILTIN_RULES) {
    expect(rule.normative.length).toBeGreaterThan(0);
  }
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

test('every built-in rule id is a member of the frozen Rule roster', () => {
  const roster = new Set<string>(Object.values(Rule));
  const strays = BUILTIN_RULES.map(rule => rule.id).filter(id => !roster.has(id));
  expect(strays).toEqual([]);
});

test('the implemented rules are a subset of the frozen roster — CORS lands incrementally', () => {
  // Honest freeze accounting: the `Rule` enum freezes the full design roster, but implementation
  // is incremental. This is the explicit not-yet-implemented gap, not a silent one — as each CORS
  // rule lands it joins BUILTIN_RULES and this gap shrinks.
  const implemented = new Set(BUILTIN_RULES.map(rule => rule.id));
  expect(implemented).toEqual(
    new Set([Rule.DuplicateContentLength, Rule.ClTeConflict, Rule.AccessControlAllowCredentialsExactTrue]),
  );
  const notYetImplemented = Object.values(Rule).filter(id => !implemented.has(id));
  expect(notYetImplemented.length).toBe(Object.values(Rule).length - implemented.size);
});
