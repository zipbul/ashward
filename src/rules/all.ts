import type { RuleDef } from '../core/contract/interfaces';
import type { HttpRuleContext } from '../http/context';

import { accessControlAllowCredentialsExactTrue } from './access-control-allow-credentials-exact-true';
import { accessControlAllowHeadersTokenList } from './access-control-allow-headers-token-list';
import { accessControlAllowHeadersWildcardWithCredentials } from './access-control-allow-headers-wildcard-with-credentials';
import { accessControlAllowMethodsCase } from './access-control-allow-methods-case';
import { accessControlAllowMethodsTokenList } from './access-control-allow-methods-token-list';
import { accessControlAllowMethodsWildcardWithCredentials } from './access-control-allow-methods-wildcard-with-credentials';
import { accessControlAllowOriginGrammar } from './access-control-allow-origin-grammar';
import { accessControlAllowOriginSingle } from './access-control-allow-origin-single';
import { accessControlAllowOriginStaticNoVary } from './access-control-allow-origin-static-no-vary';
import { accessControlAllowOriginWildcardWithCredentials } from './access-control-allow-origin-wildcard-with-credentials';
import { accessControlAllowPrivateNetworkLiteralTrue } from './access-control-allow-private-network-literal-true';
import { accessControlExposeHeadersPreflightOnly } from './access-control-expose-headers-preflight-only';
import { accessControlExposeHeadersTokenList } from './access-control-expose-headers-token-list';
import { accessControlExposeHeadersWildcardWithCredentials } from './access-control-expose-headers-wildcard-with-credentials';
import { accessControlMaxAgeDeltaSeconds } from './access-control-max-age-delta-seconds';
import { clTeConflict } from './cl-te-conflict';
import { compressedEtagWeakOrDistinct } from './compressed-etag-weak-or-distinct';
import { conditionalIgnoredOnErrorStatus } from './conditional-ignored-on-error-status';
import { conditionalIgnoredOnNonSelectingMethod } from './conditional-ignored-on-non-selecting-method';
import { contentEncodingNoIdentityToken } from './content-encoding-no-identity-token';
import { deflateZlibWrapped } from './deflate-zlib-wrapped';
import { duplicateContentLength } from './duplicate-content-length';
import { gzipFormatValid } from './gzip-format-valid';
import { httpDateFormatsAccepted } from './http-date-formats-accepted';
import { ifMatchFalseNotPerformed } from './if-match-false-not-performed';
import { ifMatchStrongComparison } from './if-match-strong-comparison';
import { ifModifiedSinceNotModified } from './if-modified-since-not-modified';
import { ifNoneMatchNotModified } from './if-none-match-not-modified';
import { ifNoneMatchStarNotModified } from './if-none-match-star-not-modified';
import { ifNoneMatchWeakComparison } from './if-none-match-weak-comparison';
import { ifUnmodifiedSinceFalseNotPerformed } from './if-unmodified-since-false-not-performed';
import { invalidUtf8NoHardFail } from './invalid-utf8-no-hard-fail';
import { locationRedirectNoUserinfo } from './location-redirect-no-userinfo';
import { malformedPercentNoHardFail } from './malformed-percent-no-hard-fail';
import { noContentEncodingOnBodilessResponse } from './no-content-encoding-on-bodiless-response';
import { notModifiedNoContent } from './not-modified-no-content';
import { notModifiedRequiredHeaders } from './not-modified-required-headers';
import { nulByteNoHardFail } from './nul-byte-no-hard-fail';
import { nullOrigin } from './null-origin';
import { originReflection } from './origin-reflection';
import { precedenceIfMatchOverIfUnmodifiedSince } from './precedence-if-match-over-if-unmodified-since';
import { precedenceIfNoneMatchOverIfModifiedSince } from './precedence-if-none-match-over-if-modified-since';
import { preflightCredentialedGrant } from './preflight-credentialed-grant';
import { preflightOkStatus } from './preflight-ok-status';
import { privateNetworkAccessIdNameFormat } from './private-network-access-id-name-format';
import { prototypePollutionNoCrash } from './prototype-pollution-no-crash';
import { uriGenericPlusIsLiteral } from './uri-generic-plus-is-literal';
import { urlencodedAmpersandOnlySeparator } from './urlencoded-ampersand-only-separator';
import { urlencodedEmptyNamePreserved } from './urlencoded-empty-name-preserved';
import { urlencodedEmptySequenceSkipped } from './urlencoded-empty-sequence-skipped';
import { urlencodedFirstEqualsSplits } from './urlencoded-first-equals-splits';
import { urlencodedMalformedPercentPreserved } from './urlencoded-malformed-percent-preserved';
import { urlencodedPlusIsSpace } from './urlencoded-plus-is-space';
import { urlencodedUtf8Replacement } from './urlencoded-utf8-replacement';
import { varyAcceptEncodingOnNegotiated } from './vary-accept-encoding-on-negotiated';
import { varyOrigin } from './vary-origin';
import { zstdReservedBitsZero } from './zstd-reserved-bits-zero';
import { zstdWindowWithinHttpCap } from './zstd-window-within-http-cap';

/**
 * Every rule the package ships, as one flat registry. WHICH rules to run is the CALLER's choice:
 * pass a subset of this array (filter it), a hand-picked list of the individual rules, or your own
 * RuleDef[] to `ashward()`. The package ships rules — never an opinion about which ones your app must
 * satisfy. Each rule carries a stable id (`Rule`), so results and selections are addressable.
 */
