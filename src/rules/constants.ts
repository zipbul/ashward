import type { RuleDef } from '../core/contract/interfaces';
import type { HttpRuleContext } from '../http/context';

import { accessControlAllowCredentialsExactTrue } from './access-control-allow-credentials-exact-true';
import { clTeConflict } from './cl-te-conflict';
import { duplicateContentLength } from './duplicate-content-length';

/**
 * The built-in rules run by default — HTTP/1.1 framing plus the WHATWG Fetch CORS rules landing
 * one at a time against the frozen `Rule` roster and the disposition table. `ALL_RULES` is a subset
 * of `Rule` while the CORS roster is implemented; the disposition spec tracks the remaining gap.
 */
export const BUILTIN_RULES: readonly RuleDef<HttpRuleContext>[] = [
  duplicateContentLength,
  clTeConflict,
  accessControlAllowCredentialsExactTrue,
];
