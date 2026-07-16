import type { RuleDef } from '../core/contract/interfaces';
import type { Report } from '../core/report/interfaces';
import type { HttpRuleContext, ReflectMode } from '../http/context';

import { runHttp } from '../http/run';
import { ALL_RULES } from '../rules/all';
import { resolveTarget } from './resolve-target';

/**
 * Opt-in query-parser reflection contract: point ashward at a route that echoes back the query it
 * received as an ordered pair-list JSON (see `HttpRuleContext.reflect`). `path` overrides ONLY the
 * reflect probes' target path (defaults to the URL's own path when omitted) — every non-reflect
 * rule keeps probing the URL's own resolved path regardless of `reflect.path`. Undefined by
 * default — every existing caller/test is unaffected.
 */
export interface AshwardOptions {
  readonly reflect?: {
    readonly path?: string;
    readonly mode: ReflectMode;
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
  const reflect =
    options?.reflect !== undefined
      ? { mode: options.reflect.mode, ...(options.reflect.path !== undefined ? { path: options.reflect.path } : {}) }
      : undefined;
  return runHttp(target, rules, reflect);
}
