import type { NormativeRef } from './interfaces';
import type { StandardDocument } from './types';

import { RFC9110, RFC9111, WHATWG_FETCH, WHATWG_URL, WICG_PNA } from './documents';
import { ClauseId, LocatorKind, ReqLevel } from './enums';

/** One normative requirement of the CORS STANDARDS.md digest, as a citable unit. `normative` carries
 *  EVERY document + locator the clause cites (the digest co-cites Fetch with RFC 9110/9111, URL, and
 *  PNA); the test logic is implemented from those real algorithms, not from the summary prose. A
 *  single anchor cannot hold RFC 9111's delta-seconds definition, so this must be a list. `id` is a
 *  neutral `ClauseId` — the digest's `§N` numbering is provenance carried per entry as a comment,
 *  never the identity key. */
interface Clause {
  readonly id: ClauseId;
  readonly reqLevel: ReqLevel;
  readonly normative: readonly NormativeRef[];
  readonly summary: string;
}

/** A citation shorthand, pre-`req`: the clause builder stamps each with the clause's requirement
 *  level (a clause has one level; its co-citations all inherit it). */
interface Cite {
  readonly doc: StandardDocument;
  readonly kind: LocatorKind;
  readonly value: string;
}

const fetchAnchor = (value: string): Cite => ({ doc: WHATWG_FETCH, kind: LocatorKind.Anchor, value });
const rfc = (doc: StandardDocument, value: string): Cite => ({ doc, kind: LocatorKind.Section, value });
const urlSection = (value: string): Cite => ({ doc: WHATWG_URL, kind: LocatorKind.Section, value });
const pnaSection = (value: string): Cite => ({ doc: WICG_PNA, kind: LocatorKind.Section, value });

const clause = (id: ClauseId, reqLevel: ReqLevel, cites: readonly Cite[], summary: string): Clause => ({
  id,
  reqLevel,
  normative: cites.map(c => ({ doc: c.doc, locator: { kind: c.kind, value: c.value }, req: reqLevel })),
  summary,
});

/** The CORS clause index — hand-verified against zipbul/cors STANDARDS.md §1–§8 (snapshot
 *  2026-07-10). HTTP/1.1 framing (RFC 9112) is a separate domain and is not indexed here. The `§N`
 *  in each comment is the digest's own numbering, kept as a human breadcrumb only. */
