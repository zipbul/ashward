export enum StandardsBody {
  IETF = 'IETF',
  WHATWG = 'WHATWG',
  W3C = 'W3C',
  WICG = 'WICG',
  MITRE = 'MITRE',
  OWASP = 'OWASP',
}

/** RFC 2119 / 8174 requirement levels — a closed, universal set. */
export enum ReqLevel {
  Must = 'MUST',
  MustNot = 'MUST NOT',
  Should = 'SHOULD',
  ShouldNot = 'SHOULD NOT',
  May = 'MAY',
}

/** How a clause is located within its document — bodies cite differently. */
export enum LocatorKind {
  Section = 'section',
  Anchor = 'anchor',
  Clause = 'clause',
}

/** Whether a living document is a ratified standard or a non-standard draft (e.g. WICG PNA). */
export enum DocumentStatus {
  Living = 'living',
  Draft = 'draft',
}

/**
 * A neutral, editorial identity for one normative requirement — the join key between the clause
 * catalog, the disposition table, and the rules that test it. Frozen kebab like `Rule`, with NO `§`,
 * document, or domain/preset prefix: a `§1.1` is not identity, it is a locator that lives inside the
 * clause's `NormativeRef[]`. One flat enum spans every domain (CORS today, framing/URL/PNA next), so
 * the provenance layer never grows a per-body or per-preset structure. Member order mirrors the
 * snapshot the disposition test pins.
 */
export enum ClauseId {
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
