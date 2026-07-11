import { test, expect } from 'bun:test';

import type { Disposition, Heuristic, RuleMapping } from './disposition';

import { Rule } from '../core/contract/enums';
import { clTeConflict } from '../rules/http/framing/cl-te-conflict';
import { duplicateContentLength } from '../rules/http/framing/duplicate-content-length';
import { CLAUSES, Section } from './clauses';
import { DISPOSITIONS, HEURISTICS } from './disposition';
import { Severity, TestabilityBasis } from './disposition-enums';
import { ReqLevel } from './enums';

/**
 * Phase 0 machine-checked invariant: every normative CORS clause in STANDARDS.md is accounted for
 * exactly once — mapped to rules with a declared testability basis and severity, and/or catalogued
 * with an untestable reason — AND the union of dispositioned ids, heuristic ids, and the framing
 * ids equals the frozen `Rule` roster exactly. That bijection is what makes the id freeze safe: the
 * enum cannot carry an id the table never places, and the table cannot name an id outside the enum.
 */

/** The clause index literally as it stands in STANDARDS.md §1–§8 (snapshot 2026-07-10). Hardcoded
 *  here — NOT derived from Section — so deleting a clause from the enum fails this test loudly
 *  instead of vanishing from both the index and its own check at once. */
const SNAPSHOT_SECTIONS = [
  '§1.1',
  '§1.2',
  '§1.3',
  '§1.4',
  '§1.5',
  '§1.6',
  '§2.1',
  '§2.2',
  '§2.3',
  '§2.4',
  '§3.1',
  '§3.2',
  '§3.3',
  '§3.4',
  '§3.5',
  '§3.6',
  '§3.7',
  '§3.8',
  '§4.1',
  '§4.2',
  '§5.1',
  '§6.1',
  '§6.2',
  '§7.1',
  '§7.2',
  '§8.1',
  '§8.2',
].sort();

/** The framing rules are HTTP/1.1 (RFC 9112), not CORS clauses — they belong to the roster but not
 *  the disposition table, so the bijection accounts for them explicitly. Derived from the rule
 *  modules' own `id` fields (single source), not a hand-typed literal that could drift. */
const FRAMING_RULE_IDS: readonly Rule[] = [duplicateContentLength.id, clTeConflict.id];

const LEVEL = new Map(CLAUSES.map(c => [c.section, c.reqLevel]));
const VALID_BASES = new Set<string>(Object.values(TestabilityBasis));
const VALID_SEVERITIES = new Set<string>(Object.values(Severity));
const KNOWN_SECTIONS = new Set<string>(Object.values(Section));
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const allMappings = (): RuleMapping[] => {
  const out: RuleMapping[] = [];
  for (const d of DISPOSITIONS) {
    out.push(...d.rules);
  }
  return out;
};

const isMustLevel = (c: Section): boolean => LEVEL.get(c) === ReqLevel.Must || LEVEL.get(c) === ReqLevel.MustNot;
const isShouldLevel = (c: Section): boolean => LEVEL.get(c) === ReqLevel.Should || LEVEL.get(c) === ReqLevel.ShouldNot;
const isUnaccounted = (d: Disposition): boolean =>
  d.rules.length === 0 && (d.untestable === undefined || d.untestable.length === 0);
const hasInvalidBasisOrSeverity = (m: RuleMapping): boolean => !VALID_BASES.has(m.basis) || !VALID_SEVERITIES.has(m.severity);
const isUnjustifiedDowngrade = (m: RuleMapping): boolean => m.severity !== Severity.Fail && m.severityNote === undefined;
const isBadHeuristic = (h: Heuristic): boolean => h.cwe.length === 0 || !KNOWN_SECTIONS.has(h.relatesTo);
const hasBadShape = (id: string): boolean =>
  !KEBAB.test(id) || id.startsWith('cors') || id.startsWith('rfc') || id.startsWith('http-framing');

const mappingsWhere = (predicate: (c: Section) => boolean): RuleMapping[] => {
  const out: RuleMapping[] = [];
  for (const d of DISPOSITIONS) {
    if (predicate(d.clause)) {
      out.push(...d.rules);
    }
  }
  return out;
};
const mustMappings = (): RuleMapping[] => mappingsWhere(isMustLevel);
const shouldMappings = (): RuleMapping[] => mappingsWhere(isShouldLevel);

test('the clause enum matches the hardcoded STANDARDS.md snapshot', () => {
  expect((Object.values(Section) as string[]).sort()).toEqual(SNAPSHOT_SECTIONS);
});

test('CLAUSES covers exactly the clause enum', () => {
  expect(CLAUSES.map(c => c.section).sort()).toEqual(Object.values(Section).sort());
});

test('every clause has a unique section id', () => {
  const sections = CLAUSES.map(c => c.section);
  expect(new Set(sections).size).toBe(sections.length);
});

test('every clause carries at least one normative citation (multi-doc identity, not a bare anchor)', () => {
  expect(CLAUSES.filter(c => c.normative.length === 0)).toEqual([]);
});

test('every citation stamps the clause requirement level onto each referenced document', () => {
  const mismatched = CLAUSES.filter(c => c.normative.some(ref => ref.req !== c.reqLevel));
  expect(mismatched).toEqual([]);
});

test('every clause is dispositioned exactly once', () => {
  expect(DISPOSITIONS.map(d => d.clause).sort()).toEqual(CLAUSES.map(c => c.section).sort());
});

test('every disposition accounts for the clause with rules and/or an untestable reason', () => {
  expect(DISPOSITIONS.filter(isUnaccounted)).toEqual([]);
});

test('the frozen Rule roster equals disposition ids + heuristic ids + framing ids exactly', () => {
  const placed = new Set<Rule>([...allMappings().map(m => m.ruleId), ...HEURISTICS.map(h => h.ruleId), ...FRAMING_RULE_IDS]);
  expect([...placed].sort()).toEqual(Object.values(Rule).sort());
});

test('heuristic ids are disjoint from clause-testing ids (no shadowed verdict)', () => {
  const clauseIds = new Set(allMappings().map(m => m.ruleId));
  expect(HEURISTICS.map(h => h.ruleId).filter(id => clauseIds.has(id))).toEqual([]);
});

test('every rule mapping declares a basis and severity from the valid sets', () => {
  expect(allMappings().filter(hasInvalidBasisOrSeverity)).toEqual([]);
});

test('MUST / MUST NOT clauses map only to Fail unless a severityNote justifies the downgrade', () => {
  expect(mustMappings().filter(isUnjustifiedDowngrade)).toEqual([]);
});

test('SHOULD / SHOULD NOT clauses never map to Fail (severity discipline)', () => {
  expect(shouldMappings().filter(m => m.severity === Severity.Fail)).toEqual([]);
});

test('security heuristics are registered with the reflection and null-origin rules', () => {
  expect(HEURISTICS.map(h => h.ruleId)).toEqual([Rule.OriginReflection, Rule.NullOrigin]);
});

test('every heuristic guards at least one CWE and names a real related clause', () => {
  expect(HEURISTICS.filter(isBadHeuristic)).toEqual([]);
});

test('rule ids are kebab-case with no domain/spec prefix', () => {
  expect(Object.values(Rule).filter(hasBadShape)).toEqual([]);
});