const CLAUSES: readonly Clause[] = [
  clause(
    ClauseId.AllowOriginGrammar, // §1.1
    ReqLevel.Must,
    [fetchAnchor('http-new-header-syntax'), fetchAnchor('origin-header')],
    'ACAO grammar: origin-or-null / "*"; no list, no subdomain pattern; null lowercase-only',
  ),
  clause(
    ClauseId.SerializedOriginShape, // §1.2
    ReqLevel.Must,
    [fetchAnchor('origin-header'), urlSection('4.4')],
    'serialized origin: no trailing slash/path; default port elided',
  ),
  clause(
    ClauseId.SerializedOriginEncoding, // §1.3
    ReqLevel.Must,
    [fetchAnchor('origin-header')],
    'lowercase scheme/host, no percent-encoding, IPv6 normalized, port 1*5DIGIT',
  ),
  clause(
    ClauseId.AllowCredentialsExactTrue, // §1.4
    ReqLevel.Must,
    [fetchAnchor('http-new-header-syntax')],
    'ACAC is byte-exact "true"',
  ),
  clause(
    ClauseId.ListHeaderTokenGrammar, // §1.5
    ReqLevel.Must,
    [fetchAnchor('http-new-header-syntax'), rfc(RFC9110, '5.6.1.1'), rfc(RFC9110, '5.6.2')],
    'ACAM/ACAH/ACEH are token lists; no empty list elements',
  ),
  clause(
    ClauseId.MaxAgeDeltaSeconds, // §1.6
    ReqLevel.Must,
    [fetchAnchor('http-new-header-syntax'), rfc(RFC9111, '1.2.2')],
    'ACMA is delta-seconds (1*DIGIT)',
  ),

  clause(
    ClauseId.SharedResponseHasAllowOrigin, // §2.1
    ReqLevel.Must,
    [fetchAnchor('cors-check')],
    'shared response must send ACAO; absence is always failure',
  ),
  clause(
    ClauseId.AllowOriginMatchesRequest, // §2.2
    ReqLevel.Must,
    [fetchAnchor('cors-check'), fetchAnchor('serializing-a-request-origin'), fetchAnchor('cors-protocol-and-credentials')],
    'ACAO byte-matches request origin; * only when not include; no cookie-based selection',
  ),
  clause(
    ClauseId.CredentialedNeedsAllowCredentials, // §2.3
    ReqLevel.Must,
    [fetchAnchor('cors-check')],
    'credentialed → ACAC: true',
  ),
  clause(
    ClauseId.AllowOriginAndCredentialsOnce, // §2.4
    ReqLevel.Must,
    [fetchAnchor('cors-check'), fetchAnchor('terminology-headers')],
    'ACAO and ACAC each generated once',
  ),

  clause(
    ClauseId.PreflightOkStatus, // §3.1
    ReqLevel.Must,
    [fetchAnchor('cors-preflight-fetch'), fetchAnchor('cors-check')],
    'preflight ok status (200–299) and satisfies §2',
  ),
  clause(
    ClauseId.PreflightListHeadersParseable, // §3.2
    ReqLevel.Must,
    [fetchAnchor('cors-preflight-fetch')],
    'ACAM/ACAH extractable per ABNF',
  ),
  clause(
    ClauseId.PreflightAllowsRequestMethod, // §3.3
    ReqLevel.Must,
    [fetchAnchor('cors-preflight-fetch')],
    'ACAM includes request method (safelist/*/synth exceptions)',
  ),
  clause(
    ClauseId.PreflightMethodByteCase, // §3.4
    ReqLevel.Must,
    [fetchAnchor('cors-preflight-fetch'), fetchAnchor('concept-method-normalize')],
    'ACAM method byte-case matches request method',
  ),
  clause(
    ClauseId.PreflightAllowsAuthorization, // §3.5
    ReqLevel.Must,
    [fetchAnchor('cors-preflight-fetch'), fetchAnchor('cors-non-wildcard-request-header-name')],
    'Authorization in request → explicit in ACAH; * never covers',
  ),
  clause(
    ClauseId.PreflightAllowsUnsafeHeaders, // §3.6
    ReqLevel.Must,
    [fetchAnchor('cors-preflight-fetch')],
    'each CORS-unsafe request header in ACAH; * only non-credentialed',
  ),
  clause(
    ClauseId.CredentialedNoWildcard, // §3.7
    ReqLevel.MustNot,
    [fetchAnchor('cors-protocol-and-credentials'), fetchAnchor('cors-preflight-fetch'), fetchAnchor('main-fetch')],
    'ACAM/ACAH/ACEH must not be * with credentials',
  ),
  clause(
    ClauseId.PreflightCredentialedGrant, // §3.8
    ReqLevel.Must,
    [fetchAnchor('http-responses'), fetchAnchor('cors-preflight-fetch')],
    'credentialed actual → preflight also ACAC:true + echoed origin',
  ),

  clause(
    ClauseId.SharedResponseAnyStatus, // §4.1
    ReqLevel.Must,
    [fetchAnchor('http-responses'), fetchAnchor('http-fetch'), fetchAnchor('cors-check')],
    'shared response satisfies §2 at any status; 304/407/SW exempt',
  ),
  clause(
    ClauseId.ExposeHeadersOnActual, // §4.2
    ReqLevel.Must,
    [fetchAnchor('http-responses'), fetchAnchor('main-fetch')],
    'ACEH on actual (not preflight) response to expose non-safelist headers',
  ),

  clause(
    ClauseId.RedirectLocationNoUserinfo, // §5.1
    ReqLevel.MustNot,
    [fetchAnchor('http-redirect-fetch')],
    '3xx Location must not carry userinfo credentials',
  ),

  clause(
    ClauseId.AllowPrivateNetworkLiteralTrue, // §6.1
    ReqLevel.Must,
    [pnaSection('3.4.2'), fetchAnchor('cors-check')],
    'ACRPN:true + allowed → ACAPN literal "true"',
  ),
  clause(
    ClauseId.PrivateNetworkIdNameFormat, // §6.2
    ReqLevel.Must,
    [pnaSection('3.4.2')],
    'PNA ID (6 hex bytes) / Name (regex, ≤248) format when both present',
  ),

  clause(
    ClauseId.VaryOriginWhenVarying, // §7.1
    ReqLevel.Should,
    [fetchAnchor('cors-protocol-and-http-caches'), rfc(RFC9110, '12.5.5')],
    'Vary: Origin when ACAO depends on request Origin',
  ),
  clause(
    ClauseId.StaticOriginNoVary, // §7.2
    ReqLevel.Should,
    [fetchAnchor('cors-protocol-and-http-caches')],
    'static */fixed origin → always ACAO, no Vary: Origin',
  ),

  clause(
    ClauseId.NoWildcardOnProtected, // §8.1
    ReqLevel.ShouldNot,
    [fetchAnchor('basic-safe-cors-protocol-setup')],
    'no ACAO:* on network-location-protected resources',
  ),
  clause(
    ClauseId.ExpectNonPreflightedContentTypes, // §8.2
    ReqLevel.Should,
    [fetchAnchor('cors-protocol-exceptions')],
    'expect non-preflighted requests for certain content-types',
  ),
];

export { CLAUSES };
export type { Clause };
