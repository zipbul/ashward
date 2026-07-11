import type { RuleDef } from '../core/contract/interfaces';

import { clTeConflict } from './http/framing/cl-te-conflict';
import { duplicateContentLength } from './http/framing/duplicate-content-length';

/**
 * The built-in rules run by default. Currently HTTP/1.1 framing only — the WHATWG Fetch CORS rules
 * are being (re)implemented against the frozen `Rule` roster and the disposition table, and land
 * per phase. `ALL_RULES` is therefore a subset of `Rule`; the disposition spec tracks which roster
 * ids are not yet implemented.
 */
export const BUILTIN_RULES: readonly RuleDef[] = [duplicateContentLength, clTeConflict];
