import type { RuleDef } from '../core/contract/interfaces';
import type { Report } from '../core/report/interfaces';
import type { HttpRuleContext } from '../http/context';

import { runHttp } from '../http/run';
import { ALL_RULES } from '../rules/all';
import { resolveTarget } from './resolve-target';

/**
 * Public entry: point it at a running server and get back a Report to inspect or assert on. Runs
 * every shipped rule by default; pass your own selection (a filtered `ALL_RULES`, a hand-picked list
 * of rules, or any RuleDef[]) to scope the run — the package never decides the subset for you. A
 * plain async function: works identically under any test runner and outside one.
 */
export async function ashward(url: string, rules: readonly RuleDef<HttpRuleContext>[] = ALL_RULES): Promise<Report> {
  return runHttp(resolveTarget(url), rules);
}
