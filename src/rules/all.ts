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
import { contentEncodingNoIdentityToken } from './content-encoding-no-identity-token';
import { deflateZlibWrapped } from './deflate-zlib-wrapped';
import { duplicateContentLength } from './duplicate-content-length';
import { gzipFormatValid } from './gzip-format-valid';
import { locationRedirectNoUserinfo } from './location-redirect-no-userinfo';
import { noContentEncodingOnBodilessResponse } from './no-content-encoding-on-bodiless-response';
import { nullOrigin } from './null-origin';
import { originReflection } from './origin-reflection';
import { preflightCredentialedGrant } from './preflight-credentialed-grant';
import { preflightOkStatus } from './preflight-ok-status';
import { privateNetworkAccessIdNameFormat } from './private-network-access-id-name-format';
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
  contentEncodingNoIdentityToken,
  deflateZlibWrapped,
  duplicateContentLength,
  gzipFormatValid,
  locationRedirectNoUserinfo,
  noContentEncodingOnBodilessResponse,
  nullOrigin,
  originReflection,
  preflightCredentialedGrant,
  preflightOkStatus,
  privateNetworkAccessIdNameFormat,
  varyAcceptEncodingOnNegotiated,
  varyOrigin,
  zstdReservedBitsZero,
  zstdWindowWithinHttpCap,
};
