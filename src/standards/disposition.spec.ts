import { test, expect } from 'bun:test';

import type { Disposition, Heuristic, RuleMapping } from './disposition';

import { Rule } from '../core/contract/enums';
import { clTeConflict } from '../rules/cl-te-conflict';
import { duplicateContentLength } from '../rules/duplicate-content-length';
import { CLAUSES } from './clauses';
import { DISPOSITIONS, HEURISTICS } from './disposition';
import { Severity, TestabilityBasis } from './disposition-enums';
import { ClauseId, ReqLevel } from './enums';

/**
 * Phase 0 machine-checked invariant: every normative CORS clause in STANDARDS.md is accounted for
 * exactly once — mapped to rules with a declared testability basis and severity, and/or catalogued
 * with an untestable reason — AND the union of dispositioned ids, heuristic ids, and the framing
 * ids equals the frozen `Rule` roster exactly. That bijection is what makes the id freeze safe: the
 * enum cannot carry an id the table never places, and the table cannot name an id outside the enum.
 */

/** The clause index literally as it stands (neutral `ClauseId` snapshot, one per STANDARDS.md
 *  §1–§8, snapshot 2026-07-10). Hardcoded here — NOT derived from `ClauseId` — so deleting a member
 *  from the enum fails this test loudly instead of vanishing from both the index and its own check
 *  at once. Order is irrelevant: both sides are sorted before comparison. */
const SNAPSHOT_CLAUSES = [
  'allow-origin-grammar',
  'serialized-origin-shape',
  'serialized-origin-encoding',
  'allow-credentials-exact-true',
  'list-header-token-grammar',
  'max-age-delta-seconds',
  'shared-response-has-allow-origin',
  'allow-origin-matches-request',
  'credentialed-needs-allow-credentials',
  'allow-origin-and-credentials-once',
  'preflight-ok-status',
  'preflight-list-headers-parseable',
  'preflight-allows-request-method',
  'preflight-method-byte-case',
  'preflight-allows-authorization',
  'preflight-allows-unsafe-headers',
  'credentialed-no-wildcard',
  'preflight-credentialed-grant',
  'shared-response-any-status',
  'expose-headers-on-actual',
  'redirect-location-no-userinfo',
  'allow-private-network-literal-true',
  'private-network-id-name-format',
  'vary-origin-when-varying',
  'static-origin-no-vary',
  'no-wildcard-on-protected',
  'expect-non-preflighted-content-types',
];

/** The framing rules are HTTP/1.1 (RFC 9112), not CORS clauses — they belong to the roster but not
 *  the disposition table, so the bijection accounts for them explicitly. Derived from the rule
 *  modules' own `id` fields (single source), not a hand-typed literal that could drift. */
const FRAMING_RULE_IDS: readonly Rule[] = [duplicateContentLength.id, clTeConflict.id];

const LEVEL = new Map(CLAUSES.map(c => [c.id, c.reqLevel]));
const VALID_BASES = new Set<string>(Object.values(TestabilityBasis));
const VALID_SEVERITIES = new Set<string>(Object.values(Severity));
const KNOWN_CLAUSES = new Set<string>(Object.values(ClauseId));
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const allMappings = (): RuleMapping[] => {
  const out: RuleMapping[] = [];
  for (const d of DISPOSITIONS) {
    out.push(...d.rules);
  }
  return out;
};

const isMustLevel = (c: ClauseId): boolean => LEVEL.get(c) === ReqLevel.Must || LEVEL.get(c) === ReqLevel.MustNot;
const isShouldLevel = (c: ClauseId): boolean => LEVEL.get(c) === ReqLevel.Should || LEVEL.get(c) === ReqLevel.ShouldNot;
const isUnaccounted = (d: Disposition): boolean =>
  d.rules.length === 0 && (d.untestable === undefined || d.untestable.length === 0);
const hasInvalidBasisOrSeverity = (m: RuleMapping): boolean => !VALID_BASES.has(m.basis) || !VALID_SEVERITIES.has(m.severity);
const isUnjustifiedDowngrade = (m: RuleMapping): boolean => m.severity !== Severity.Fail && m.severityNote === undefined;
const isBadHeuristic = (h: Heuristic): boolean => h.cwe.length === 0 || !KNOWN_CLAUSES.has(h.relatesTo);
const hasBadShape = (id: string): boolean =>
  !KEBAB.test(id) || id.startsWith('cors') || id.startsWith('rfc') || id.startsWith('http-framing');

const mappingsWhere = (predicate: (c: ClauseId) => boolean): RuleMapping[] => {
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
  expect((Object.values(ClauseId) as string[]).sort()).toEqual([...SNAPSHOT_CLAUSES].sort());
});

test('CLAUSES covers exactly the clause enum', () => {
  expect(CLAUSES.map(c => c.id).sort()).toEqual(Object.values(ClauseId).sort());
});

test('every clause has a unique id', () => {
  const ids = CLAUSES.map(c => c.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test('every clause carries at least one normative citation (multi-doc identity, not a bare anchor)', () => {
  expect(CLAUSES.filter(c => c.normative.length === 0)).toEqual([]);
});

test('every citation stamps the clause requirement level onto each referenced document', () => {
  const mismatched = CLAUSES.filter(c => c.normative.some(ref => ref.req !== c.reqLevel));
  expect(mismatched).toEqual([]);
});

test('every clause is dispositioned exactly once', () => {
  expect(DISPOSITIONS.map(d => d.clause).sort()).toEqual(CLAUSES.map(c => c.id).sort());
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

test('clause ids are kebab-case with no domain/spec prefix', () => {
  expect(Object.values(ClauseId).filter(hasBadShape)).toEqual([]);
});
