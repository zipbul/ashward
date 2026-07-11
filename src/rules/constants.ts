import type { RuleDef } from '../core/contract/interfaces';
import type { HttpRuleContext } from '../http/context';

import { cors } from '../presets/cors';
import { framing } from '../presets/framing';

/**
 * The built-in rules run by default — the union of the shipped presets (HTTP/1.1 framing + the
 * WHATWG Fetch CORS rules). Composing presets, not hand-listing rules, is what keeps "cors" a
 * selection of ids rather than a structural thing. As the CORS roster lands, the `cors` preset
 * grows and this composition tracks it; the catalog spec tracks the remaining gap.
 */
export const BUILTIN_RULES: readonly RuleDef<HttpRuleContext>[] = [...framing, ...cors];
