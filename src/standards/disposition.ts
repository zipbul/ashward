import type { CweId } from './types';

import { Rule } from '../core/contract/enums';
import { Section } from './clauses';
import { Severity, TestabilityBasis } from './disposition-enums';

/** One rule covering (part of) a clause, with the basis by which it reaches a sound verdict and
 *  the blocking severity mapped from the clause's requirement level. */
interface RuleMapping {
  readonly ruleId: Rule;
  readonly basis: TestabilityBasis;
  readonly severity: Severity;
  /** Required when a MUST/MUST NOT clause maps to a non-Fail severity — justifies the downgrade. */
  readonly severityNote?: string;
}

/** How one CORS clause is accounted for: the rules that test it, and/or the part that is
 *  untestable blackbox (with a reason). Never silently dropped. */
interface Disposition {
  readonly clause: Section;
  readonly rules: readonly RuleMapping[];
  /** Present when some (or all) of the clause cannot be judged blackbox. */
  readonly untestable?: string;
}

const direct = (ruleId: Rule, severity = Severity.Fail): RuleMapping => ({
  ruleId,
  basis: TestabilityBasis.DirectObservation,
  severity,
});
const differential = (ruleId: Rule, severity = Severity.Fail): RuleMapping => ({
  ruleId,
  basis: TestabilityBasis.DifferentialIntentRevelation,
  severity,
});
const conditional = (ruleId: Rule, severity = Severity.Fail, severityNote?: string): RuleMapping => ({
  ruleId,
  basis: TestabilityBasis.ConditionalFormat,
  severity,
  ...(severityNote !== undefined ? { severityNote } : {}),
});

/**
 * Security-heuristic rules ashward ships that are NOT STANDARDS MUSTs (§2.2 states reflection
 * passes the CORS check). Kept in their own registry, keyed by the CWE they guard against, with the
 * clause they relate to as context only — they never claim clause-coverage credit. Each is
 * conditioned on credentials: a bare reflection/null grant without ACAC:true is functionally `*`
 * and conformant, so it warns; only the credentialed grant fails.
 */
interface Heuristic {
  readonly ruleId: Rule;
  readonly cwe: readonly CweId[];
  readonly relatesTo: Section;
  readonly rationale: string;
}

export const HEURISTICS: readonly Heuristic[] = [
  {
    ruleId: Rule.OriginReflection,
    cwe: ['CWE-346', 'CWE-942'],
    relatesTo: Section.S2_2,
    rationale:
      'A forged Origin reflected into a credentialed grant lets any origin read the response with its session; bare reflection (no ACAC:true) is public-API-shaped and only warns.',
  },
  {
    ruleId: Rule.NullOrigin,
    cwe: ['CWE-942'],
    relatesTo: Section.S2_2,
    rationale: 'Origin: null is producible by any sandboxed/data: context; a credentialed null grant admits the whole web.',
  },
];

/**
 * The per-clause disposition table — the Phase 0 foundation. Every CORS clause resolves here to
 * testing rules (each with a sound basis and a severity mapped from its RFC 2119 level) and/or a
 * reasoned untestable residue. Together with HEURISTICS and the framing rules it fully accounts for
 * the frozen `Rule` roster — the invariant that makes the id freeze safe.
 */
