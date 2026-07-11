import type { CweId } from './types';

import { Rule } from '../core/contract/enums';
import { Severity, TestabilityBasis } from './disposition-enums';
import { ClauseId } from './enums';

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
  readonly clause: ClauseId;
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
  readonly relatesTo: ClauseId;
  readonly rationale: string;
}

export const HEURISTICS: readonly Heuristic[] = [
  {
    ruleId: Rule.OriginReflection,
    cwe: ['CWE-346', 'CWE-942'],
    relatesTo: ClauseId.AllowOriginMatchesRequest,
    rationale:
      'A forged Origin reflected into a credentialed grant lets any origin read the response with its session; bare reflection (no ACAC:true) is public-API-shaped and only warns.',
  },
  {
    ruleId: Rule.NullOrigin,
    cwe: ['CWE-942'],
    relatesTo: ClauseId.AllowOriginMatchesRequest,
    rationale: 'Origin: null is producible by any sandboxed/data: context; a credentialed null grant admits the whole web.',
  },
];

/**
 * The per-clause disposition table — the Phase 0 foundation. Every CORS clause resolves here to
 * testing rules (each with a sound basis and a severity mapped from its RFC 2119 level) and/or a
 * reasoned untestable residue. One flat table keyed by neutral `ClauseId` — no per-domain files,
 * which would reintroduce a preset as structure. Together with HEURISTICS and the framing rules it
 * fully accounts for the frozen `Rule` roster — the invariant that makes the id freeze safe.
 */
export const DISPOSITIONS: readonly Disposition[] = [
  { clause: ClauseId.AllowOriginGrammar, rules: [direct(Rule.AccessControlAllowOriginGrammar)] },
  { clause: ClauseId.SerializedOriginShape, rules: [direct(Rule.AccessControlAllowOriginGrammar)] },
  { clause: ClauseId.SerializedOriginEncoding, rules: [direct(Rule.AccessControlAllowOriginGrammar)] },
  { clause: ClauseId.AllowCredentialsExactTrue, rules: [direct(Rule.AccessControlAllowCredentialsExactTrue)] },
  {
    clause: ClauseId.ListHeaderTokenGrammar,
    rules: [
      direct(Rule.AccessControlAllowMethodsTokenList),
      direct(Rule.AccessControlAllowHeadersTokenList),
      direct(Rule.AccessControlExposeHeadersTokenList),
    ],
  },
  { clause: ClauseId.MaxAgeDeltaSeconds, rules: [direct(Rule.AccessControlMaxAgeDeltaSeconds)] },

  {
    clause: ClauseId.SharedResponseHasAllowOrigin,
    rules: [],
    untestable:
      'Requires server intent to share; absence of ACAO is a conformant non-sharing choice, indistinguishable blackbox.',
  },
  {
    clause: ClauseId.AllowOriginMatchesRequest,
    rules: [direct(Rule.AccessControlAllowOriginWildcardWithCredentials)],
    untestable:
      'The byte-match core and the cookie-based-selection MUST NOT are intent-bound: a fixed-single-origin config legitimately returns a non-matching ACAO to a foreign probe, and credentials mode is not server-observable. Only the *-with-credentials contradiction is a sound blackbox failure; reflection/null grants are handled by the security heuristics (HEURISTICS), not as §2.2 coverage.',
  },
  {
    clause: ClauseId.CredentialedNeedsAllowCredentials,
    rules: [],
    untestable:
      'The MUST to generate ACAC:true when sharing a credentialed response needs intent; only the wildcard-with-credentials contradiction (§2.2/§3.7) is observable.',
  },
  {
    clause: ClauseId.AllowOriginAndCredentialsOnce,
    rules: [direct(Rule.AccessControlAllowOriginSingle), direct(Rule.AccessControlAllowCredentialsExactTrue)],
  },

  { clause: ClauseId.PreflightOkStatus, rules: [conditional(Rule.PreflightOkStatus)] },
  {
    clause: ClauseId.PreflightListHeadersParseable,
    rules: [direct(Rule.AccessControlAllowMethodsTokenList), direct(Rule.AccessControlAllowHeadersTokenList)],
  },
  {
    clause: ClauseId.PreflightAllowsRequestMethod,
    rules: [],
    untestable:
      'Positive "must include request method" needs the server to intend to allow it; sharing a 405/error response does not entail that intent, and the synth exception blocks judging an omitted ACAM. Testable residue lives in §3.4.',
  },
  // §3.4 is kept at Fail (conditional default), NOT the Warn that an earlier plan draft floated:
  // a wrong-cased custom method genuinely breaks the browser's byte-exact preflight match, so it is
  // a real MUST violation, not a stylistic choice. The downgrade discipline needs no note here.
  { clause: ClauseId.PreflightMethodByteCase, rules: [conditional(Rule.AccessControlAllowMethodsCase)] },
  {
    clause: ClauseId.PreflightAllowsAuthorization,
    rules: [],
    untestable:
      'Intent-bound like §3.3/§3.6: a * response does not cover Authorization by design (non-wildcard name), so it reveals no intent to allow it — flagging * would false-red conformant wildcard servers.',
  },
  {
    clause: ClauseId.PreflightAllowsUnsafeHeaders,
    rules: [],
    untestable:
      'Like §3.3: an absent listing of a requested unsafe header is a conformant denial; no sound blackbox failure remains.',
  },
  {
    clause: ClauseId.CredentialedNoWildcard,
    rules: [
      direct(Rule.AccessControlAllowMethodsWildcardWithCredentials),
      direct(Rule.AccessControlAllowHeadersWildcardWithCredentials),
      direct(Rule.AccessControlExposeHeadersWildcardWithCredentials),
    ],
  },
  { clause: ClauseId.PreflightCredentialedGrant, rules: [differential(Rule.PreflightCredentialedGrant)] },

  {
    clause: ClauseId.SharedResponseAnyStatus,
    rules: [],
    untestable: 'Sharing at any status requires intent; omitting headers on a non-shared response is conformant.',
  },
  {
    clause: ClauseId.ExposeHeadersOnActual,
    rules: [differential(Rule.AccessControlExposeHeadersPreflightOnly)],
    untestable:
      'Which headers a server intends to expose is server-defined; only misplacement (ACEH on preflight, absent on actual) is observable.',
  },

  { clause: ClauseId.RedirectLocationNoUserinfo, rules: [conditional(Rule.LocationRedirectNoUserinfo)] },

  { clause: ClauseId.AllowPrivateNetworkLiteralTrue, rules: [conditional(Rule.AccessControlAllowPrivateNetworkLiteralTrue)] },
  { clause: ClauseId.PrivateNetworkIdNameFormat, rules: [conditional(Rule.PrivateNetworkAccessIdNameFormat)] },

  { clause: ClauseId.VaryOriginWhenVarying, rules: [differential(Rule.VaryOrigin, Severity.Warn)] },
  { clause: ClauseId.StaticOriginNoVary, rules: [differential(Rule.AccessControlAllowOriginStaticNoVary, Severity.Warn)] },

  {
    clause: ClauseId.NoWildcardOnProtected,
    rules: [],
    untestable: 'Whether a resource is network-location-protected is server context ashward cannot observe.',
  },
  {
    clause: ClauseId.ExpectNonPreflightedContentTypes,
    rules: [],
    untestable: 'A server behaviour expectation, not a response-header artifact to judge.',
  },
];

export type { RuleMapping, Disposition, Heuristic };
