import type { Catalog, Clause, Disposition, Heuristic } from '../catalog-types';

import { Rule } from '../../core/contract/enums';
import { Severity } from '../disposition-enums';
import { RFC9110, RFC9111 } from '../documents';
import { ReqLevel } from '../enums';
import { clause, conditional, differential, direct, fetchAnchor, pnaSection, rfc, urlSection } from './build';

/**
 * A neutral, editorial identity for one WHATWG Fetch CORS requirement — the join key between this
 * catalog's clauses, its dispositions, and the rules that test them. Frozen kebab like `Rule`, with
 * NO `§`, document, or domain prefix: the digest's `§N` numbering is a per-entry comment, never the
 * key. Local to this module, so adding another standard never touches it.
 */
enum FetchClauseId {
  AllowOriginGrammar = 'allow-origin-grammar', // §1.1
  SerializedOriginShape = 'serialized-origin-shape', // §1.2
  SerializedOriginEncoding = 'serialized-origin-encoding', // §1.3
  AllowCredentialsExactTrue = 'allow-credentials-exact-true', // §1.4
  ListHeaderTokenGrammar = 'list-header-token-grammar', // §1.5
  MaxAgeDeltaSeconds = 'max-age-delta-seconds', // §1.6
  SharedResponseHasAllowOrigin = 'shared-response-has-allow-origin', // §2.1
  AllowOriginMatchesRequest = 'allow-origin-matches-request', // §2.2
  CredentialedNeedsAllowCredentials = 'credentialed-needs-allow-credentials', // §2.3
  AllowOriginAndCredentialsOnce = 'allow-origin-and-credentials-once', // §2.4
  PreflightOkStatus = 'preflight-ok-status', // §3.1
  PreflightListHeadersParseable = 'preflight-list-headers-parseable', // §3.2
  PreflightAllowsRequestMethod = 'preflight-allows-request-method', // §3.3
  PreflightMethodByteCase = 'preflight-method-byte-case', // §3.4
  PreflightAllowsAuthorization = 'preflight-allows-authorization', // §3.5
  PreflightAllowsUnsafeHeaders = 'preflight-allows-unsafe-headers', // §3.6
  CredentialedNoWildcard = 'credentialed-no-wildcard', // §3.7
  PreflightCredentialedGrant = 'preflight-credentialed-grant', // §3.8
  SharedResponseAnyStatus = 'shared-response-any-status', // §4.1
  ExposeHeadersOnActual = 'expose-headers-on-actual', // §4.2
  RedirectLocationNoUserinfo = 'redirect-location-no-userinfo', // §5.1
  AllowPrivateNetworkLiteralTrue = 'allow-private-network-literal-true', // §6.1
  PrivateNetworkIdNameFormat = 'private-network-id-name-format', // §6.2
  VaryOriginWhenVarying = 'vary-origin-when-varying', // §7.1
  StaticOriginNoVary = 'static-origin-no-vary', // §7.2
  NoWildcardOnProtected = 'no-wildcard-on-protected', // §8.1
  ExpectNonPreflightedContentTypes = 'expect-non-preflighted-content-types', // §8.2
}

/** The CORS clause index — hand-verified against zipbul/cors STANDARDS.md §1–§8 (snapshot
 *  2026-07-10). The `§N` in each comment is the digest's own numbering, a human breadcrumb only. */
