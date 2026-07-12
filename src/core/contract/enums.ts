export enum Verdict {
  Pass = 'pass',
  Fail = 'fail',
  Warn = 'warn',
  Skip = 'skip',
  Inconclusive = 'inconclusive',
}

/** Why a check could not reach a pass/fail — always typed, never a silent bucket. */
export enum InconclusiveReason {
  Timeout = 'timeout',
  ConnectionRefused = 'connection-refused',
  AmbiguousFraming = 'ambiguous-framing',
  MalformedResponse = 'malformed-response',
  DriverError = 'driver-error',
}

/**
 * Why a check did not apply. Distinct from inconclusive: the wire was read fine, the
 * precondition the clause is conditioned on simply was not present.
 */
export enum SkipReason {
  HeaderAbsent = 'header-absent',
}

/**
 * Public, permanent rule identity — the single source of a rule's id. The member value is the
 * stable slug that appears in reports, baselines, and `except` tokens, so it must never change
 * once shipped. Values carry NO domain/spec prefix (an id names the subject header/mechanism and the
 * behaviour, never its domain — CORS is not an id namespace, the framing rules are not
 * `http.framing.*`). The frozen roster here is the authority the disposition table is checked against.
 */
export enum Rule {
  // HTTP/1.1 framing (RFC 9112)
  DuplicateContentLength = 'duplicate-content-length',
  ClTeConflict = 'cl-te-conflict',

  // Fetch CORS — Access-Control-Allow-Origin
  AccessControlAllowOriginGrammar = 'access-control-allow-origin-grammar',
  AccessControlAllowOriginSingle = 'access-control-allow-origin-single',
  AccessControlAllowOriginWildcardWithCredentials = 'access-control-allow-origin-wildcard-with-credentials',
  AccessControlAllowOriginStaticNoVary = 'access-control-allow-origin-static-no-vary',
  // Fetch CORS — Access-Control-Allow-Credentials
  AccessControlAllowCredentialsExactTrue = 'access-control-allow-credentials-exact-true',
  // Fetch CORS — Access-Control-Allow-Methods
  AccessControlAllowMethodsTokenList = 'access-control-allow-methods-token-list',
  AccessControlAllowMethodsCase = 'access-control-allow-methods-case',
  AccessControlAllowMethodsWildcardWithCredentials = 'access-control-allow-methods-wildcard-with-credentials',
  // Fetch CORS — Access-Control-Allow-Headers
  AccessControlAllowHeadersTokenList = 'access-control-allow-headers-token-list',
  AccessControlAllowHeadersWildcardWithCredentials = 'access-control-allow-headers-wildcard-with-credentials',
  // Fetch CORS — Access-Control-Expose-Headers
  AccessControlExposeHeadersTokenList = 'access-control-expose-headers-token-list',
  AccessControlExposeHeadersWildcardWithCredentials = 'access-control-expose-headers-wildcard-with-credentials',
  AccessControlExposeHeadersPreflightOnly = 'access-control-expose-headers-preflight-only',
  // Fetch CORS — Access-Control-Max-Age
  AccessControlMaxAgeDeltaSeconds = 'access-control-max-age-delta-seconds',
  // Fetch CORS — preflight
  PreflightOkStatus = 'preflight-ok-status',
  PreflightCredentialedGrant = 'preflight-credentialed-grant',
  // Fetch CORS — redirect
  LocationRedirectNoUserinfo = 'location-redirect-no-userinfo',
  // Fetch CORS — caching
  VaryOrigin = 'vary-origin',
  // WICG Private Network Access
  AccessControlAllowPrivateNetworkLiteralTrue = 'access-control-allow-private-network-literal-true',
  PrivateNetworkAccessIdNameFormat = 'private-network-access-id-name-format',

  // Security heuristics (not STANDARDS MUSTs — §2.2 says reflection passes the CORS check)
  OriginReflection = 'origin-reflection',
  NullOrigin = 'null-origin',
}
