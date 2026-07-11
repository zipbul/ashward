import type { RuleDef } from '../core/contract/interfaces';
import type { HttpRuleContext } from '../http/context';

import { accessControlAllowCredentialsExactTrue } from '../rules/access-control-allow-credentials-exact-true';

/**
 * The CORS preset (WHATWG Fetch) — the origin-server response-conformance rules the browser CORS
 * protocol implies. "cors" is ONLY this named selection of rule ids; it is never a directory, a
 * type, or a rule-id prefix. The list grows as each CORS rule lands.
 */
export const cors: readonly RuleDef<HttpRuleContext>[] = [accessControlAllowCredentialsExactTrue];