export const ALL_RULES: readonly RuleDef<HttpRuleContext>[] = [
  // HTTP/1.1 framing (RFC 9112)
  duplicateContentLength,
  clTeConflict,
  // WHATWG Fetch CORS
  accessControlAllowOriginGrammar,
  accessControlAllowOriginSingle,
  accessControlAllowOriginWildcardWithCredentials,
  accessControlAllowOriginStaticNoVary,
  accessControlAllowCredentialsExactTrue,
  accessControlAllowMethodsTokenList,
  accessControlAllowMethodsCase,
  accessControlAllowMethodsWildcardWithCredentials,
  accessControlAllowHeadersTokenList,
  accessControlAllowHeadersWildcardWithCredentials,
  accessControlExposeHeadersTokenList,
  accessControlExposeHeadersWildcardWithCredentials,
  accessControlExposeHeadersPreflightOnly,
  accessControlMaxAgeDeltaSeconds,
  preflightOkStatus,
  preflightCredentialedGrant,
  locationRedirectNoUserinfo,
  varyOrigin,
  accessControlAllowPrivateNetworkLiteralTrue,
  privateNetworkAccessIdNameFormat,
  originReflection,
  nullOrigin,
  // Compression
  contentEncodingNoIdentityToken,
  noContentEncodingOnBodilessResponse,
  varyAcceptEncodingOnNegotiated,
  compressedEtagWeakOrDistinct,
  gzipFormatValid,
  deflateZlibWrapped,
  zstdWindowWithinHttpCap,
  zstdReservedBitsZero,
  // Query-parser (RFC 3986, WHATWG URL)
  malformedPercentNoHardFail,
  invalidUtf8NoHardFail,
  nulByteNoHardFail,
  prototypePollutionNoCrash,
  urlencodedAmpersandOnlySeparator,
  urlencodedFirstEqualsSplits,
  urlencodedEmptyNamePreserved,
  urlencodedPlusIsSpace,
  uriGenericPlusIsLiteral,
  urlencodedUtf8Replacement,
  urlencodedMalformedPercentPreserved,
  urlencodedEmptySequenceSkipped,
  // Conditional-request (RFC 9110 §13)
  ifNoneMatchNotModified,
  ifNoneMatchStarNotModified,
  ifNoneMatchWeakComparison,
  ifMatchFalseNotPerformed,
  ifMatchStrongComparison,
  ifUnmodifiedSinceFalseNotPerformed,
  ifModifiedSinceNotModified,
  httpDateFormatsAccepted,
  precedenceIfNoneMatchOverIfModifiedSince,
  precedenceIfMatchOverIfUnmodifiedSince,
  notModifiedRequiredHeaders,
  notModifiedNoContent,
  conditionalIgnoredOnNonSelectingMethod,
  conditionalIgnoredOnErrorStatus,
];

// Each rule is also exported by name, so a caller can compose an explicit selection.
export {
  accessControlAllowCredentialsExactTrue,
  accessControlAllowHeadersTokenList,
  accessControlAllowHeadersWildcardWithCredentials,
  accessControlAllowMethodsCase,
  accessControlAllowMethodsTokenList,
  accessControlAllowMethodsWildcardWithCredentials,
  accessControlAllowOriginGrammar,
  accessControlAllowOriginSingle,
  accessControlAllowOriginStaticNoVary,
  accessControlAllowOriginWildcardWithCredentials,
  accessControlAllowPrivateNetworkLiteralTrue,
  accessControlExposeHeadersPreflightOnly,
  accessControlExposeHeadersTokenList,
  accessControlExposeHeadersWildcardWithCredentials,
  accessControlMaxAgeDeltaSeconds,
  clTeConflict,
  compressedEtagWeakOrDistinct,
  conditionalIgnoredOnErrorStatus,
  conditionalIgnoredOnNonSelectingMethod,
  contentEncodingNoIdentityToken,
  deflateZlibWrapped,
  duplicateContentLength,
  gzipFormatValid,
  httpDateFormatsAccepted,
  ifMatchFalseNotPerformed,
  ifMatchStrongComparison,
  ifModifiedSinceNotModified,
  ifNoneMatchNotModified,
  ifNoneMatchStarNotModified,
  ifNoneMatchWeakComparison,
  ifUnmodifiedSinceFalseNotPerformed,
  invalidUtf8NoHardFail,
  locationRedirectNoUserinfo,
  malformedPercentNoHardFail,
  noContentEncodingOnBodilessResponse,
  notModifiedNoContent,
  notModifiedRequiredHeaders,
  nulByteNoHardFail,
  nullOrigin,
  originReflection,
  precedenceIfMatchOverIfUnmodifiedSince,
  precedenceIfNoneMatchOverIfModifiedSince,
  preflightCredentialedGrant,
  preflightOkStatus,
  privateNetworkAccessIdNameFormat,
  prototypePollutionNoCrash,
  uriGenericPlusIsLiteral,
  urlencodedAmpersandOnlySeparator,
  urlencodedEmptyNamePreserved,
  urlencodedEmptySequenceSkipped,
  urlencodedFirstEqualsSplits,
  urlencodedMalformedPercentPreserved,
  urlencodedPlusIsSpace,
  urlencodedUtf8Replacement,
  varyAcceptEncodingOnNegotiated,
  varyOrigin,
  zstdReservedBitsZero,
  zstdWindowWithinHttpCap,
};
