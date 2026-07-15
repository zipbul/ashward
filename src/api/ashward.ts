import type { RuleDef } from '../core/contract/interfaces';
import type { Report } from '../core/report/interfaces';
import type { HttpRuleContext } from '../http/context';

import { runHttp } from '../http/run';
import { ALL_RULES } from '../rules/all';
import { resolveTarget } from './resolve-target';

/**
 * Opt-in query-parser reflection contract: point ashward at a route that echoes back the query it
 * received as an ordered pair-list JSON (see `HttpRuleContext.reflect`). `path` overrides the
 * target's resolved path for the reflect probes only (defaults to the URL's own path when omitted).
 * Undefined by default — every existing caller/test is unaffected.
 */
export interface AshwardOptions {
  readonly reflect?: {
    readonly path?: string;
    readonly mode: 'form' | 'uri-generic';
  };
}

/**
 * Public entry: point it at a running server and get back a Report to inspect or assert on. Runs
 * every shipped rule by default; pass your own selection (a filtered `ALL_RULES`, a hand-picked list
 * of rules, or any RuleDef[]) to scope the run — the package never decides the subset for you. A
 * plain async function: works identically under any test runner and outside one.
 */
export async function ashward(
  url: string,
  rules: readonly RuleDef<HttpRuleContext>[] = ALL_RULES,
  options?: AshwardOptions,
): Promise<Report> {
  const target = resolveTarget(url);
  const reflectPath = options?.reflect?.path;
  const resolvedTarget = reflectPath !== undefined ? { ...target, path: reflectPath } : target;
  return runHttp(resolvedTarget, rules, options?.reflect !== undefined ? { mode: options.reflect.mode } : undefined);
}