const CLAUSES: readonly Clause[] = [
  clause(
    FetchClauseId.AllowOriginGrammar, // §1.1
    ReqLevel.Must,
    [fetchAnchor('http-new-header-syntax'), fetchAnchor('origin-header')],
    'ACAO grammar: origin-or-null / "*"; no list, no subdomain pattern; null lowercase-only',
  ),
  clause(
    FetchClauseId.SerializedOriginShape, // §1.2
    ReqLevel.Must,
    [fetchAnchor('origin-header'), urlSection('4.4')],
    'serialized origin: no trailing slash/path; default port elided',
  ),
  clause(
    FetchClauseId.SerializedOriginEncoding, // §1.3
    ReqLevel.Must,
    [fetchAnchor('origin-header')],
    'lowercase scheme/host, no percent-encoding, IPv6 normalized, port 1*5DIGIT',
  ),
  clause(
    FetchClauseId.AllowCredentialsExactTrue, // §1.4
    ReqLevel.Must,
    [fetchAnchor('http-new-header-syntax')],
    'ACAC is byte-exact "true"',
  ),
  clause(
    FetchClauseId.ListHeaderTokenGrammar, // §1.5
    ReqLevel.Must,
    [fetchAnchor('http-new-header-syntax'), rfc(RFC9110, '5.6.1.1'), rfc(RFC9110, '5.6.2')],
    'ACAM/ACAH/ACEH are token lists; no empty list elements',
  ),
  clause(
    FetchClauseId.MaxAgeDeltaSeconds, // §1.6
    ReqLevel.Must,
    [fetchAnchor('http-new-header-syntax'), rfc(RFC9111, '1.2.2')],
    'ACMA is delta-seconds (1*DIGIT)',
  ),

  clause(
    FetchClauseId.SharedResponseHasAllowOrigin, // §2.1
    ReqLevel.Must,
    [fetchAnchor('cors-check')],
    'shared response must send ACAO; absence is always failure',
  ),
  clause(
    FetchClauseId.AllowOriginMatchesRequest, // §2.2
    ReqLevel.Must,
    [fetchAnchor('cors-check'), fetchAnchor('serializing-a-request-origin'), fetchAnchor('cors-protocol-and-credentials')],
    'ACAO byte-matches request origin; * only when not include; no cookie-based selection',
  ),
  clause(
    FetchClauseId.CredentialedNeedsAllowCredentials, // §2.3
    ReqLevel.Must,
    [fetchAnchor('cors-check')],
    'credentialed → ACAC: true',
  ),
  clause(
    FetchClauseId.AllowOriginAndCredentialsOnce, // §2.4
    ReqLevel.Must,
    [fetchAnchor('cors-check'), fetchAnchor('terminology-headers')],
    'ACAO and ACAC each generated once',
  ),

  clause(
    FetchClauseId.PreflightOkStatus, // §3.1
    ReqLevel.Must,
    [fetchAnchor('cors-preflight-fetch'), fetchAnchor('cors-check')],
    'preflight ok status (200–299) and satisfies §2',
  ),
  clause(
    FetchClauseId.PreflightListHeadersParseable, // §3.2
    ReqLevel.Must,
    [fetchAnchor('cors-preflight-fetch')],
    'ACAM/ACAH extractable per ABNF',
  ),
  clause(
    FetchClauseId.PreflightAllowsRequestMethod, // §3.3
    ReqLevel.Must,
    [fetchAnchor('cors-preflight-fetch')],
    'ACAM includes request method (safelist/*/synth exceptions)',
  ),
  clause(
    FetchClauseId.PreflightMethodByteCase, // §3.4
    ReqLevel.Must,
    [fetchAnchor('cors-preflight-fetch'), fetchAnchor('concept-method-normalize')],
    'ACAM method byte-case matches request method',
  ),
  clause(
    FetchClauseId.PreflightAllowsAuthorization, // §3.5
    ReqLevel.Must,
    [fetchAnchor('cors-preflight-fetch'), fetchAnchor('cors-non-wildcard-request-header-name')],
    'Authorization in request → explicit in ACAH; * never covers',
  ),
  clause(
    FetchClauseId.PreflightAllowsUnsafeHeaders, // §3.6
    ReqLevel.Must,
    [fetchAnchor('cors-preflight-fetch')],
    'each CORS-unsafe request header in ACAH; * only non-credentialed',
  ),
  clause(
    FetchClauseId.CredentialedNoWildcard, // §3.7
    ReqLevel.MustNot,
    [fetchAnchor('cors-protocol-and-credentials'), fetchAnchor('cors-preflight-fetch'), fetchAnchor('main-fetch')],
    'ACAM/ACAH/ACEH must not be * with credentials',
  ),
  clause(
    FetchClauseId.PreflightCredentialedGrant, // §3.8
    ReqLevel.Must,
    [fetchAnchor('http-responses'), fetchAnchor('cors-preflight-fetch')],
    'credentialed actual → preflight also ACAC:true + echoed origin',
  ),

  clause(
    FetchClauseId.SharedResponseAnyStatus, // §4.1
    ReqLevel.Must,
    [fetchAnchor('http-responses'), fetchAnchor('http-fetch'), fetchAnchor('cors-check')],
    'shared response satisfies §2 at any status; 304/407/SW exempt',
  ),
  clause(
    FetchClauseId.ExposeHeadersOnActual, // §4.2
    ReqLevel.Must,
    [fetchAnchor('http-responses'), fetchAnchor('main-fetch')],
    'ACEH on actual (not preflight) response to expose non-safelist headers',
  ),

  clause(
    FetchClauseId.RedirectLocationNoUserinfo, // §5.1
    ReqLevel.MustNot,
    [fetchAnchor('http-redirect-fetch')],
    '3xx Location must not carry userinfo credentials',
  ),

  clause(
    FetchClauseId.AllowPrivateNetworkLiteralTrue, // §6.1
    ReqLevel.Must,
    [pnaSection('3.4.2'), fetchAnchor('cors-check')],
    'ACRPN:true + allowed → ACAPN literal "true"',
  ),
  clause(
    FetchClauseId.PrivateNetworkIdNameFormat, // §6.2
    ReqLevel.Must,
    [pnaSection('3.4.2')],
    'PNA ID (6 hex bytes) / Name (regex, ≤248) format when both present',
  ),

  clause(
    FetchClauseId.VaryOriginWhenVarying, // §7.1
    ReqLevel.Should,
    [fetchAnchor('cors-protocol-and-http-caches'), rfc(RFC9110, '12.5.5')],
    'Vary: Origin when ACAO depends on request Origin',
  ),
  clause(
    FetchClauseId.StaticOriginNoVary, // §7.2
    ReqLevel.Should,
    [fetchAnchor('cors-protocol-and-http-caches')],
    'static */fixed origin → always ACAO, no Vary: Origin',
  ),

  clause(
    FetchClauseId.NoWildcardOnProtected, // §8.1
    ReqLevel.ShouldNot,
    [fetchAnchor('basic-safe-cors-protocol-setup')],
    'no ACAO:* on network-location-protected resources',
  ),
  clause(
    FetchClauseId.ExpectNonPreflightedContentTypes, // §8.2
    ReqLevel.Should,
    [fetchAnchor('cors-protocol-exceptions')],
    'expect non-preflighted requests for certain content-types',
  ),
];