export const DISPOSITIONS: readonly Disposition[] = [
  { clause: Section.S1_1, rules: [direct(Rule.AccessControlAllowOriginGrammar)] },
  { clause: Section.S1_2, rules: [direct(Rule.AccessControlAllowOriginGrammar)] },
  { clause: Section.S1_3, rules: [direct(Rule.AccessControlAllowOriginGrammar)] },
  { clause: Section.S1_4, rules: [direct(Rule.AccessControlAllowCredentialsExactTrue)] },
  {
    clause: Section.S1_5,
    rules: [
      direct(Rule.AccessControlAllowMethodsTokenList),
      direct(Rule.AccessControlAllowHeadersTokenList),
      direct(Rule.AccessControlExposeHeadersTokenList),
    ],
  },
  { clause: Section.S1_6, rules: [direct(Rule.AccessControlMaxAgeDeltaSeconds)] },

  {
    clause: Section.S2_1,
    rules: [],
    untestable:
      'Requires server intent to share; absence of ACAO is a conformant non-sharing choice, indistinguishable blackbox.',
  },
  {
    clause: Section.S2_2,
    rules: [direct(Rule.AccessControlAllowOriginWildcardWithCredentials)],
    untestable:
      'The byte-match core and the cookie-based-selection MUST NOT are intent-bound: a fixed-single-origin config legitimately returns a non-matching ACAO to a foreign probe, and credentials mode is not server-observable. Only the *-with-credentials contradiction is a sound blackbox failure; reflection/null grants are handled by the security heuristics (HEURISTICS), not as §2.2 coverage.',
  },
  {
    clause: Section.S2_3,
    rules: [],
    untestable:
      'The MUST to generate ACAC:true when sharing a credentialed response needs intent; only the wildcard-with-credentials contradiction (§2.2/§3.7) is observable.',
  },
  {
    clause: Section.S2_4,
    rules: [direct(Rule.AccessControlAllowOriginSingle), direct(Rule.AccessControlAllowCredentialsExactTrue)],
  },

  { clause: Section.S3_1, rules: [conditional(Rule.PreflightOkStatus)] },
  {
    clause: Section.S3_2,
    rules: [direct(Rule.AccessControlAllowMethodsTokenList), direct(Rule.AccessControlAllowHeadersTokenList)],
  },
  {
    clause: Section.S3_3,
    rules: [],
    untestable:
      'Positive "must include request method" needs the server to intend to allow it; sharing a 405/error response does not entail that intent, and the synth exception blocks judging an omitted ACAM. Testable residue lives in §3.4.',
  },
  // §3.4 is kept at Fail (conditional default), NOT the Warn that an earlier plan draft floated:
  // a wrong-cased custom method genuinely breaks the browser's byte-exact preflight match, so it is
  // a real MUST violation, not a stylistic choice. The downgrade discipline needs no note here.
  { clause: Section.S3_4, rules: [conditional(Rule.AccessControlAllowMethodsCase)] },
  {
    clause: Section.S3_5,
    rules: [],
    untestable:
      'Intent-bound like §3.3/§3.6: a * response does not cover Authorization by design (non-wildcard name), so it reveals no intent to allow it — flagging * would false-red conformant wildcard servers.',
  },
  {
    clause: Section.S3_6,
    rules: [],
    untestable:
      'Like §3.3: an absent listing of a requested unsafe header is a conformant denial; no sound blackbox failure remains.',
  },
  {
    clause: Section.S3_7,
    rules: [
      direct(Rule.AccessControlAllowMethodsWildcardWithCredentials),
      direct(Rule.AccessControlAllowHeadersWildcardWithCredentials),
      direct(Rule.AccessControlExposeHeadersWildcardWithCredentials),
    ],
  },
  { clause: Section.S3_8, rules: [differential(Rule.PreflightCredentialedGrant)] },

  {
    clause: Section.S4_1,
    rules: [],
    untestable: 'Sharing at any status requires intent; omitting headers on a non-shared response is conformant.',
  },
  {
    clause: Section.S4_2,
    rules: [differential(Rule.AccessControlExposeHeadersPreflightOnly)],
    untestable:
      'Which headers a server intends to expose is server-defined; only misplacement (ACEH on preflight, absent on actual) is observable.',
  },

  { clause: Section.S5_1, rules: [conditional(Rule.LocationRedirectNoUserinfo)] },

  { clause: Section.S6_1, rules: [conditional(Rule.AccessControlAllowPrivateNetworkLiteralTrue)] },
  { clause: Section.S6_2, rules: [conditional(Rule.PrivateNetworkAccessIdNameFormat)] },

  { clause: Section.S7_1, rules: [differential(Rule.VaryOrigin, Severity.Warn)] },
  { clause: Section.S7_2, rules: [differential(Rule.AccessControlAllowOriginStaticNoVary, Severity.Warn)] },

  {
    clause: Section.S8_1,
    rules: [],
    untestable: 'Whether a resource is network-location-protected is server context ashward cannot observe.',
  },
  { clause: Section.S8_2, rules: [], untestable: 'A server behaviour expectation, not a response-header artifact to judge.' },
];

export type { RuleMapping, Disposition, Heuristic };
