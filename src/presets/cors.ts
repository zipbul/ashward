import type { RuleDef } from '../core/contract/interfaces';
import type { HttpRuleContext } from '../http/context';

import { accessControlAllowCredentialsExactTrue } from '../rules/access-control-allow-credentials-exact-true';
import { accessControlAllowHeadersTokenList } from '../rules/access-control-allow-headers-token-list';
import { accessControlAllowHeadersWildcardWithCredentials } from '../rules/access-control-allow-headers-wildcard-with-credentials';
import { accessControlAllowMethodsCase } from '../rules/access-control-allow-methods-case';
import { accessControlAllowMethodsTokenList } from '../rules/access-control-allow-methods-token-list';
import { accessControlAllowMethodsWildcardWithCredentials } from '../rules/access-control-allow-methods-wildcard-with-credentials';
import { accessControlAllowOriginGrammar } from '../rules/access-control-allow-origin-grammar';
import { accessControlAllowOriginSingle } from '../rules/access-control-allow-origin-single';
import { accessControlAllowOriginStaticNoVary } from '../rules/access-control-allow-origin-static-no-vary';
import { accessControlAllowOriginWildcardWithCredentials } from '../rules/access-control-allow-origin-wildcard-with-credentials';
import { accessControlAllowPrivateNetworkLiteralTrue } from '../rules/access-control-allow-private-network-literal-true';
import { accessControlExposeHeadersPreflightOnly } from '../rules/access-control-expose-headers-preflight-only';
import { accessControlExposeHeadersTokenList } from '../rules/access-control-expose-headers-token-list';
import { accessControlExposeHeadersWildcardWithCredentials } from '../rules/access-control-expose-headers-wildcard-with-credentials';
import { accessControlMaxAgeDeltaSeconds } from '../rules/access-control-max-age-delta-seconds';
import { locationRedirectNoUserinfo } from '../rules/location-redirect-no-userinfo';
import { nullOrigin } from '../rules/null-origin';
import { originReflection } from '../rules/origin-reflection';
import { preflightCredentialedGrant } from '../rules/preflight-credentialed-grant';
import { preflightOkStatus } from '../rules/preflight-ok-status';
import { privateNetworkAccessIdNameFormat } from '../rules/private-network-access-id-name-format';
import { varyOrigin } from '../rules/vary-origin';

/**
 * The CORS preset (WHATWG Fetch) — the origin-server response-conformance rules the browser CORS
 * protocol implies, plus the reflection/null-origin security heuristics that ship alongside them.
 * "cors" is ONLY this named selection of rules; it is never a directory, a type, or a rule-id prefix.
 */
export const cors: readonly RuleDef<HttpRuleContext>[] = [
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
];