/** The per-clause disposition table: every CORS clause resolves to testing rules (each with a sound
 *  basis and a severity mapped from its RFC 2119 level) and/or a reasoned untestable residue. */
const DISPOSITIONS: readonly Disposition[] = [
  { clause: FetchClauseId.AllowOriginGrammar, rules: [direct(Rule.AccessControlAllowOriginGrammar)] },
  { clause: FetchClauseId.SerializedOriginShape, rules: [direct(Rule.AccessControlAllowOriginGrammar)] },
  { clause: FetchClauseId.SerializedOriginEncoding, rules: [direct(Rule.AccessControlAllowOriginGrammar)] },
  { clause: FetchClauseId.AllowCredentialsExactTrue, rules: [direct(Rule.AccessControlAllowCredentialsExactTrue)] },
  {
    clause: FetchClauseId.ListHeaderTokenGrammar,
    rules: [
      direct(Rule.AccessControlAllowMethodsTokenList),
      direct(Rule.AccessControlAllowHeadersTokenList),
      direct(Rule.AccessControlExposeHeadersTokenList),
    ],
  },
  { clause: FetchClauseId.MaxAgeDeltaSeconds, rules: [direct(Rule.AccessControlMaxAgeDeltaSeconds)] },

  {
    clause: FetchClauseId.SharedResponseHasAllowOrigin,
    rules: [],
    untestable:
      'Requires server intent to share; absence of ACAO is a conformant non-sharing choice, indistinguishable blackbox.',
  },
  {
    clause: FetchClauseId.AllowOriginMatchesRequest,
    rules: [direct(Rule.AccessControlAllowOriginWildcardWithCredentials)],
    untestable:
      'The byte-match core and the cookie-based-selection MUST NOT are intent-bound: a fixed-single-origin config legitimately returns a non-matching ACAO to a foreign probe, and credentials mode is not server-observable. Only the *-with-credentials contradiction is a sound blackbox failure; reflection/null grants are handled by the security heuristics (HEURISTICS), not as §2.2 coverage.',
  },
  {
    clause: FetchClauseId.CredentialedNeedsAllowCredentials,
    rules: [],
    untestable:
      'The MUST to generate ACAC:true when sharing a credentialed response needs intent; only the wildcard-with-credentials contradiction (§2.2/§3.7) is observable.',
  },
  {
    clause: FetchClauseId.AllowOriginAndCredentialsOnce,
    rules: [direct(Rule.AccessControlAllowOriginSingle), direct(Rule.AccessControlAllowCredentialsExactTrue)],
  },

  { clause: FetchClauseId.PreflightOkStatus, rules: [conditional(Rule.PreflightOkStatus)] },
  {
    clause: FetchClauseId.PreflightListHeadersParseable,
    rules: [direct(Rule.AccessControlAllowMethodsTokenList), direct(Rule.AccessControlAllowHeadersTokenList)],
  },
  {
    clause: FetchClauseId.PreflightAllowsRequestMethod,
    rules: [],
    untestable:
      'Positive "must include request method" needs the server to intend to allow it; sharing a 405/error response does not entail that intent, and the synth exception blocks judging an omitted ACAM. Testable residue lives in §3.4.',
  },
  // §3.4 is kept at Fail (conditional default), NOT a Warn: a wrong-cased custom method genuinely
  // breaks the browser's byte-exact preflight match, so it is a real MUST violation.
  { clause: FetchClauseId.PreflightMethodByteCase, rules: [conditional(Rule.AccessControlAllowMethodsCase)] },
  {
    clause: FetchClauseId.PreflightAllowsAuthorization,
    rules: [],
    untestable:
      'Intent-bound like §3.3/§3.6: a * response does not cover Authorization by design (non-wildcard name), so it reveals no intent to allow it — flagging * would false-red conformant wildcard servers.',
  },
  {
    clause: FetchClauseId.PreflightAllowsUnsafeHeaders,
    rules: [],
    untestable:
      'Like §3.3: an absent listing of a requested unsafe header is a conformant denial; no sound blackbox failure remains.',
  },
  {
    clause: FetchClauseId.CredentialedNoWildcard,
    rules: [
      direct(Rule.AccessControlAllowMethodsWildcardWithCredentials),
      direct(Rule.AccessControlAllowHeadersWildcardWithCredentials),
      direct(Rule.AccessControlExposeHeadersWildcardWithCredentials),
    ],
  },
  { clause: FetchClauseId.PreflightCredentialedGrant, rules: [differential(Rule.PreflightCredentialedGrant)] },

  {
    clause: FetchClauseId.SharedResponseAnyStatus,
    rules: [],
    untestable: 'Sharing at any status requires intent; omitting headers on a non-shared response is conformant.',
  },
  {
    clause: FetchClauseId.ExposeHeadersOnActual,
    rules: [differential(Rule.AccessControlExposeHeadersPreflightOnly)],
    untestable:
      'Which headers a server intends to expose is server-defined; only misplacement (ACEH on preflight, absent on actual) is observable.',
  },

  { clause: FetchClauseId.RedirectLocationNoUserinfo, rules: [conditional(Rule.LocationRedirectNoUserinfo)] },

  {
    clause: FetchClauseId.AllowPrivateNetworkLiteralTrue,
    rules: [conditional(Rule.AccessControlAllowPrivateNetworkLiteralTrue)],
  },
  { clause: FetchClauseId.PrivateNetworkIdNameFormat, rules: [conditional(Rule.PrivateNetworkAccessIdNameFormat)] },

  { clause: FetchClauseId.VaryOriginWhenVarying, rules: [differential(Rule.VaryOrigin, Severity.Warn)] },
  { clause: FetchClauseId.StaticOriginNoVary, rules: [differential(Rule.AccessControlAllowOriginStaticNoVary, Severity.Warn)] },

  {
    clause: FetchClauseId.NoWildcardOnProtected,
    rules: [],
    untestable: 'Whether a resource is network-location-protected is server context ashward cannot observe.',
  },
  {
    clause: FetchClauseId.ExpectNonPreflightedContentTypes,
    rules: [],
    untestable: 'A server behaviour expectation, not a response-header artifact to judge.',
  },
];

