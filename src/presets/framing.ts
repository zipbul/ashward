import type { RuleDef } from '../core/contract/interfaces';
import type { HttpRuleContext } from '../http/context';

import { clTeConflict } from '../rules/cl-te-conflict';
import { duplicateContentLength } from '../rules/duplicate-content-length';

/** The HTTP/1.1 framing preset (RFC 9112) — request-smuggling / parser-discrepancy checks. A preset
 *  is a named selection of rules and nothing more: data, never a directory or type. */
export const framing: readonly RuleDef<HttpRuleContext>[] = [duplicateContentLength, clTeConflict];
