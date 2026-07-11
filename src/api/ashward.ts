import type { RuleDef } from '../core/contract/interfaces';
import type { Report } from '../core/report/interfaces';
import type { HttpRuleContext } from '../http/context';

import { runHttp } from '../http/run';
import { BUILTIN_RULES } from '../rules/constants';
import { resolveTarget } from './resolve-target';

/**
 * Public entry: point it at a running server and get back a Report to inspect or assert on. Runs
 * every built-in rule by default; pass a preset (`cors`, `framing`) or any rule list to scope the
 * run. A plain async function — works identically under any test runner and outside one.
 */
export async function ashward(url: string, rules: readonly RuleDef<HttpRuleContext>[] = BUILTIN_RULES): Promise<Report> {
  return runHttp(resolveTarget(url), rules);
}