/**
 * Security-heuristic rules ashward ships that are NOT STANDARDS MUSTs (§2.2 states reflection passes
 * the CORS check). Keyed by the CWE they guard against, with the clause they relate to as context
 * only — they never claim clause-coverage credit. Each is conditioned on credentials: a bare
 * reflection/null grant without ACAC:true is functionally `*` and conformant (warns); only the
 * credentialed grant fails.
 */
const HEURISTICS: readonly Heuristic[] = [
  {
    ruleId: Rule.OriginReflection,
    cwe: ['CWE-346', 'CWE-942'],
    relatesTo: FetchClauseId.AllowOriginMatchesRequest,
    rationale:
      'A forged Origin reflected into a credentialed grant lets any origin read the response with its session; bare reflection (no ACAC:true) is public-API-shaped and only warns.',
  },
  {
    ruleId: Rule.NullOrigin,
    cwe: ['CWE-942'],
    relatesTo: FetchClauseId.AllowOriginMatchesRequest,
    rationale: 'Origin: null is producible by any sandboxed/data: context; a credentialed null grant admits the whole web.',
  },
];

/** This module's own hardcoded snapshot of its clause ids — deleting a member from the enum fails
 *  the catalog test loudly instead of vanishing from both the index and its own check at once. */
const SNAPSHOT: readonly string[] = [
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

const fetchCatalog: Catalog = {
  name: 'WHATWG Fetch (CORS protocol)',
  clauses: CLAUSES,
  dispositions: DISPOSITIONS,
  heuristics: HEURISTICS,
  snapshot: SNAPSHOT,
};

export { FetchClauseId, fetchCatalog };
