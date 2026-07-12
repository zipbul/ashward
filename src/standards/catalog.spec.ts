import { test, expect } from 'bun:test';

import type { Disposition, Heuristic, RuleMapping } from './catalog-types';

import { Rule } from '../core/contract/enums';
import { ALL_CLAUSES, ALL_DISPOSITIONS, ALL_HEURISTICS, CATALOGS } from './catalog';
import { Severity, TestabilityBasis } from './disposition-enums';
import { ReqLevel } from './enums';

/**
 * Machine-checked invariant over the COMPOSED catalog: every clause across every standard module is
 * accounted for exactly once (rules + basis + severity, and/or a reasoned untestable residue), and
 * the union of dispositioned ids + heuristic ids equals the frozen `Rule` roster — with framing now
 * a first-class module, NOT a side-list. Each module also pins its own clause-id snapshot.
 */

const LEVEL = new Map(ALL_CLAUSES.map(clause => [clause.id, clause.reqLevel]));
const VALID_BASES = new Set<string>(Object.values(TestabilityBasis));
const VALID_SEVERITIES = new Set<string>(Object.values(Severity));
const CLAUSE_IDS = new Set(ALL_CLAUSES.map(clause => clause.id));
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const allMappings = (): RuleMapping[] => ALL_DISPOSITIONS.flatMap(d => d.rules);
const isMustLevel = (id: string): boolean => LEVEL.get(id) === ReqLevel.Must || LEVEL.get(id) === ReqLevel.MustNot;
const isShouldLevel = (id: string): boolean => LEVEL.get(id) === ReqLevel.Should || LEVEL.get(id) === ReqLevel.ShouldNot;
const isUnaccounted = (d: Disposition): boolean =>
  d.rules.length === 0 && (d.untestable === undefined || d.untestable.length === 0);
const hasInvalidBasisOrSeverity = (m: RuleMapping): boolean => !VALID_BASES.has(m.basis) || !VALID_SEVERITIES.has(m.severity);
const isUnjustifiedDowngrade = (m: RuleMapping): boolean => m.severity !== Severity.Fail && m.severityNote === undefined;
const isBadHeuristic = (h: Heuristic): boolean => h.cwe.length === 0 || !CLAUSE_IDS.has(h.relatesTo);
const hasBadShape = (id: string): boolean =>
  !KEBAB.test(id) || id.startsWith('cors') || id.startsWith('rfc') || id.startsWith('fetch') || id.startsWith('http-framing');
const mappingsWhere = (predicate: (id: string) => boolean): RuleMapping[] =>
  ALL_DISPOSITIONS.filter(d => predicate(d.clause)).flatMap(d => d.rules);
const snapshotMismatch = (): string[] => {
  const out: string[] = [];
  for (const catalog of CATALOGS) {
    const ids = catalog.clauses.map(clause => clause.id).sort();
    if (JSON.stringify(ids) !== JSON.stringify([...catalog.snapshot].sort())) {
      out.push(catalog.name);
    }
  }
  return out;
};

test('each catalog module matches its own hardcoded clause-id snapshot', () => {
  expect(snapshotMismatch()).toEqual([]);
});

test('clause ids are globally unique across catalogs', () => {
  const ids = ALL_CLAUSES.map(clause => clause.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test('every clause carries at least one normative citation', () => {
  expect(ALL_CLAUSES.filter(clause => clause.normative.length === 0)).toEqual([]);
});

test('every citation stamps the clause requirement level onto each referenced document', () => {
  expect(ALL_CLAUSES.filter(clause => clause.normative.some(ref => ref.req !== clause.reqLevel))).toEqual([]);
});

test('every clause is dispositioned exactly once', () => {
  expect(ALL_DISPOSITIONS.map(d => d.clause).sort()).toEqual(ALL_CLAUSES.map(clause => clause.id).sort());
});

test('every disposition accounts for its clause with rules and/or an untestable reason', () => {
  expect(ALL_DISPOSITIONS.filter(isUnaccounted)).toEqual([]);
});

test('the frozen Rule roster equals disposition ids + heuristic ids exactly (framing is a module, not a side-list)', () => {
  const placed = new Set<Rule>([...allMappings().map(m => m.ruleId), ...ALL_HEURISTICS.map(h => h.ruleId)]);
  expect([...placed].sort()).toEqual(Object.values(Rule).sort());
});

test('heuristic ids are disjoint from clause-testing ids (no shadowed verdict)', () => {
  const clauseIds = new Set(allMappings().map(m => m.ruleId));
  expect(ALL_HEURISTICS.map(h => h.ruleId).filter(id => clauseIds.has(id))).toEqual([]);
});

test('every rule mapping declares a basis and severity from the valid sets', () => {
  expect(allMappings().filter(hasInvalidBasisOrSeverity)).toEqual([]);
});

test('MUST / MUST NOT clauses map only to Fail unless a severityNote justifies the downgrade', () => {
  expect(mappingsWhere(isMustLevel).filter(isUnjustifiedDowngrade)).toEqual([]);
});

test('SHOULD / SHOULD NOT clauses never map to Fail (severity discipline)', () => {
  expect(mappingsWhere(isShouldLevel).filter(m => m.severity === Severity.Fail)).toEqual([]);
});

test('every heuristic guards at least one CWE and names a real related clause', () => {
  expect(ALL_HEURISTICS.filter(isBadHeuristic)).toEqual([]);
});

test('rule ids are kebab-case with no domain/spec prefix', () => {
  expect(Object.values(Rule).filter(hasBadShape)).toEqual([]);
});

test('clause ids are kebab-case with no domain/spec prefix', () => {
  expect(ALL_CLAUSES.map(clause => clause.id).filter(hasBadShape)).toEqual([]);
});
